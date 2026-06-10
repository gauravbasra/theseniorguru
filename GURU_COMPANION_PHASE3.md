# Guru Companion Phase 3 — Real Code Patch

This package extends the Phase 2 mobile source with real Phase 3 code paths for:

- Memory graph UI inside the floating Guru widget
- Calendar/reminder UI inside the floating Guru widget
- Storyteller UI with comfort, family, and India-memory story modes
- Music companion UI with Hindi, calm, and devotional launch options
- Backend APIs for memory, calendar, storytelling, music, and phase 3 state
- SQL tables for persistent production storage

## Mobile files changed

- `apps/mobile/App.tsx`

Added to the floating Guru widget:

- `Memory` quick action
- `Calendar` quick action
- `Story` quick action
- `Music` quick action
- memory input + save flow
- calendar/reminder input + save flow
- story panel
- music panel with YouTube deep-link fallback

## Backend files changed

- `apps/mobile-api/server.js`
- `apps/mobile-api/schema.sql`

New/updated endpoints:

- `GET /api/guru/memory`
- `POST /api/guru/memory`
- `GET /api/guru/calendar`
- `POST /api/guru/calendar`
- `GET /api/guru/phase3`
- `POST /api/guru/story`
- `POST /api/guru/music`
- enhanced `POST /api/guru/chat` intent routing for memory, calendar, story, and music

## Production connector notes

The music endpoint currently returns a YouTube search URL fallback. Production integrations should replace this adapter with Spotify, Apple Music, or YouTube Music OAuth flows.

The storyteller endpoint currently uses deterministic server-side composition. Production should route through the AI orchestration service with safety filters, memory permissions, and caregiver visibility controls.

The calendar endpoint stores internal reminders now. Production can add Google Calendar / Apple Calendar connectors after consent.

## Run

From `apps/mobile-api`:

```bash
npm install
npm start
```

From `apps/mobile`:

```bash
npm install
EXPO_PUBLIC_API_BASE_URL=http://localhost:4187 npm start
```

On device, replace localhost with your machine LAN IP.
