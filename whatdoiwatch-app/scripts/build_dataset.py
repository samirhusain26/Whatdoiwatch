#!/usr/bin/env python3
"""
build_dataset.py — Phase 2.1 of the What Do I Watch implementation plan.

Pages through TMDB /discover/movie and /discover/tv (sorted by popularity.desc
AND vote_count.desc, to catch acclaimed-but-niche titles), fetches genres,
keywords, top-5 cast, and director/creator for each title via
append_to_response=credits,keywords, builds a `soup` string per title (same
recipe as the legacy binge-it-on/data/tmdb.csv: keywords + cast + director +
genres, each token lowercased with internal whitespace stripped, space-joined
so CountVectorizer(stop_words='english') behaves the same way), and writes
the final corpus to data/corpus.parquet.

Lives in whatdoiwatch-app/scripts/ — this is the manual corpus-refresh path
(see the "Corpus refresh" locked decision: rerun every few months when picks
feel stale). Reads the TMDB key via python-dotenv from whatdoiwatch-app/.env
(this script's own parent directory), but also accepts TMDB_API_KEY already
in the environment, or an explicit --env-file path. All paths are relative to
this script's location (or overridable via CLI), never hardcoded absolute.

CHECKPOINTING (mandatory — safe to Ctrl-C and rerun):
- data/checkpoint.jsonl   — one JSON object per successfully fetched title,
                            appended as soon as it's fetched (not buffered).
- data/state.json         — small state file tracking the set of TMDB ids
                            (per media_type) that are already checkpointed,
                            plus discover-phase pagination progress, so a
                            restart skips ids already done and does not
                            re-page from scratch.

Usage:
    python scripts/build_dataset.py --mode test     # ~500 titles (250+250)
    python scripts/build_dataset.py --mode full      # ~10-15k movies + 5-10k tv
    python scripts/build_dataset.py --mode full --resume   # (resume is automatic;
                                                              flag is just documentation)
"""

import argparse
import json
import os
import re
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

# --------------------------------------------------------------------------
# Paths (robust to being moved into whatdoiwatch-app/scripts/)
# --------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_ROOT = SCRIPT_DIR.parent  # data_pipeline/ today, whatdoiwatch-app/ later
DATA_DIR = PIPELINE_ROOT / "data"
CHECKPOINT_PATH = DATA_DIR / "checkpoint.jsonl"
STATE_PATH = DATA_DIR / "state.json"
CORPUS_PATH = DATA_DIR / "corpus.parquet"

TMDB_BASE = "https://api.themoviedb.org/3"

# --------------------------------------------------------------------------
# Rate limiter: TMDB allows ~40-50 req/10s per key. We stay conservative.
# --------------------------------------------------------------------------
class RateLimiter:
    """Sliding-window rate limiter shared across worker threads."""

    def __init__(self, max_requests: int, per_seconds: float):
        self.max_requests = max_requests
        self.per_seconds = per_seconds
        self.lock = threading.Lock()
        self.timestamps = deque()

    def acquire(self):
        while True:
            with self.lock:
                now = time.monotonic()
                while self.timestamps and now - self.timestamps[0] > self.per_seconds:
                    self.timestamps.popleft()
                if len(self.timestamps) < self.max_requests:
                    self.timestamps.append(now)
                    return
                sleep_for = self.per_seconds - (now - self.timestamps[0]) + 0.01
            time.sleep(max(sleep_for, 0.01))


# Conservative: 35 requests / 10s (TMDB's documented ceiling is ~40-50/10s).
RATE_LIMITER = RateLimiter(max_requests=35, per_seconds=10.0)
MAX_WORKERS = 8
SESSION = requests.Session()


def tmdb_get(path: str, api_key: str, params: dict, max_retries: int = 5):
    """GET against TMDB with rate limiting, retry/backoff on 429 and transient errors."""
    params = {**params, "api_key": api_key}
    backoff = 1.0
    for attempt in range(max_retries):
        RATE_LIMITER.acquire()
        try:
            resp = SESSION.get(f"{TMDB_BASE}{path}", params=params, timeout=20)
        except requests.RequestException as exc:
            if attempt == max_retries - 1:
                raise
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
            continue

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("Retry-After", backoff))
            time.sleep(retry_after)
            backoff = min(backoff * 2, 30)
            continue
        if resp.status_code >= 500:
            if attempt == max_retries - 1:
                resp.raise_for_status()
            time.sleep(backoff)
            backoff = min(backoff * 2, 30)
            continue

        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"Exceeded retries for {path}")


# --------------------------------------------------------------------------
# Discovery: page through /discover/movie and /discover/tv
# --------------------------------------------------------------------------
def discover_ids(media_type: str, api_key: str, sort_by: str, target_count: int,
                  min_vote_count: int, seen_ids: set, max_pages: int = 500):
    """
    Yields TMDB ids from /discover/{media_type} sorted by `sort_by`, skipping
    ids already in `seen_ids` (mutated in place as we go so a second discover
    pass with a different sort_by naturally dedupes against the first pass).
    Stops once target_count *new* ids have been yielded or pages are exhausted.
    """
    endpoint = f"/discover/{media_type}"
    new_count = 0
    page = 1
    while page <= max_pages and new_count < target_count:
        params = {
            "sort_by": sort_by,
            "include_adult": "false",
            "vote_count.gte": min_vote_count,
            "page": page,
        }
        try:
            data = tmdb_get(endpoint, api_key, params)
        except requests.HTTPError as exc:
            print(f"  [discover {media_type} {sort_by}] page {page} failed: {exc}", file=sys.stderr)
            break

        results = data.get("results", [])
        if not results:
            break

        for item in results:
            tmdb_id = item.get("id")
            if tmdb_id is None or tmdb_id in seen_ids:
                continue
            seen_ids.add(tmdb_id)
            new_count += 1
            yield tmdb_id
            if new_count >= target_count:
                break

        total_pages = data.get("total_pages", page)
        page += 1
        if page > total_pages:
            break


def collect_discovery_list(media_type: str, api_key: str, target_count: int,
                            min_vote_count: int):
    """
    Runs two discover passes and returns a de-duplicated list of ids sized to
    ~target_count total (not per pass):
      1. popularity.desc — gets the majority share (70% of target).
      2. vote_count.desc — fills the remainder, guaranteeing at least 20% of
         target so acclaimed-but-niche titles (high vote_count, lower
         popularity) meaningfully contribute rather than being fully crowded
         out by overlap with the popularity pass.
    A little over/under target_count is fine — TMDB's page cap (500 pages =
    10k results) can limit how many unique ids exist under vote_count.gte for
    niche corners.
    """
    seen_ids = set()
    ids = []

    popularity_share = int(target_count * 0.7)
    niche_min_share = max(target_count - popularity_share, int(target_count * 0.2))

    for sort_by, pass_target in (
        ("popularity.desc", popularity_share),
        ("vote_count.desc", niche_min_share),
    ):
        before = len(seen_ids)
        for tmdb_id in discover_ids(media_type, api_key, sort_by, pass_target,
                                     min_vote_count, seen_ids):
            ids.append(tmdb_id)
        added = len(seen_ids) - before
        print(f"  [discover {media_type}] pass '{sort_by}' added {added} new ids "
              f"(total so far: {len(seen_ids)})")

    return ids


# --------------------------------------------------------------------------
# Soup construction (mirrors binge-it-on/data/tmdb.csv recipe exactly)
# --------------------------------------------------------------------------
def tokenize(name: str) -> str:
    """Lowercase and strip ALL whitespace from a name/keyword/genre so it
    becomes a single CountVectorizer token, e.g. 'Léa Seydoux' -> 'léaseydoux',
    'Science Fiction' -> 'sciencefiction'."""
    if not name:
        return ""
    return re.sub(r"\s+", "", name.strip().lower())


def build_soup(keywords, cast_names, director_names, genres) -> str:
    """keywords + cast + director/creator + genres, space-joined tokens."""
    tokens = []
    tokens.extend(tokenize(k) for k in keywords)
    tokens.extend(tokenize(c) for c in cast_names)
    tokens.extend(tokenize(d) for d in director_names)
    tokens.extend(tokenize(g) for g in genres)
    tokens = [t for t in tokens if t]
    return " ".join(tokens)


# --------------------------------------------------------------------------
# Per-title detail fetch + record construction
# --------------------------------------------------------------------------
def fetch_title_record(media_type: str, tmdb_id: int, api_key: str):
    path = f"/movie/{tmdb_id}" if media_type == "movie" else f"/tv/{tmdb_id}"
    data = tmdb_get(path, api_key, {"append_to_response": "credits,keywords"})

    genres = [g["name"] for g in data.get("genres", []) or []]

    # Movie keywords live under data['keywords']['keywords'];
    # TV keywords live under data['keywords']['results']. Handle both.
    kw_block = data.get("keywords", {}) or {}
    keywords = [k["name"] for k in (kw_block.get("keywords") or kw_block.get("results") or [])]

    credits = data.get("credits", {}) or {}
    cast = [c["name"] for c in (credits.get("cast") or [])[:5]]

    if media_type == "movie":
        crew = credits.get("crew", []) or []
        directors = [c["name"] for c in crew if c.get("job") == "Director"]
        title = data.get("title") or data.get("original_title") or ""
        date_str = data.get("release_date") or ""
    else:
        directors = [c["name"] for c in (data.get("created_by") or [])]
        title = data.get("name") or data.get("original_name") or ""
        date_str = data.get("first_air_date") or ""

    year = None
    if date_str and len(date_str) >= 4:
        try:
            year = int(date_str[:4])
        except ValueError:
            year = None

    soup = build_soup(keywords, cast, directors, genres)

    return {
        "media_type": media_type,
        "id": tmdb_id,
        "title": title,
        "year": year,
        "genres": genres,
        "vote_average": data.get("vote_average"),
        "soup": soup,
    }


# --------------------------------------------------------------------------
# Checkpoint state
# --------------------------------------------------------------------------
def load_state():
    if STATE_PATH.exists():
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"done_ids": {"movie": [], "tv": []}}


def save_state(state):
    tmp_path = STATE_PATH.with_suffix(".json.tmp")
    with open(tmp_path, "w") as f:
        json.dump(state, f)
    tmp_path.replace(STATE_PATH)


def load_done_ids_from_checkpoint():
    """Rebuild the done-id set directly from checkpoint.jsonl as the source
    of truth (state.json is a fast-path cache; this is the fallback if it's
    missing or stale)."""
    done = {"movie": set(), "tv": set()}
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                done.setdefault(rec["media_type"], set()).add(rec["id"])
    return done


# --------------------------------------------------------------------------
# Main fetch loop with thread pool + incremental checkpointing
# --------------------------------------------------------------------------
def run_fetch_phase(media_type: str, ids_to_fetch: list, api_key: str, checkpoint_lock: threading.Lock,
                     checkpoint_file, done_ids: set, state: dict):
    total = len(ids_to_fetch)
    completed = 0
    failed = 0

    def worker(tmdb_id):
        try:
            record = fetch_title_record(media_type, tmdb_id, api_key)
            return tmdb_id, record, None
        except Exception as exc:  # noqa: BLE001 - we want to keep going on any single-title failure
            return tmdb_id, None, str(exc)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(worker, tmdb_id): tmdb_id for tmdb_id in ids_to_fetch}
        for future in as_completed(futures):
            tmdb_id, record, error = future.result()
            if error is not None:
                failed += 1
                print(f"  [fetch {media_type}:{tmdb_id}] FAILED: {error}", file=sys.stderr)
                continue

            with checkpoint_lock:
                checkpoint_file.write(json.dumps(record) + "\n")
                checkpoint_file.flush()
                os.fsync(checkpoint_file.fileno())
                done_ids.add(tmdb_id)
                state["done_ids"][media_type] = list(done_ids)
                save_state(state)

            completed += 1
            if completed % 25 == 0 or completed == total:
                print(f"  [{media_type}] {completed}/{total} fetched ({failed} failed)")

    return completed, failed


def main():
    parser = argparse.ArgumentParser(description="Build the TMDB movie+TV corpus for What Do I Watch.")
    parser.add_argument("--mode", choices=["test", "full"], default="test",
                         help="test = ~250 movies + 250 tv; full = ~10-15k movies + 5-10k tv")
    parser.add_argument("--movies", type=int, default=None, help="override movie target count")
    parser.add_argument("--tv", type=int, default=None, help="override tv target count")
    parser.add_argument("--min-vote-count", type=int, default=100)
    parser.add_argument("--env-file", type=str, default=None,
                         help="path to .env file (default: whatdoiwatch-app/.env, i.e. PIPELINE_ROOT/.env)")
    args = parser.parse_args()

    env_file = Path(args.env_file) if args.env_file else (PIPELINE_ROOT / ".env")
    load_dotenv(env_file)
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        print(f"ERROR: TMDB_API_KEY not found (looked in env and {env_file}).", file=sys.stderr)
        sys.exit(1)

    if args.mode == "test":
        movie_target = args.movies or 250
        tv_target = args.tv or 250
    else:
        movie_target = args.movies or 12500
        tv_target = args.tv or 7500

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Source of truth for "already done" is the checkpoint file itself.
    done_ids = load_done_ids_from_checkpoint()
    state = load_state()
    state["done_ids"]["movie"] = list(done_ids.get("movie", set()))
    state["done_ids"]["tv"] = list(done_ids.get("tv", set()))
    save_state(state)

    print(f"Resuming with {len(done_ids['movie'])} movies and {len(done_ids['tv'])} tv already checkpointed.")

    checkpoint_lock = threading.Lock()

    with open(CHECKPOINT_PATH, "a") as checkpoint_file:
        for media_type, target in (("movie", movie_target), ("tv", tv_target)):
            already_done = done_ids.get(media_type, set())
            remaining_target = max(target - len(already_done), 0)
            if remaining_target == 0:
                print(f"[{media_type}] target of {target} already met by checkpoint ({len(already_done)} done). Skipping discovery.")
                continue

            print(f"[{media_type}] discovering ids (need {remaining_target} more, have {len(already_done)})...")
            discovered = collect_discovery_list(media_type, api_key, remaining_target, args.min_vote_count)

            # Filter out anything already checkpointed (idempotency).
            to_fetch = [i for i in discovered if i not in already_done]
            print(f"[{media_type}] {len(to_fetch)} new ids to fetch (target {target}).")

            if not to_fetch:
                continue

            completed, failed = run_fetch_phase(
                media_type, to_fetch, api_key, checkpoint_lock, checkpoint_file,
                done_ids.setdefault(media_type, set()), state,
            )
            print(f"[{media_type}] done: {completed} fetched, {failed} failed this run.")

    # -----------------------------------------------------------------
    # Build final corpus.parquet from the checkpoint file (source of truth)
    # -----------------------------------------------------------------
    print("Building corpus.parquet from checkpoint...")
    records = []
    seen = set()
    with open(CHECKPOINT_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            key = (rec["media_type"], rec["id"])
            if key in seen:
                continue  # last-write-wins would be nicer, but dedupe by first occurrence is fine here
            seen.add(key)
            records.append(rec)

    df = pd.DataFrame.from_records(records)
    if df.empty:
        print("WARNING: no records collected — not writing corpus.parquet", file=sys.stderr)
        sys.exit(1)

    # Drop rows with null/empty soup (would break CountVectorizer downstream).
    before = len(df)
    df = df[df["soup"].fillna("").str.strip() != ""]
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped} rows with empty soup.")

    df["genres"] = df["genres"].apply(lambda g: g if isinstance(g, list) else [])

    df.to_parquet(CORPUS_PATH, index=False)
    print(f"Wrote {len(df)} rows to {CORPUS_PATH}")
    print(df["media_type"].value_counts().to_dict())


if __name__ == "__main__":
    main()
