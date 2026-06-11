-- Migration 007: Smart Medication Management
-- Run once against your PostgreSQL database.

-- 1. Medication reference / drug database
CREATE TABLE IF NOT EXISTS medication_reference (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generic_name         TEXT NOT NULL,
  brand_names          TEXT[] DEFAULT '{}',
  drug_class           TEXT,
  indication           TEXT,
  side_effects         TEXT[] DEFAULT '{}',
  known_interactions   TEXT[] DEFAULT '{}',
  narrow_therapeutic_index BOOLEAN DEFAULT FALSE,
  beers_list_caution   BOOLEAN DEFAULT FALSE,
  renal_caution        BOOLEAN DEFAULT FALSE,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(generic_name)
);

-- 2. Drug interaction pairs table
CREATE TABLE IF NOT EXISTS drug_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_a       TEXT NOT NULL,   -- generic name, lowercase
  drug_b       TEXT NOT NULL,   -- generic name, lowercase
  severity     TEXT NOT NULL CHECK (severity IN ('HIGH','MODERATE','LOW')),
  description  TEXT NOT NULL,
  source       TEXT DEFAULT 'tsg-internal',
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(drug_a, drug_b)
);

-- 3. Extend the medications table with smart inventory fields
ALTER TABLE medications
  ADD COLUMN IF NOT EXISTS dose_quantity_per_intake   INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS days_supply_remaining      INTEGER,
  ADD COLUMN IF NOT EXISTS refill_reminder_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refill_requested_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refill_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refill_provider_id         UUID,
  ADD COLUMN IF NOT EXISTS drug_class                 TEXT,
  ADD COLUMN IF NOT EXISTS generic_name               TEXT,
  ADD COLUMN IF NOT EXISTS brand_name                 TEXT,
  ADD COLUMN IF NOT EXISTS side_effects               TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS beers_list_caution         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS narrow_therapeutic_index   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS special_instructions       TEXT,
  ADD COLUMN IF NOT EXISTS start_date                 DATE,
  ADD COLUMN IF NOT EXISTS end_date                   DATE,
  ADD COLUMN IF NOT EXISTS is_active                  BOOLEAN DEFAULT TRUE;

-- 4. Medication dose log (every confirmed or missed dose)
CREATE TABLE IF NOT EXISTS medication_dose_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  resident_id     UUID NOT NULL,
  dose_status     TEXT NOT NULL CHECK (dose_status IN ('taken','missed','skipped','late')),
  scheduled_at    TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  quantity_taken  INTEGER DEFAULT 1,
  remaining_after INTEGER,
  source          TEXT DEFAULT 'resident_app',  -- resident_app | caregiver | auto
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_med_dose_log_resident ON medication_dose_log(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_med_dose_log_medication ON medication_dose_log(medication_id, created_at DESC);

-- 5. Refill providers (pharmacies, mail-order)
CREATE TABLE IF NOT EXISTS refill_providers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('pharmacy','mail_order','specialty','compounding')),
  phone            TEXT,
  fax              TEXT,
  email            TEXT,
  website          TEXT,
  address          TEXT,
  community        TEXT,           -- link to a specific senior living community
  api_endpoint     TEXT,           -- for automated refill requests
  api_key_env      TEXT,           -- env var name holding the API key
  turnaround_days  INTEGER DEFAULT 3,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 6. Refill requests (full lifecycle)
CREATE TABLE IF NOT EXISTS medication_refill_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id       UUID NOT NULL REFERENCES medications(id),
  resident_id         UUID NOT NULL,
  refill_provider_id  UUID REFERENCES refill_providers(id),
  status              TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested','sent_to_pharmacy','processing','ready','picked_up','delivered','cancelled','failed')),
  quantity_requested  INTEGER DEFAULT 30,
  days_supply         INTEGER DEFAULT 30,
  remaining_at_request INTEGER,
  requested_at        TIMESTAMPTZ DEFAULT now(),
  sent_to_provider_at TIMESTAMPTZ,
  ready_at            TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  provider_reference  TEXT,       -- pharmacy's confirmation number
  notes               TEXT,
  auto_triggered      BOOLEAN DEFAULT FALSE,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refill_req_resident ON medication_refill_requests(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refill_req_status ON medication_refill_requests(status);

-- 7. Medication side effect reports
CREATE TABLE IF NOT EXISTS medication_side_effect_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id   UUID NOT NULL REFERENCES medications(id),
  resident_id     UUID NOT NULL,
  symptom         TEXT NOT NULL,
  severity        TEXT DEFAULT 'mild' CHECK (severity IN ('mild','moderate','severe')),
  onset_date      DATE,
  reported_at     TIMESTAMPTZ DEFAULT now(),
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 8. Medication interaction alerts (per-resident, generated on add)
CREATE TABLE IF NOT EXISTS medication_interaction_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id   UUID NOT NULL,
  drug_a        TEXT NOT NULL,
  drug_b        TEXT NOT NULL,
  severity      TEXT NOT NULL,
  description   TEXT NOT NULL,
  acknowledged  BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_med_interaction_resident ON medication_interaction_alerts(resident_id, acknowledged, created_at DESC);

-- Helpful view: active medications with days-supply and refill status
CREATE OR REPLACE VIEW resident_medication_dashboard AS
SELECT
  m.id,
  m.resident_id,
  m.name,
  m.generic_name,
  m.strength,
  m.drug_class,
  m.condition,
  m.frequency,
  m.dose_time,
  m.remaining_count,
  m.refill_threshold,
  m.days_supply_remaining,
  m.beers_list_caution,
  m.narrow_therapeutic_index,
  m.special_instructions,
  m.prescriber,
  m.pharmacy,
  m.status,
  m.last_confirmed_at,
  m.refill_reminder_sent_at,
  m.refill_requested_at,
  m.start_date,
  m.is_active,
  CASE
    WHEN m.remaining_count <= 0 THEN 'out_of_stock'
    WHEN m.remaining_count <= m.refill_threshold THEN 'refill_needed'
    WHEN m.remaining_count <= m.refill_threshold * 2 THEN 'refill_soon'
    ELSE 'sufficient'
  END AS inventory_status,
  (SELECT status FROM medication_refill_requests r
   WHERE r.medication_id = m.id
   ORDER BY r.created_at DESC LIMIT 1) AS latest_refill_status
FROM medications m
WHERE m.is_active = TRUE OR m.is_active IS NULL;
