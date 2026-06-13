-- Resident home location captured during onboarding.
-- Used as a fallback for weather/services when live phone GPS is unavailable.

ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS home_address TEXT,
  ADD COLUMN IF NOT EXISTS home_city TEXT,
  ADD COLUMN IF NOT EXISTS home_state TEXT,
  ADD COLUMN IF NOT EXISTS home_zip TEXT,
  ADD COLUMN IF NOT EXISTS home_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS home_lng DOUBLE PRECISION;
