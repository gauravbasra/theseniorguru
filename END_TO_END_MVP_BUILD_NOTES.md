# TheSeniorGuru End-to-End MVP Foundation

This package extends the mobile app and backend into a Guru-first MVP foundation.

## Mobile updates

- Added `residentGuru` as the first resident route.
- Updated resident navigation to `Guru | Today | Help | Companion | Feed | Services | Safety | Settings`.
- Added a new Guru-first home screen inside `apps/mobile/App.tsx`.
- Guru home provides:
  - voice-first help entry
  - daily journey cards
  - medication quick confirm
  - trusted-circle entry
  - scan entry
  - story/music entry
  - safety entry
- Updated `guruApi.chat()` to prefer `/api/guru/orchestrate` and fall back to `/api/guru/chat`.
- Added `guruApi.loadDailyJourney()` and `guruApi.createVoiceSession()`.

## Backend updates

New JSON/demo-mode APIs in `apps/mobile-api/server.js`:

- `GET /api/guru/daily-journey`
- `POST /api/guru/orchestrate`
- `POST /api/guru/voice-session`

New production-mode APIs in `apps/mobile-api/production-server.js`:

- `GET /api/guru/daily-journey`
- `POST /api/guru/orchestrate`
- `POST /api/guru/voice-session`

New backend modules:

- `apps/mobile-api/lib/ai-client.js`
- `apps/mobile-api/lib/daily-journey.js`

New migration:

- `apps/mobile-api/migrations/005_end_to_end_guru_first_foundation.sql`

## How to run demo backend

```bash
cd apps/mobile-api
npm install
PORT=4199 npm start
```

Smoke test:

```bash
curl http://localhost:4199/api/guru/daily-journey
curl -X POST http://localhost:4199/api/guru/orchestrate \
  -H 'Content-Type: application/json' \
  -d '{"message":"I need a ride tomorrow"}'
```

## How to run mobile

```bash
cd apps/mobile
npm install
npm start
```

Set `EXPO_PUBLIC_API_BASE_URL` to your mobile API base URL when testing on a physical device.

## Production environment variables

```bash
DATABASE_URL=postgres://...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
GOOGLE_MAPS_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

## Verification completed here

- `node -c apps/mobile-api/server.js`
- `node -c apps/mobile-api/production-server.js`
- `node -c apps/mobile-api/lib/ai-client.js`
- `node -c apps/mobile-api/lib/daily-journey.js`
- Local demo API smoke test for `/api/guru/daily-journey`
- Local demo API smoke test for `/api/guru/orchestrate`

## Not verified here

- Expo Android/iOS build, because node modules/native toolchain are not installed in this sandbox.
- OpenAI live call, because `OPENAI_API_KEY` is not configured here.
- HealthKit/Health Connect real-device integration.
- Store release build signing.

## Next production hardening

1. Replace single-file `App.tsx` with true screen modules.
2. Add React Navigation or Expo Router.
3. Add Zustand or equivalent app state store.
4. Add real push notifications with `expo-notifications`.
5. Add secure storage and refresh-token auth.
6. Add CI build workflow for Android APK/AAB and iOS IPA.
