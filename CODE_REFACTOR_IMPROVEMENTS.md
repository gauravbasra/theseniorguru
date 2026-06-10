# TheSeniorGuru code improvements

This package refactors the mobile and API code without changing the visible resident experience.

## Mobile improvements

- Moved the screen route union, tab definitions, dev-session emails, and first-screen routing into `apps/mobile/src/navigation/routes.ts`.
- Moved Guru Companion message, scan, memory, calendar, music, and safety types into `apps/mobile/src/features/guru/types.ts`.
- Moved scan labels and local intent routing into `apps/mobile/src/features/guru/guruIntents.ts`.
- Added `apps/mobile/src/features/guru/guruApi.ts` as the mobile API boundary for Guru chat, tasks, memory, calendar, story, music, scan, health, wearable, safety, and AR calls.
- Updated `apps/mobile/App.tsx` to use the route module and Guru modules instead of keeping all business logic inline.

## Backend improvements

- Added `apps/mobile-api/lib/guru-intents.js` so JSON demo mode and production PostgreSQL mode use the same deterministic Guru intent rules.
- Updated `/api/guru/chat` in `server.js` and `production-server.js` to call the shared intent resolver instead of duplicating long if/else logic.

## Verification performed

- `node --check apps/mobile-api/server.js`
- `node --check apps/mobile-api/production-server.js`
- loaded and exercised `apps/mobile-api/lib/guru-intents.js`
- TypeScript parse smoke checked the changed mobile files. Full mobile typecheck requires installing Expo/React Native dependencies with `npm ci` in `apps/mobile`.

## Next recommended refactor

The next high-value refactor is to extract `GuruCompanionWidget` from `App.tsx` into `src/features/guru/GuruCompanionWidget.tsx`. That should be done carefully because the widget currently references shared styles and small UI primitives from `App.tsx`.
