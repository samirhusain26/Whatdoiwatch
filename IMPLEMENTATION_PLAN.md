# What Do I Watch — Implementation Plan

The single plan for the app. The Netflix + Linear reskin already shipped — see [docs/UI.md](docs/UI.md) for tokens and primitives; nothing here changes those.

**The pivot (July 2026):** movie night is out — spun off as its own generalized group-decision project (seed doc: `~/Personal/code_projects/GROUP_NIGHT_IDEA.md`). This app is now about **sending recommendations to friends**. I watch something great, I flick it to the friend it fits, it lands in their inbox, they add it to their watchlist — and when they finally watch it, I find out how it landed. The app learns each person's taste from their reactions so it can say, before you send, "87% match for Alex."

Two ideas the build hangs on:

1. **One screen.** Five tabs collapse into a single main screen — a composer bar over a poster grid — with everything else summoned as a sheet. (Unchanged from the previous plan.)
2. **Recs between friends are the product.** Solo browsing and rating is the engine — it's how taste profiles get built — but the hero loop is: watch → react → send to the right friend → they add it → they watch it → you find out. Judge every feature by whether it makes that loop tighter.

Old tabs → new homes: Home → main screen, Surprise → Spin sheet, Swipe → Deck sheet, Watchlist → Shelf sheet, Movie Night → gone (replaced by the Friends/Inbox surface).

**Ground rules for whoever implements this:** all changes stay local — no branches, no commits, no pushes. Samir commits manually when happy. Run phases straight through without stopping for review; the app should stay runnable between phases. Definition of done: the full Phase 7 verification passes on web, and native-only items are written up in [docs/NATIVE_CHECKLIST.md](docs/NATIVE_CHECKLIST.md) for Samir to run on a simulator — don't claim those as verified.

---

## Part 1 — The reaction model (solo taste)

Unchanged from the previous plan, and now load-bearing twice over: reactions drive exclusions *and* feed the taste embeddings (Part 5). One five-state model used identically everywhere — deck, long-press bar, detail sheet, Shelf:

| Reaction | Meaning | Effect |
| --- | --- | --- |
| **Want to watch** | Haven't seen it, save it | Shelf list; excluded from grid/deck/spin; **0.5× taste weight** |
| **Loved it** (double thumbs) | Seen it, all-timer | **1.5× taste weight**; excluded everywhere |
| **Liked it** (thumbs up) | Seen it, would recommend | 1× taste weight; excluded everywhere |
| **Not for me** (thumbs down) | Seen it, didn't land | Excluded everywhere; **never** downranks similar titles, contributes nothing to the taste vector |
| *(no reaction)* | Haven't seen it / don't care | Nothing logged |

Notes:

- Weights apply both in the classic recommender (weighted seeds — a per-seed multiplier in `src/lib/recommender.ts`, not counting a title twice) and in the taste-vector average (Part 5). Manual taste-profile seeds count at 1×.
- Disliked is exclude-only. No negative weighting anywhere — thumbs-down on *Marriage Story* shouldn't nuke all dramas.
- "Not Interested" and "Seen It" disappear as concepts. Migration: legacy `seen` rows → liked, `not_interested` → disliked.

**Reaction surfaces** (same four options everywhere, same order — bookmark, thumbs-down, thumbs-up, double-thumbs):

1. **Long-press bar** — long-press any poster and a floating bar appears with the four reaction icons **plus a Send icon** (Part 4). Where the reaction excludes the title from the surface (the grid), the tile animates out with a 4-second **Undo** toast; undo restores tile and clears the reaction. Build the toast as a small shared primitive.
2. **Detail sheet buttons** — the same four as regular buttons, plus Send. Tapping an active one clears it.
3. **Deck gestures** — see 2.4.

The main grid shows no reaction badges — reacted titles are excluded from it anyway; state lives in Shelf.

---

## Part 2 — The solo shell

### 2.1 Main screen

Route: `src/app/index.tsx`. The `(tabs)` group and `NativeTabs` layout are deleted.

**Header** (one row): app wordmark left; small icons right — `rectangle.stack` (Deck), `dice` (Spin), `bookmark` (Shelf), and a **person icon (Friends)** with an unread badge when the inbox has new recs. ~24px, `ink-secondary`, no labels.

**Composer bar, at rest**: a single `Panel` bar under the header, placeholder "What's the mood?".

**Inbox banner**: when unread recs exist, a slim full-width strip under the composer — "3 new from friends" with sender avatars — tapping opens the Inbox (Part 4). This replaces the old Movie Night CTA as the one red accent at rest. No unread → no strip; the grid breathes.

Scroll behavior: header + bar + strip scroll away going down, reappear the moment you scroll up (Safari-style). The scroll-up reappearance matters more than the hiding.

**Composer bar, expanded** (tap it): floats **over** the grid with a dim scrim — the grid never reflows. Tap outside or Done to collapse; results update behind the scrim as chips toggle. Contents:

- **Mood chips** — curated moods (Tense, Cozy, Mind-bending, Feel-good, Gritty, Epic, Funny, Slow burn) + practical chips (Under 2h, Background-watchable, With parents, Date night). Any combination; params combine by **intersection**. Mappings in `src/lib/moods.ts` so tuning is a data edit.
- **Seed titles** — "like ___" chips via the existing title search (absorbs `TitleSearch`); picks render as poster-thumbnail chips.
- **Fine-tune row** — media type, genre, era, min rating. Mood chips pre-fill these. **Conflict rule:** manually editing fine-tune deselects all mood chips; practical chips that don't overlap (Under 2h) survive.
- **Mode row** — Deck / Spin buttons duplicating the header entries. Both inherit current chips/filters.

**Zero matches**: auto-relax — drop practical chips first, then moods — with a one-line banner ("Nothing matched exactly — relaxed Under 2h"). `/api/surprise` already implements this; generalize it.

**Grid**: the existing `TitleGrid`/`TitleCard` feed. No chips/seeds → the **For You feed** (taste-ranked once embeddings land — Part 5; generic discover until then). Anything set → recommendations. Pull-to-refresh carries over. Exclude list covers want-to-watch + all three watched states.

**Persistence**: composer state persists via `getLastFilters`/`setLastFilters` — extend the shape, don't add a parallel store.

**Wide viewports**: one centered max-width column (~720px); grid grows to 4–5 poster columns.

### 2.2 Sheets, generally

- Native: expo-router routes with `presentation: "formSheet"`. Known risk: sheet drag-to-dismiss can fight the deck's pan gestures; if so, disable drag-dismiss on the deck route only.
- Desktop web: same routes render as centered modals (~560px) over a dimmed grid.
- Routes: `src/app/deck.tsx`, `spin.tsx`, `shelf.tsx`, `friends.tsx`, `inbox.tsx`, `send.tsx` (Part 4). Title detail stacks on top of any of them.

### 2.3 Teaching invisible gestures

Two one-time hints, flagged in prefs: first Deck open (~2s overlay diagramming swipes + double-tap), and first long-press surface ("Hold for quick reactions"). Nothing is gesture-only — every reaction also exists as detail-sheet buttons.

### 2.4 Deck sheet

The deck from `swipe.tsx`, resourced through composer filters, with reaction-model gestures:

- Swipe **right** → liked it (stamp "LIKED IT", green) · **Double-tap** → loved it (heavier haptic, card flies off) · Swipe **left** → not for me (red) · **up** → want to watch (white/ink) · **down** → skip, log nothing (grey)
- **Single tap flips the card** — overview, rating, runtime on the back. The ~250ms tap-vs-double-tap delay lands on the flip, where it's imperceptible.

Haptics on everything except down. Update `SwipeCard.tsx` stamps/thresholds; LIKE/NOPE/SKIP vocabulary is gone.

**Session shape**: ~20 cards; a summary card replaces the last one — "Rated 7 · Saved 3 · Skipped 10" — with **New deck** (same filters, excluding everything seen) and **Done**. The deck is also the cold-start tool: fastest way to feed the taste engine (5.5).

### 2.5 Spin sheet

- Read-only summary of active chips + one large "Spin" `PrimaryButton`.
- On spin: medium haptic, ~800ms shuffle (cycle 4–6 `tile-deep` shimmer tiles), then the pick lands as the full-bleed backdrop card.
- No repeats within a session (component state → exclude param). "Spin again" below the card. Relaxed-filters banner and the "10 similar picks" grid carry over from `surprise.tsx`; similar picks support the long-press bar.

### 2.6 Shelf sheet

Full-height sheet, sections in one scroll (`SectionLabel` headers):

1. **Want to watch** — the watchlist grid. Titles that arrived via a friend show a small sender chip on the tile ("from Alex").
2. **Watched** — one grid for loved/liked/disliked, corner badge per tile, filter chips: All / Loved / Liked / Not for me. Denser tiles, no gradient overlay.
3. **Taste profile** — manually-chosen seed chips, removable, plus a one-liner of what the app thinks you're into (top genres/keywords from the taste vector — a readout, not a control). "These shape your recommendations — so does everything you've rated."

Long-press works here too — the natural place to change a rating. **Rating a title that a friend sent closes the loop** (Part 4.4) — no extra step.

### 2.7 Detail sheet

`TitleDetailSheet.tsx` gets the four reaction buttons plus **Send to a friend**. Active states: want-to-watch green (`bg-success`), loved/liked red (`bg-accent`, loved shows double-thumb), disliked raised-grey. If the title was sent to you, the sheet shows who sent it and their note.

---

## Part 3 — Accounts + friends

### 3.1 Supabase, and what moves server-side

Supabase is the backend: auth, Postgres, row-level security — and pgvector for Part 5. The client talks to it directly via `supabase-js`; RLS is the security model, so write policies with care. The Expo API routes stay for what they're good at — proxying TMDB/Watchmode with secret keys and computing embeddings — but **user data (reactions, watchlist, friendships, recs, taste vectors) lives in Supabase**, because match scores and inboxes only work if the server can see everyone's state.

The local drizzle/SQLite store stops being the source of truth for user data. On first sign-in, import any existing local watchlist/reaction rows into the account (one-time, then mark done in prefs). Local SQLite can stay as a read cache if offline matters, but don't build sync machinery in v1 — online-first is fine.

### 3.2 Auth

- Email magic-link + Google OAuth via Supabase Auth. No passwords to store or forget.
- Sign-up asks exactly two things: a **username** (unique, lowercase, the friend-search handle) and an optional display name. Avatar = initial on a colored circle; photo upload is backlog.
- The app is usable signed-out (browse, spin, deck) but reactions prompt sign-in — taste has to belong to someone. Keep the prompt one tap, not a wall.

### 3.3 The friend graph

Mutual friendships, no followers:

- **Invite link** — everyone gets a personal link (`/add/[username]` on the web app). Opening it signed-in sends the request with one tap; signed-out, it lands on sign-up and then completes. This is also the growth loop — the link works for people who've never heard of the app.
- **Username search** — in-app search, send request, other side accepts. Requests are quiet (a row in the Friends sheet, no badge nagging).
- `friendships` table: requester, addressee, status (`pending` / `accepted`), timestamps. One row per pair, unique on the sorted pair.

### 3.4 Friends sheet

Route `friends.tsx`, opened from the header person-icon. One scroll: pending requests (if any) → friends list → "your invite link" share row → username search. Each friend row: avatar, name, **taste-twin percentage** once embeddings land (5.4), and a chevron into a friend detail view — recs exchanged with them, their recent public ratings. Keep it thin; this is a utility surface, not a social network profile.

---

## Part 4 — Recs (the hero loop)

### 4.1 Sending

From the long-press bar or detail sheet, **Send** opens a small sheet: friend list with avatars, each row showing the **match score** for this title ("87% for Alex" — Part 5), sorted by score. Multi-select friends, optional short note (one line, placeholder "why they'll like it"), Send. Duplicate guard: if you already sent this title to this friend, the row says so and won't double-send.

`recs` table: sender, recipient, title (media_type + tmdb id), note, status (`unseen` / `added` / `declined` / `already_seen`), rating shared-back fields, timestamps.

### 4.2 The inbox

Route `inbox.tsx`, opened from the header badge / grid strip. A stack of rec cards — poster, title, sender avatar + note, match score *for you* — newest first. Three actions per card:

- **Add** → goes onto your watchlist (tagged "from Alex"), card leaves the inbox, sender learns it landed.
- **Not for me** → card leaves quietly. **Declines are private** — the sender never finds out; the status they see stays "sent". Nobody should hesitate to decline.
- **Seen it already** → prompts the reaction bar (loved/liked/not-for-me); your rating is logged and — since they cared enough to send it — shared back to the sender.

Inbox rec of a title you've already reacted to gets auto-flagged "you've seen this" with your rating pre-filled.

### 4.3 What the sender sees

A "Sent" section in the Friends sheet (or friend detail view): each rec with its status — sent → **added** → **watched, with their rating**. The payoff moment is the last one: "Alex loved *Heat*". Declines render as plain "sent" forever. No timestamps-as-pressure, no "seen 3 days ago".

### 4.4 Closing the loop

When a recipient rates a title that's on their shelf *via a rec* (from the Shelf long-press, deck, or detail sheet — any normal rating path), the rec row updates automatically and the sender's Sent view shows the rating. No separate "tell Alex what you thought" chore — rating is the reply.

### 4.5 Notifications, v1

**In-app badge only**: header person-icon badge + the grid strip. No push, no email in v1 — that plumbing (and its deliverability/DX tax) is backlog, and push naturally arrives with the native build. Recs sitting unseen for days is an accepted v1 weakness; note it in the backlog entry.

---

## Part 5 — The taste engine (embeddings)

### 5.1 Title embeddings

- Model: **gte-small** (384-dim) run locally via `transformers.js` — no API key, no per-call cost. It runs in the Expo API route's Node context; first-load model download (~30MB) is a one-time server cost.
- Embed text: `title. genres. keywords. overview.` — one string, embedded once per title.
- Lazy pipeline: when any API route serves a title whose embedding is missing, queue an embed-and-upsert (fire-and-forget, batched). Plus a backfill script (`scripts/embed-titles.ts`) to pre-warm the popular-titles corpus so day one isn't cold.
- Storage: `title_embeddings` table in Supabase with a pgvector column, keyed on (media_type, tmdb_id). Cosine distance, ivfflat/HNSW index when the table grows past a few thousand rows.

### 5.2 Taste vectors

- A user's taste vector = **weighted mean of their reacted titles' embeddings**: loved 1.5×, liked 1×, want-to-watch 0.5×, manual seed chips 1×. Disliked contributes nothing.
- Stored on the profile row; recomputed on every reaction write (a few dozen vector adds — do it in the API route or a Postgres function, whichever is less code).
- **Cold start**: below 5 rated titles, no match scores and no For You ranking — surfaces show a gentle "rate a few titles so we can learn your taste" pointing at the Deck. Never show a confident percentage built on two data points.

### 5.3 Match score

`match(title, user) = cosine(title_embedding, user_taste_vector)` mapped to a friendly 0–100. Calibrate the mapping so mid-cosine values don't all read as 50s — check the spread against Samir's own ratings and pick the linear stretch that makes loved titles land 80+. Surfaces: the Send sheet (per-friend), the Inbox (for you), the detail sheet (your own score, small and quiet).

### 5.4 For You feed + similar titles + taste twins

- **For You**: the default no-filter grid reranks the discover pool by taste-vector cosine (fetch a wide candidate pool from TMDB discover, rerank server-side, exclude reacted titles). Composer filters still constrain the pool first — taste ranks *within* what you asked for.
- **Similar titles**: "more like this" and seed-chip browsing use embedding nearest-neighbors, replacing (or blending with — try pure first) the genre/keyword/cast recommender in `src/lib/recommender.ts`. Keep the old recommender as fallback while the embedding table is sparse.
- **Taste twin**: `cosine(userA_vector, userB_vector)` as a percentage on each friend row ("you and Alex are 74% aligned"). Same calibration caveat as 5.3. Pure social glue — it drives friend-adding, costs one dot product.

### 5.5 Honesty rules

Scores only render when both vectors are past cold start. When a match score is shown for a friend, it's computed from their taste vector — never expose *what* they rated (ratings are private except recs' shared-backs and whatever surfaces on the friend detail view as "recent public ratings" — gate that behind a per-user toggle, default on, in a small settings row).

---

## Part 6 — Shared plumbing

### 6.1 Supabase schema

- [ ] `profiles`: id (auth uid), username (unique), display_name, taste_vector (pgvector), rated_count, share_ratings boolean, created_at.
- [ ] `reactions`: user, media_type, tmdb_id, state enum (`want_to_watch | watched_loved | watched_liked | watched_disliked`), via_rec_id nullable, timestamps. (This replaces the local watchlist table as source of truth.)
- [ ] `taste_seeds`: user, media_type, tmdb_id (the manual "like ___" profile chips).
- [ ] `friendships`: user_a, user_b (sorted pair, unique), requester, status, timestamps.
- [ ] `recs`: sender, recipient, media_type, tmdb_id, note, status, shared_rating nullable, timestamps. Unique on (sender, recipient, title).
- [ ] `title_embeddings`: media_type, tmdb_id, embedding vector(384), embedded_at.
- [ ] RLS on everything: reactions/seeds are owner-only (plus the aggregate paths the taste engine needs — use security-definer functions for match-score reads rather than opening friends' reactions); recs visible to sender + recipient; friendships to both parties; profiles readable by friends + username search (username/display_name only).

### 6.2 Recommender & API

- [ ] `src/lib/recommender.ts`: seeds become `{ media_type, id, weight }`; score contribution multiplies by weight. Update all call sites.
- [ ] `/api/discover` + `/api/recommendations`: accept `keywords` + `runtime_lte`; auto-relax on thin results with the `relaxed`/`relaxedNote` shape from `/api/surprise`; optional taste-rerank param once 5.4 lands.
- [ ] `/api/search`: confirm poster, year, media_type in `SearchResponse`; add if missing.
- [ ] `/api/embed` internals: the lazy embed-and-upsert path + `scripts/embed-titles.ts` backfill.

### 6.3 New modules

- [ ] `src/lib/moods.ts`: chip definitions `{ id, label, kind: "mood" | "practical", params }` + intersection combiner with relax drop-order. First-pass mappings are a guess; that's why it's data.
- [ ] `src/lib/supabase.ts`: client, typed helpers for reactions/friends/recs.
- [ ] `src/lib/taste.ts`: pure functions — weighted-mean vector, cosine, score calibration, cold-start gate. Jest-test these hard; they're the product's brain.

### 6.4 Prefs

- [ ] Extend persisted filters with selected chip ids.
- [ ] Hint flags: `hint_deck_gestures`, `hint_long_press`; `local_import_done`.

---

## Part 7 — Build checklist

Ordered so the app stays runnable between phases. Local changes only — no commits. Supabase project: Samir creates it and drops the URL + anon key in `.env` before Phase 3 starts (flag this as the one blocking hand-off).

### Phase 1 — Reactions + recommender (still local)
- [ ] Status enum migration in the local db, query renames, shared `setReaction`/`clearReaction` write path. Update every call site so the existing five-tab app still runs.
- [ ] Weighted seeds in recommender + API params (6.2).
- [ ] Detail sheet → four reaction buttons. Independently shippable.
- [ ] `src/components/ReactionBar.tsx` + shared `Toast` with undo; wire into `TitleCard` via long-press.
- [ ] Jest: migration mapping, weighted seed assembly (dedupe, highest weight wins, 1.5×).

### Phase 2 — Composer + main screen + solo sheets
- [ ] `src/lib/moods.ts` + API additions + shared relax. Jest for combiner + relax order.
- [ ] `src/components/Composer.tsx`: collapsed ↔ scrim overlay, chips, seeds (absorb `TitleSearch`), fine-tune conflict rule, mode row.
- [ ] New `src/app/index.tsx`: header (incl. person icon, badge stubbed), composer, grid, scroll-away chrome, persistence, wide-viewport column. Old tabs stay routable during transition.
- [ ] Deck, Spin, Shelf sheets per 2.4–2.6 (sender chips + taste readout stubbed until later phases). Sheet presentation setup.
- [ ] Delete `(tabs)`, `swipe.tsx`, `surprise.tsx`, `watchlist.tsx`, `group.tsx` once parity confirmed.

### Phase 3 — Supabase foundation
- [ ] Schema + RLS (6.1), `src/lib/supabase.ts`.
- [ ] Auth flow: magic link + Google, username claim screen, signed-out browse with sign-in-on-react prompt.
- [ ] Reactions/watchlist reads+writes move to Supabase; one-time local import on first sign-in.
- [ ] Shelf + grid exclusions verified against the cloud store.

### Phase 4 — Friends
- [ ] Friendships table flows: request, accept, remove.
- [ ] `friends.tsx` sheet: requests, list, invite-link share row, username search.
- [ ] `/add/[username]` web route: signed-in one-tap request; signed-out → sign-up → completes.

### Phase 5 — Recs
- [ ] `recs` table + send sheet (multi-select, note, duplicate guard; match scores stubbed as "—" until Phase 6).
- [ ] `inbox.tsx`: card stack, Add / Not for me / Seen it (with reaction bar), already-reacted auto-flag. Header badge + grid strip driven by unseen count.
- [ ] Sender's Sent view with status progression; decline-privacy verified (status stays "sent").
- [ ] Close-the-loop: rating a via-rec shelf title updates the rec + shared_rating.
- [ ] Jest: rec status transitions, decline privacy, duplicate guard.

### Phase 6 — Taste engine
- [ ] `title_embeddings` + transformers.js gte-small in the API route; lazy embed path + backfill script; run the backfill against the current discover corpus.
- [ ] `src/lib/taste.ts` + taste-vector recompute on reaction writes. Jest: weighted mean, cold-start gate, calibration function.
- [ ] Match scores into Send sheet, Inbox, detail sheet — with cold-start fallbacks.
- [ ] For You reranking on the no-filter grid; embedding nearest-neighbors for similar-titles (old recommender as sparse-table fallback); taste-twin % on friend rows.
- [ ] Shelf taste readout (top genres/keywords).

### Phase 7 — Verify
- [ ] Web pass (the done bar — actually drive it in a browser): composer expand/collapse + relax banner + conflict rule, all sheets as desktop modals, deck flip/summary/refill, long-press bar + undo everywhere, Shelf filters, persistence across relaunch.
- [ ] Accounts: two browser profiles → sign up both, friend via username search *and* via invite link, verify RLS by attempting cross-user reads with the anon key.
- [ ] Rec loop end-to-end: A sends with note → B's badge + strip + inbox → Add (A sees "added") → B rates from Shelf (A sees rating) → separately: Decline (A still sees "sent") and Seen-it path.
- [ ] Taste: rate 10+ titles on A → For You visibly reorders, match scores render, cold-start copy shows on fresh account B, taste-twin appears once both are warm.
- [ ] Local-import on first sign-in carries pre-account watchlist rows.
- [ ] Logic tests green (`npx jest`).
- [ ] Write [docs/NATIVE_CHECKLIST.md](docs/NATIVE_CHECKLIST.md): deck gestures/flip feel, formSheet drag vs deck pan, scroll-away chrome, haptics, hints, OAuth redirect on native, share sheet for invite links.
- [ ] Update [docs/UI.md](docs/UI.md) with Composer, ReactionBar, Toast, Inbox card, sheet presentation, reaction model; delete `FilterBar.tsx`/`TitleSearch.tsx` if nothing imports them.

---

## Part 8 — Ship it (Samir's steps)

Recs aren't real until a friend's phone shows the badge. Needs cloud credentials, so not the agent's job — but it's the immediate next action:

- [ ] Supabase project already hosted (created before Phase 3) — flip on prod auth settings (site URL, OAuth redirect allowlist, disable email autoconfirm if it was on for dev).
- [ ] Deploy web + API routes to **EAS Hosting**; set `origin` in app config so native builds call the hosted server. Secrets in the dashboard: `TMDB_API_KEY`, `WATCHMODE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (+ service key for API routes if the embed path needs it).
- [ ] Run the embedding backfill against prod.
- [ ] Run [docs/NATIVE_CHECKLIST.md](docs/NATIVE_CHECKLIST.md) on a simulator.
- [ ] Send your invite link to real friends and fire the first real recs. That's the launch test.

---

## Part 9 — Store submission (blocked on developer accounts)

- [ ] EAS Build for iOS + Android, bundle ID `com.samirhusain.whatdoiwatch`, display name **What Do I Watch**.
- [ ] **iOS**: TestFlight internal track, privacy manifest (account email + username; no tracking), App Store review.
- [ ] **Android**: Play Console, internal track, Data Safety form. *New personal accounts need closed testing with 12+ testers for 14 days.*
- [ ] Store assets: icons, splash, screenshots, listing copy.

---

## Backlog

- **Push notifications** (with the native build) and **email digests** for unseen recs — the accepted v1 gap.
- **Quick reactions/thanks** on a rec (emoji back) without rating.
- **Guest recs** — send to a non-user as a link; lands in their inbox if they sign up.
- **Collaborative filtering** — real user-user signals once there's a user base; premature now.
- **Avatar upload**, richer friend profiles.
- **Mood mapping tuning pass** after a week of real use.
- **Blend embedding + classic recommender scores** if pure-embedding similar-titles feels off.
- **Component tests** for Composer, ReactionBar, Inbox.
- **Group night** — the spun-out project (`~/Personal/code_projects/GROUP_NIGHT_IDEA.md`); if it gets built, a "start a group night from this watchlist" bridge belongs here.
