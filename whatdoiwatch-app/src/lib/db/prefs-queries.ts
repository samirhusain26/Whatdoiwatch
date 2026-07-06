// Typed query layer over the on-device `prefs` key/value table
// (client-schema.ts + device-client.ts). Backs anonymous device identity,
// last-used filters, and the liked-title list (IMPLEMENTATION_PLAN.md 3.1/3.4).
//
// Branches on Platform.OS: native uses the real expo-sqlite-backed deviceDb;
// web uses a localStorage fallback (web-storage.ts) — see device-client.ts.

import { Platform } from "react-native";
import { eq } from "drizzle-orm";
import * as SecureStore from "expo-secure-store";

import { deviceDb } from "@/lib/db/device-client";
import { prefs } from "@/lib/db/client-schema";
import { webPrefs } from "@/lib/db/web-storage";
import type { Era, MediaFilter, MediaItem } from "@/lib/media";

const DEVICE_ID_KEY = "device_id";
const LAST_FILTERS_KEY = "last_filters";
const LIKED_TITLES_KEY = "liked_titles";

const isWeb = Platform.OS === "web";

/** Reads a JSON-valued pref, falling back to `fallback` if absent. */
async function getPref<T>(key: string, fallback: T): Promise<T> {
  if (isWeb) return webPrefs.get(key, fallback);
  const rows = await deviceDb.select().from(prefs).where(eq(prefs.key, key));
  const row = rows[0];
  if (!row || row.value == null) return fallback;
  return row.value as T;
}

/** Writes a JSON-valued pref, overwriting any existing value. */
async function setPref<T>(key: string, value: T): Promise<void> {
  if (isWeb) return webPrefs.set(key, value);
  await deviceDb
    .insert(prefs)
    .values({ key, value: value as unknown })
    .onConflictDoUpdate({ target: prefs.key, set: { value: value as unknown } });
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for runtimes without crypto.randomUUID (older Hermes/web).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Returns the persisted anonymous device id, generating and storing one on
 *  first access if none exists yet. Native: expo-secure-store. Web:
 *  localStorage (SecureStore has no web implementation). The id is also
 *  mirrored into `prefs` on native so it's visible alongside other prefs
 *  (e.g. for a future Supabase upgrade that pushes the whole local DB). */
export async function getDeviceId(): Promise<string> {
  if (isWeb) {
    if (typeof localStorage === "undefined") return generateId();
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  }

  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = generateId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  await setPref(DEVICE_ID_KEY, id);
  return id;
}

export interface PersistedFilters {
  media: MediaFilter;
  genre: string;
  era: Era;
  rating: number;
}

export async function getLastFilters(): Promise<PersistedFilters | null> {
  return getPref<PersistedFilters | null>(LAST_FILTERS_KEY, null);
}

export async function setLastFilters(filters: PersistedFilters): Promise<void> {
  await setPref(LAST_FILTERS_KEY, filters);
}

export async function getLikedTitles(): Promise<MediaItem[]> {
  return getPref<MediaItem[]>(LIKED_TITLES_KEY, []);
}

export async function setLikedTitles(titles: MediaItem[]): Promise<void> {
  await setPref(LIKED_TITLES_KEY, titles);
}
