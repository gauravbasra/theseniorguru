# Guru Companion Phase 1 — Real Implementation

This package adds the first runnable Guru Companion layer to the React Native / Expo mobile app.

## Mobile changes

File changed:

- `apps/mobile/App.tsx`

Added:

- Floating Guru button on resident screens
- Expandable chatbot panel
- Typed chat message flow
- Intent routing to app screens:
  - medication → Today
  - ride/doctor/transport → Help
  - lonely/talk/companion → Companion
  - food/meal/grocery/diapers/cleaning → Services
  - SOS/emergency/fall → Safety
- Quick actions:
  - Speak
  - Scan
  - Story
  - Music
  - Task
  - AR
- Local fallback logic so the widget still responds when the backend is unavailable
- Backend API calls when available:
  - `POST /api/guru/chat`
  - `POST /api/guru/tasks`
  - `POST /api/guru/scan-intents`

## Backend changes

Files changed/added:

- `apps/mobile-api/server.js`
- `apps/mobile-api/production-server.js`
- `apps/mobile-api/migrations/001_guru_companion_phase1.sql`

Added JSON/demo backend endpoints:

- `POST /api/guru/chat`
- `POST /api/guru/tasks`
- `POST /api/guru/scan-intents`
- `POST /api/guru/music`
- `POST /api/guru/story`

Added PostgreSQL-backed production endpoints:

- `POST /api/guru/chat`
- `POST /api/guru/tasks`
- `POST /api/guru/scan-intents`

Added migration tables:

- `guru_conversations`
- `guru_tasks`
- `guru_scan_intents`

## What is runnable now

This Phase 1 implementation is runnable as an app feature without adding new native dependencies.

Working now:

- floating widget
- open/close chat
- text chat
- intent routing
- task/reminder creation
- story response
- music deep-link
- scan/AR workflow intent creation
- backend persistence in demo JSON mode and production SQL mode after migration

## What is intentionally not native yet

These require Phase 2 native module integration:

- actual microphone recording
- speech-to-text
- text-to-speech playback
- camera capture
- image upload
- vision/OCR analysis
- real AR overlay

The UI and API contracts are in place so Phase 2 can add `expo-av`, `expo-camera`, speech/Realtime APIs, and vision analysis without redesigning the companion experience.

## Run notes

Mobile:

```bash
cd apps/mobile
npm install
npm run start
```

Backend demo mode:

```bash
cd apps/mobile-api
npm install
npm start
```

Production DB mode:

1. Apply base schema.
2. Apply `apps/mobile-api/migrations/001_guru_companion_phase1.sql`.
3. Start API with `DATABASE_URL` set.
