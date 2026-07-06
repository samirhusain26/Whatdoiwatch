// Server DB drizzle client — Node.js only (Expo API routes run in Node, not
// on-device), backed by Node's built-in `node:sqlite` module against the
// read-only seeded DB file at whatdoiwatch-app/data/app.db. Do NOT import
// this from app/, components/, or anything that bundles for native/web
// client — use device-client.ts there.
//
// Uses node:sqlite (not the better-sqlite3 npm package) because it's a
// genuine Node stdlib module: Metro's API-route bundler already externs
// Node built-ins cleanly via its own $$require_external mechanism, whereas
// better-sqlite3's native-binary loader (the `bindings` package) trips
// Metro's static bundler with a webpack-only `__non_webpack_require__`
// reference Metro doesn't define.

import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import path from "node:path";

import * as schema from "@/lib/db/schema";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");

export const db = drizzle({ client: sqlite, schema });
