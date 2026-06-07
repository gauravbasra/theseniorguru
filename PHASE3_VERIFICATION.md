# Phase 3 Verification

## What was actually changed

This ZIP contains real source changes, not just a design note.

Changed files:

- `apps/mobile/App.tsx`
- `apps/mobile-api/server.js`
- `apps/mobile-api/schema.sql`
- `apps/mobile-api/data/state.json`
- `apps/mobile-api/migrations/003_guru_companion_phase3_memory_story_music_calendar.sql`
- `GURU_COMPANION_PHASE3.md`

## Verified locally

- `apps/mobile-api/server.js` passed `node --check`.
- `apps/mobile/App.tsx` passed an esbuild TSX syntax bundle check with React Native and Expo dependencies externalized.
- Backend Phase 3 endpoints were started locally and tested with curl:
  - `GET /api/guru/memory`
  - `GET /api/guru/calendar`
  - `GET /api/guru/phase3`
  - `POST /api/guru/story`

## Not included

This is not a compiled APK. It is the updated source package. Build the APK from `apps/mobile/android` or with Expo/EAS after installing dependencies and setting `EXPO_PUBLIC_API_BASE_URL`.
