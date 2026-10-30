# What Do I Watch Agent Guide

The active product is the universal Expo application under `whatdoiwatch-app/`. Root-level legacy applications and `_legacy_backup/` are historical references.

## Read first

- Read `README.md` and the relevant architecture, UI, or database document under `docs/`.
- When working inside `whatdoiwatch-app/`, also follow its nested `AGENTS.md` and use the exact documented Expo version.

## Working rules

- Preserve the hybrid local-plus-live recommendation model and universal web/iOS/Android behavior.
- Keep the offline Python corpus pipeline outside runtime application code.
- Preserve the separate server SQLite corpus and device-local watchlist storage models.
- Keep API keys server-only and verify they are not bundled into client exports.
- Do not deploy, refresh the full paid/rate-limited corpus, or submit store builds without explicit authorization.
