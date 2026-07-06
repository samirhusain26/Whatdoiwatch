// Loads the ML pipeline's exported neighbor/title data into the server DB
// (`titles` + `similar_titles`). Run with: npx tsx scripts/seed.ts
//
// Reads from whatdoiwatch-app/data/ (scripts/build_dataset.py and
// scripts/export_neighbors.py live alongside this script and write their
// output there):
//   - titles_meta.json  keyed by "{media_type}:{id}", e.g. "movie:603"
//   - neighbors.json    keyed the same way, value = list of
//                       { media_type, tmdb_id, score } neighbor entries
//
// Corpus refresh procedure (manual, per the locked decision — rerun every
// few months when picks feel stale):
//   1. npx tsx scripts/build_dataset.py --mode full  (or plain python3, see README)
//   2. python3 scripts/export_neighbors.py
//   3. npx tsx scripts/seed.ts

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/node-sqlite";

import * as schema from "../src/lib/db/schema";

// SEED_DATA_DIR override exists only for testing this script against a
// fixture directory; normal usage always reads whatdoiwatch-app/data/.
const DATA_DIR = process.env.SEED_DATA_DIR ?? path.join(__dirname, "..", "data");
const TITLES_META_PATH = path.join(DATA_DIR, "titles_meta.json");
const NEIGHBORS_PATH = path.join(DATA_DIR, "neighbors.json");
const DB_PATH = path.join(__dirname, "..", "data", "app.db");

type MediaType = "movie" | "tv";

interface TitleMeta {
  media_type: MediaType;
  id: number;
  title: string;
  year: number | null;
  genres: number[];
  vote_average: number | null;
  poster_path: string | null;
  overview: string | null;
}

interface NeighborEntry {
  media_type: MediaType;
  tmdb_id: number;
  score: number;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function main() {
  if (!existsSync(TITLES_META_PATH) || !existsSync(NEIGHBORS_PATH)) {
    console.error(
      `Missing pipeline output. Expected:\n  ${TITLES_META_PATH}\n  ${NEIGHBORS_PATH}\n` +
        `Run data_pipeline/scripts/build_dataset.py + export_neighbors.py first.`,
    );
    process.exit(1);
  }

  const titlesMeta = loadJson<Record<string, TitleMeta>>(TITLES_META_PATH);
  const neighbors = loadJson<Record<string, NeighborEntry[]>>(NEIGHBORS_PATH);

  const sqlite = new DatabaseSync(DB_PATH);
  sqlite.exec("PRAGMA journal_mode = WAL");
  const db = drizzle({ client: sqlite, schema });

  const titleRows = Object.values(titlesMeta).map((t) => ({
    mediaType: t.media_type,
    id: t.id,
    title: t.title,
    year: t.year ?? null,
    genres: t.genres ?? [],
    voteAverage: t.vote_average ?? null,
    posterPath: t.poster_path ?? null,
    overview: t.overview ?? null,
  }));

  const similarRows: (typeof schema.similarTitles.$inferInsert)[] = [];
  for (const [key, neighborList] of Object.entries(neighbors)) {
    const [srcType, srcIdStr] = key.split(":");
    const srcId = Number(srcIdStr);
    for (const n of neighborList) {
      similarRows.push({
        srcType,
        srcId,
        dstType: n.media_type,
        dstId: n.tmdb_id,
        score: n.score,
      });
    }
  }

  console.log(
    `Seeding ${titleRows.length} titles and ${similarRows.length} similar_titles rows...`,
  );

  // Drizzle builds one SQL statement per .values() call by spreading every
  // row's params onto the call stack — with tens of thousands of rows that
  // blows Node's stack (RangeError: Maximum call stack size exceeded).
  // Chunk inserts to keep each statement's row count bounded.
  const CHUNK_SIZE = 500;
  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // node:sqlite's DatabaseSync has no .transaction() helper (unlike
  // better-sqlite3) — wrap manually.
  sqlite.exec("BEGIN");
  try {
    sqlite.exec("DELETE FROM similar_titles");
    sqlite.exec("DELETE FROM titles");
    for (const batch of chunk(titleRows, CHUNK_SIZE)) {
      db.insert(schema.titles).values(batch).onConflictDoNothing().run();
    }
    for (const batch of chunk(similarRows, CHUNK_SIZE)) {
      db.insert(schema.similarTitles).values(batch).run();
    }
    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }

  const titleCount = sqlite
    .prepare("SELECT COUNT(*) as c FROM titles")
    .get() as { c: number };
  const similarCount = sqlite
    .prepare("SELECT COUNT(*) as c FROM similar_titles")
    .get() as { c: number };

  console.log(
    `Done. titles=${titleCount.c} similar_titles=${similarCount.c}`,
  );

  sqlite.close();
}

main();
