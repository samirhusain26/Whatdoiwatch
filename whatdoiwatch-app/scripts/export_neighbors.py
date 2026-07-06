#!/usr/bin/env python3
"""
export_neighbors.py — Phase 2.2 of the What Do I Watch implementation plan.

Input:  data/corpus.parquet (produced by build_dataset.py)
Steps:  1. One CountVectorizer(stop_words='english') fit across the ENTIRE
           combined soup column (movies + TV together in one matrix — this is
           what makes cross-type recommendations fall out for free).
        2. cosine_similarity computed ONCE over the full matrix (the legacy
           Flask app's bug was recomputing this per request).
        3. For each title, top 20 neighbors by cosine similarity, excluding
           itself.
Output: data/neighbors.json    — keyed by "{media_type}:{id}" -> list of
                                  {media_type, tmdb_id, score}
        data/titles_meta.json  — keyed by "{media_type}:{id}" -> basic
                                  metadata (title, year, genres, vote_average)

Everything is keyed by (media_type, tmdb_id) — never by title string (fixes
the legacy Flask app's fragile title-based indexing).

Lives in whatdoiwatch-app/scripts/ — part of the manual corpus-refresh path
(build_dataset.py -> export_neighbors.py -> seed.ts). All paths are relative
to this script's location.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SCRIPT_DIR = Path(__file__).resolve().parent
PIPELINE_ROOT = SCRIPT_DIR.parent
DATA_DIR = PIPELINE_ROOT / "data"
CORPUS_PATH = DATA_DIR / "corpus.parquet"
NEIGHBORS_PATH = DATA_DIR / "neighbors.json"
TITLES_META_PATH = DATA_DIR / "titles_meta.json"

TOP_N = 20


def make_key(media_type: str, tmdb_id) -> str:
    return f"{media_type}:{tmdb_id}"


def main():
    parser = argparse.ArgumentParser(description="Export neighbor lists from corpus.parquet.")
    parser.add_argument("--corpus", type=str, default=str(CORPUS_PATH))
    parser.add_argument("--out-neighbors", type=str, default=str(NEIGHBORS_PATH))
    parser.add_argument("--out-meta", type=str, default=str(TITLES_META_PATH))
    parser.add_argument("--top-n", type=int, default=TOP_N)
    args = parser.parse_args()

    corpus_path = Path(args.corpus)
    if not corpus_path.exists():
        print(f"ERROR: corpus not found at {corpus_path}. Run build_dataset.py first.", file=sys.stderr)
        sys.exit(1)

    print(f"Loading corpus from {corpus_path}...")
    df = pd.read_parquet(corpus_path)
    df = df.reset_index(drop=True)

    n = len(df)
    print(f"Corpus has {n} titles "
          f"({(df['media_type'] == 'movie').sum()} movies, {(df['media_type'] == 'tv').sum()} tv).")

    if n == 0:
        print("ERROR: corpus is empty.", file=sys.stderr)
        sys.exit(1)

    soups = df["soup"].fillna("").tolist()

    print("Fitting CountVectorizer(stop_words='english') across the full combined soup column...")
    count = CountVectorizer(stop_words="english")
    count_matrix = count.fit_transform(soups)
    print(f"Vocabulary size: {len(count.vocabulary_)}")

    print("Computing cosine_similarity ONCE over the full matrix...")
    cosine_sim = cosine_similarity(count_matrix, count_matrix)

    media_types = df["media_type"].tolist()
    ids = df["id"].tolist()

    print(f"Computing top {args.top_n} neighbors per title...")
    neighbors = {}
    # argpartition for speed: get top (top_n+1) candidates (including self),
    # then sort just those, then drop self.
    k = min(args.top_n + 1, n)
    for i in range(n):
        row = cosine_sim[i]
        if k < n:
            candidate_idx = np.argpartition(row, -k)[-k:]
        else:
            candidate_idx = np.arange(n)
        candidate_idx = candidate_idx[np.argsort(row[candidate_idx])[::-1]]

        neighbor_list = []
        for j in candidate_idx:
            if j == i:
                continue
            neighbor_list.append({
                "media_type": media_types[j],
                "tmdb_id": int(ids[j]),
                "score": float(row[j]),
            })
            if len(neighbor_list) >= args.top_n:
                break

        key = make_key(media_types[i], ids[i])
        neighbors[key] = neighbor_list

        if (i + 1) % 2000 == 0 or (i + 1) == n:
            print(f"  {i + 1}/{n} titles processed")

    print(f"Writing {args.out_neighbors}...")
    with open(args.out_neighbors, "w") as f:
        json.dump(neighbors, f)

    print(f"Writing {args.out_meta}...")
    titles_meta = {}
    for _, row in df.iterrows():
        key = make_key(row["media_type"], row["id"])
        genres = row["genres"]
        if not isinstance(genres, list):
            genres = list(genres) if genres is not None else []
        titles_meta[key] = {
            "media_type": row["media_type"],
            "id": int(row["id"]),
            "title": row["title"],
            "year": int(row["year"]) if pd.notna(row["year"]) else None,
            "genres": genres,
            "vote_average": float(row["vote_average"]) if pd.notna(row["vote_average"]) else None,
        }
    with open(args.out_meta, "w") as f:
        json.dump(titles_meta, f)

    print("Done.")
    print(f"neighbors.json entries: {len(neighbors)}")
    print(f"titles_meta.json entries: {len(titles_meta)}")


if __name__ == "__main__":
    main()
