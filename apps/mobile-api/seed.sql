INSERT INTO users (id, email, display_name, role, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@theseniorguru.local', 'TheSeniorguru Superadmin', 'superadmin', 'approved'),
  ('00000000-0000-0000-0000-000000000002', 'anita@theseniorguru.local', 'Anita Sharma', 'senior', 'approved'),
  ('00000000-0000-0000-0000-000000000003', 'rita@theseniorguru.local', 'Rita Sharma', 'trusted_person', 'approved'),
  ('00000000-0000-0000-0000-000000000004', 'rohit@careride.local', 'Rohit Mehta', 'business', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO residents (id, user_id, age, community, mood, onboarding_complete, live_tracking_enabled, memory_support_enabled)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 68, 'Park View Community', 'Okay', true, true, true)
ON CONFLICT (id) DO NOTHING;

UPDATE residents
SET health_conditions = ARRAY['Blood Pressure','Diabetes','Cholesterol'],
    allergies = ARRAY['None reported'],
    mobility_notes = 'Walks independently with occasional support.',
    cognitive_support = 'Memory reminders helpful.',
    health_profile = '{"primaryCondition":{"name":"High blood pressure","status":"Active and monitored","severity":"Moderate","diagnosedWhen":"Several years ago","symptomsToWatch":["Dizziness","Shortness of breath","Chest discomfort"],"careTeamNotes":"Please speak calmly and confirm symptoms before escalating."},"allergyProfile":{"allergen":"None known","reaction":"No reaction reported","severity":"None","instructions":"If a new rash, swelling, or breathing issue appears, contact trusted circle and clinician."},"mobilityProfile":{"assistiveDevice":"None at home, cane outdoors","fallHistory":"No fall in last 90 days","transferSupport":"Can stand and sit independently","walkingTolerance":"Short community walks with rest breaks","homeRiskAreas":["Bathroom","Front steps","Night hallway"]},"memoryProfile":{"wanderingRisk":"Low, monitor at night","confusionTriggers":["Missed sleep","New places","Medication changes"],"reassuranceStyle":"Use Anita name, explain slowly, offer one choice at a time.","routineAnchors":["Morning tea","Medication after breakfast","Evening call with Rita"]},"carePreferences":{"preferredHospital":"City Care Hospital","emergencyInstructions":"Call 911 for chest pain, severe breathing difficulty, suspected stroke, fall with injury, or unresponsiveness."}}'::jsonb
WHERE id = '10000000-0000-0000-0000-000000000001';

INSERT INTO trusted_connections (resident_id, trusted_user_id, permissions, status)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', ARRAY['wellness','medications','rides','messages','sos','safety'], 'approved')
ON CONFLICT (resident_id, trusted_user_id) DO NOTHING;

INSERT INTO businesses (id, owner_user_id, name, contact_person, email, phone, website, google_business_profile, description, demographics, service_areas, status, onboarding_complete)
VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'CareRide', 'Rohit Mehta', 'rohit@careride.local', '(555) 018-2044',
   'https://careride.example', 'https://business.google.com/careride', 'Reliable non-emergency rides for seniors.',
   ARRAY['Seniors 65+','Families coordinating care','Retirement communities'], ARRAY['Brampton','Mississauga','Etobicoke'], 'approved', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (business_id, plan, used_leads_month, used_leads_year, lead_top_ups)
VALUES ('20000000-0000-0000-0000-000000000001', 'free', 0, 0, 0)
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO services (id, business_id, name, category, price_label, status)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CareRide Local', 'Transportation', '$18 - $25', 'approved')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medications (id, resident_id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lisinopril', 'Blood Pressure', '10mg', 1, '8:00 AM', 'Once daily', 4, 5, 'Dr. Mehta', 'HealthPlus Pharmacy', 'pending'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Metformin', 'Diabetes', '500mg', 1, '2:00 PM', 'Once daily', 17, 5, 'Dr. Mehta', 'HealthPlus Pharmacy', 'pending'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Atorvastatin', 'Cholesterol', '20mg', 1, '8:00 PM', 'Once nightly', 21, 5, 'Dr. Mehta', 'HealthPlus Pharmacy', 'pending')
ON CONFLICT (id) DO NOTHING;

UPDATE medications
SET name = seed.name,
    condition = seed.condition,
    strength = seed.strength,
    dose_quantity = seed.dose_quantity,
    dose_time = seed.dose_time,
    frequency = seed.frequency,
    refill_threshold = seed.refill_threshold,
    prescriber = seed.prescriber,
    pharmacy = seed.pharmacy
FROM (
  VALUES
    ('40000000-0000-0000-0000-000000000001'::uuid, 'Lisinopril', 'Blood Pressure', '10mg', 1::numeric, '8:00 AM', 'Once daily', 5, 'Dr. Mehta', 'HealthPlus Pharmacy'),
    ('40000000-0000-0000-0000-000000000002'::uuid, 'Metformin', 'Diabetes', '500mg', 1::numeric, '2:00 PM', 'Once daily', 5, 'Dr. Mehta', 'HealthPlus Pharmacy'),
    ('40000000-0000-0000-0000-000000000003'::uuid, 'Atorvastatin', 'Cholesterol', '20mg', 1::numeric, '8:00 PM', 'Once nightly', 5, 'Dr. Mehta', 'HealthPlus Pharmacy')
) AS seed(id, name, condition, strength, dose_quantity, dose_time, frequency, refill_threshold, prescriber, pharmacy)
WHERE medications.id = seed.id;
