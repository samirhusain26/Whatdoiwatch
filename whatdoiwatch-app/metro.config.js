const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend (wa-sqlite/OPFS) ships a .wasm file that Metro's
// default resolver.assetExts doesn't include, so it tries to resolve it as a
// JS module instead of a static asset ("Unable to resolve module
// ./wa-sqlite/wa-sqlite.wasm"). Native iOS/Android never hits this path (only
// the web SQLite backend imports wa-sqlite) — this only matters for `expo
// start --web` using the client-side watchlist DB (expo-sqlite).
config.resolver.assetExts.push("wasm");

module.exports = withNativeWind(config, { input: "./src/global.css" });
