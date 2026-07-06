// On-device client DB — runs inside the app (native/web runtime) via
// expo-sqlite, NOT inside API routes (those are Node.js and use client.ts +
// node:sqlite instead). Backs the Phase 3 watchlist/prefs tables.
//
// Web has no viable expo-sqlite backend in local dev: its OPFS/wa-sqlite
// backend needs SharedArrayBuffer, which browsers only expose behind
// Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy headers the Expo
// dev server doesn't set. Per the plan ("wa-sqlite/OPFS or localStorage
// fallback on web"), web uses a localStorage-backed implementation instead
// (see web-storage.ts) — deviceDb below is never constructed or used on web.

import { Platform } from "react-native";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "@/lib/db/client-schema";

export const deviceDb =
  Platform.OS === "web"
    ? (null as unknown as ReturnType<typeof drizzle<typeof schema>>)
    : drizzle(openDatabaseSync("whatdoiwatch.db"), { schema });
