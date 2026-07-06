// Config for the server DB only (titles / similar_titles / api_cache).
// The on-device client DB (client-schema.ts) has no drizzle-kit config —
// its tables are created at runtime via expo-sqlite migrations later; for
// now client-schema.ts just needs to type-check against device-client.ts.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/app.db",
  },
});
