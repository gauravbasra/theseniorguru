const { SENIOR_TOTAL_STEPS, latestOnboardingSession, onboardingStatusForUser } = require("../onboarding-status");

const SENIOR_STEPS = [
  { step: 1, key: "welcome", screen: "onboardingWelcome", skippable: false },
  { step: 2, key: "photo", screen: "seniorPhoto", skippable: false },
  { step: 3, key: "verify", screen: "seniorVerify", skippable: false },
  { step: 4, key: "basic_info", screen: "onboardingProfile", skippable: false },
  { step: 5, key: "address", screen: "seniorAddress", skippable: false },
  { step: 6, key: "health_snapshot", screen: "seniorHealth", skippable: false },
  { step: 7, key: "medications", screen: "seniorMedications", skippable: true },
  { step: 8, key: "connected_devices", screen: "seniorDevices", skippable: true },
  { step: 9, key: "permissions", screen: "seniorPermissions", skippable: false },
  { step: 10, key: "music", screen: "seniorMusic", skippable: true },
  { step: 11, key: "trust_circle", screen: "onboardingCircle", skippable: false },
  { step: 12, key: "privacy_controls", screen: "seniorPrivacy", skippable: false },
  { step: 13, key: "sos_setup", screen: "seniorSos", skippable: false },
  { step: 14, key: "daily_routine", screen: "seniorRoutine", skippable: false }
];

const STEP_BY_KEY = new Map(SENIOR_STEPS.map(item => [item.key, item]));
const STEP_BY_NUMBER = new Map(SENIOR_STEPS.map(item => [item.step, item]));
const SKIPPABLE_KEYS = new Set(SENIOR_STEPS.filter(item => item.skippable).map(item => item.key));
const REQUIRED_FINAL_KEYS = [
  "basic_info",
  "address",
  "health_snapshot",
  "permissions",
  "privacy_controls",
  "sos_setup",
  "daily_routine"
];

function httpError(message, status = 400, details = undefined) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function uniqNumbers(values) {
  return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ""));
}

function ensureSenior(user) {
  if (user.role !== "senior") {
    throw httpError("Senior role is required before senior onboarding. Choose role first.", 403);
  }
}

function stepSpec({ step, stepKey }) {
  const spec = stepKey ? STEP_BY_KEY.get(String(stepKey)) : STEP_BY_NUMBER.get(Number(step));
  if (!spec || (step && Number(step) !== spec.step) || (stepKey && String(stepKey) !== spec.key)) {
    throw httpError("Invalid senior onboarding step", 400, {
      allowedSteps: SENIOR_STEPS.map(item => ({ step: item.step, stepKey: item.key }))
    });
  }
  return spec;
}

function emptyProgressPayload() {
  return {
    flow: "senior",
    totalSteps: SENIOR_TOTAL_STEPS,
    steps: {},
    completedSteps: [],
    skippedSteps: [],
    currentStep: 1,
    currentStepKey: "welcome"
  };
}

function mergeProgressPayload(existing = {}) {
  return {
    ...emptyProgressPayload(),
    ...(existing && typeof existing === "object" ? existing : {}),
    steps: existing?.steps && typeof existing.steps === "object" ? existing.steps : {},
    completedSteps: uniqNumbers(existing?.completedSteps || []),
    skippedSteps: uniqNumbers(existing?.skippedSteps || [])
  };
}

function nextIncompleteStep(completedSteps, skippedSteps) {
  const done = new Set([...completedSteps, ...skippedSteps].map(Number));
  return SENIOR_STEPS.find(item => !done.has(item.step)) || null;
}

function statusFromSession(session) {
  const payload = mergeProgressPayload(session?.payload || {});
  const current = STEP_BY_KEY.get(session?.current_step) || STEP_BY_NUMBER.get(Number(payload.currentStep)) || STEP_BY_KEY.get(payload.currentStepKey) || SENIOR_STEPS[0];
  return {
    flow: "senior",
    status: session?.status || "draft",
    currentStep: current.step,
    currentStepKey: current.key,
    totalSteps: SENIOR_TOTAL_STEPS,
    completedSteps: uniqNumbers(payload.completedSteps),
    skippedSteps: uniqNumbers(payload.skippedSteps),
    isComplete: session?.status === "complete",
    resumeScreen: current.screen,
    payload
  };
}

async function ensureDraftSession(query, userId, tx = query) {
  const existing = await latestOnboardingSession(query, userId, "senior");
  if (existing) return existing;
  return (await tx(
    `INSERT INTO onboarding_sessions (role, account_id, status, current_step, payload)
     VALUES ('senior', $1, 'draft', 'welcome', $2)
     RETURNING *`,
    [userId, JSON.stringify(emptyProgressPayload())]
  )).rows[0];
}

async function getSeniorOnboardingStatus({ query, user }) {
  ensureSenior(user);
  const session = await ensureDraftSession(query, user.id);
  return statusFromSession(session);
}

async function saveSeniorOnboardingStep({ query, audit, req, user, payload }) {
  ensureSenior(user);
  const spec = stepSpec({ step: payload.step, stepKey: payload.stepKey || payload.step_key });
  const skipped = payload.skipped === true;
  if (skipped && !spec.skippable) {
    throw httpError(`${spec.key} cannot be skipped`, 400);
  }
  const session = await ensureDraftSession(query, user.id);
  const progress = mergeProgressPayload(session.payload);
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  progress.steps[spec.key] = {
    step: spec.step,
    stepKey: spec.key,
    screen: payload.screen || spec.screen,
    skipped,
    data,
    savedAt: new Date().toISOString()
  };
  const completed = new Set(progress.completedSteps.map(Number));
  const skippedSteps = new Set(progress.skippedSteps.map(Number));
  if (skipped) {
    skippedSteps.add(spec.step);
    completed.delete(spec.step);
  } else {
    completed.add(spec.step);
    skippedSteps.delete(spec.step);
  }
  const next = nextIncompleteStep([...completed], [...skippedSteps]);
  progress.completedSteps = uniqNumbers([...completed]);
  progress.skippedSteps = uniqNumbers([...skippedSteps]);
  progress.currentStep = next?.step || spec.step;
  progress.currentStepKey = next?.key || spec.key;
  progress.updatedAt = new Date().toISOString();

  const updated = (await query(
    `UPDATE onboarding_sessions
     SET status = 'in_progress',
         current_step = $2,
         payload = $3,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [session.id, progress.currentStepKey, JSON.stringify(progress)]
  )).rows[0];
  if (audit) {
    await audit(req, user, skipped ? "senior_onboarding_step_skipped" : "senior_onboarding_step_saved", "onboarding_session", updated.id, { step: spec.step, stepKey: spec.key }, "info");
  }
  return statusFromSession(updated);
}

function legacyPayloadToSteps(payload = {}) {
  return {
    ...emptyProgressPayload(),
    steps: {
      welcome: { step: 1, stepKey: "welcome", screen: "onboardingWelcome", skipped: false, data: {}, savedAt: new Date().toISOString() },
      photo: { step: 2, stepKey: "photo", screen: "seniorPhoto", skipped: false, data: { profilePhotoEvidenceId: payload.profilePhotoEvidenceId || null }, savedAt: new Date().toISOString() },
      verify: { step: 3, stepKey: "verify", screen: "seniorVerify", skipped: false, data: { livenessEvidenceId: payload.livenessEvidenceId || null, verificationStatus: payload.livenessEvidenceId ? "captured" : "pending" }, savedAt: new Date().toISOString() },
      basic_info: { step: 4, stepKey: "basic_info", screen: "onboardingProfile", skipped: false, data: { name: payload.name, preferredName: payload.preferredName || null, phone: payload.phone || null, email: payload.email || null, dob: payload.dob || null, livingType: payload.livingType || null }, savedAt: new Date().toISOString() },
      address: { step: 5, stepKey: "address", screen: "seniorAddress", skipped: false, data: { homeAddress: payload.address || null, community: payload.community || payload.address || null, preferredHospital: payload.preferredHospital || null }, savedAt: new Date().toISOString() },
      health_snapshot: { step: 6, stepKey: "health_snapshot", screen: "seniorHealth", skipped: false, data: { healthConcerns: payload.healthConcerns || [], mobilityNotes: payload.mobility || payload.mobilityNotes || null, cognitiveNotes: payload.cognitiveNotes || null }, savedAt: new Date().toISOString() },
      medications: { step: 7, stepKey: "medications", screen: "seniorMedications", skipped: !Array.isArray(payload.medications), data: { medications: payload.medications || [], source: "legacy_final_submit" }, savedAt: new Date().toISOString() },
      connected_devices: { step: 8, stepKey: "connected_devices", screen: "seniorDevices", skipped: !Array.isArray(payload.wearableSources), data: { wearableSources: payload.wearableSources || [], requestedDataTypes: payload.devicePermissions || [] }, savedAt: new Date().toISOString() },
      permissions: { step: 9, stepKey: "permissions", screen: "seniorPermissions", skipped: false, data: { devicePermissions: payload.devicePermissions || [], locationSharing: payload.locationSharing === true, notificationsEnabled: (payload.devicePermissions || []).includes("notifications") }, savedAt: new Date().toISOString() },
      music: { step: 10, stepKey: "music", screen: "seniorMusic", skipped: !Array.isArray(payload.musicApps), data: { musicPreferences: payload.musicPreferences || [], musicApps: payload.musicApps || [] }, savedAt: new Date().toISOString() },
      trust_circle: { step: 11, stepKey: "trust_circle", screen: "onboardingCircle", skipped: false, data: { contacts: payload.contacts || [] }, savedAt: new Date().toISOString() },
      privacy_controls: { step: 12, stepKey: "privacy_controls", screen: "seniorPrivacy", skipped: false, data: payload.privacyControls || {}, savedAt: new Date().toISOString() },
      sos_setup: { step: 13, stepKey: "sos_setup", screen: "seniorSos", skipped: false, data: { sosOrder: payload.sosOrder || [] }, savedAt: new Date().toISOString() },
      daily_routine: { step: 14, stepKey: "daily_routine", screen: "seniorRoutine", skipped: false, data: { routineToggles: payload.dailyRoutine || {} }, savedAt: new Date().toISOString() }
    },
    completedSteps: [1, 2, 3, 4, 5, 6, 9, 11, 12, 13, 14],
    skippedSteps: [
      ...(!Array.isArray(payload.medications) ? [7] : []),
      ...(!Array.isArray(payload.wearableSources) ? [8] : []),
      ...(!Array.isArray(payload.musicApps) ? [10] : [])
    ],
    currentStep: 14,
    currentStepKey: "daily_routine"
  };
}

function finalPayloadFromSession(session, incoming = {}) {
  if (incoming.steps && typeof incoming.steps === "object") {
    return mergeProgressPayload(incoming);
  }
  if (incoming.name) {
    return legacyPayloadToSteps(incoming);
  }
  return mergeProgressPayload(session?.payload || {});
}

function stepData(progress, key) {
  return progress.steps?.[key]?.data || {};
}

function validateFinalProgress(progress) {
  const missing = REQUIRED_FINAL_KEYS.filter(key => !progress.steps?.[key] || progress.steps[key].skipped === true);
  if (missing.length) {
    throw httpError(`Missing senior onboarding steps: ${missing.join(", ")}`, 400, { missingSteps: missing });
  }
  const basic = stepData(progress, "basic_info");
  if (!basic.name) throw httpError("Missing senior onboarding fields: basic_info.name", 400);
}

function list(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function medicationRows(value) {
  return Array.isArray(value) ? value.filter(item => item && item.name && item.time) : [];
}

async function completeSeniorOnboarding({ query, transaction, audit, req, user, payload }) {
  ensureSenior(user);
  const session = await ensureDraftSession(query, user.id);
  const progress = finalPayloadFromSession(session, payload);
  validateFinalProgress(progress);
  const basic = stepData(progress, "basic_info");
  const address = stepData(progress, "address");
  const health = stepData(progress, "health_snapshot");
  const meds = stepData(progress, "medications");
  const devices = stepData(progress, "connected_devices");
  const permissions = stepData(progress, "permissions");
  const music = stepData(progress, "music");
  const privacy = stepData(progress, "privacy_controls");
  const sos = stepData(progress, "sos_setup");
  const routine = stepData(progress, "daily_routine");
  const photo = stepData(progress, "photo");
  const verify = stepData(progress, "verify");

  const result = await transaction(async tx => {
    const resident = (await tx(
      `INSERT INTO residents (user_id, onboarding_complete)
       VALUES ($1, false)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [user.id]
    )).rows[0];
    const completedSession = (await tx(
      `UPDATE onboarding_sessions
       SET status = 'complete',
           current_step = 'daily_routine',
           payload = $2,
           completed_at = now(),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [session.id, JSON.stringify({ ...progress, currentStep: 14, currentStepKey: "daily_routine", completedAt: new Date().toISOString() })]
    )).rows[0];
    const profile = (await tx(
      `INSERT INTO senior_onboarding_profiles (
         onboarding_session_id, senior_account_id, full_name, preferred_name, phone, email,
         date_of_birth, address_line, community_name, living_type, emergency_access_notes
       ) VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9,$10,$11)
       RETURNING *`,
      [
        completedSession.id,
        user.id,
        basic.name,
        basic.preferredName || null,
        basic.phone || user.phone || "",
        basic.email || user.email || null,
        basic.dob || null,
        address.homeAddress || null,
        address.community || null,
        basic.livingType || null,
        address.preferredHospital || null
      ]
    )).rows[0];
    await tx(`UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`, [basic.preferredName || basic.name, user.id]);
    await tx(
      `INSERT INTO senior_health_onboarding (
         senior_profile_id, health_concerns, allergies, mobility_notes, cognitive_notes,
         baseline_metrics, wearable_sources, health_data_scopes
       ) VALUES ($1,$2,NULL,$3,$4,$5,$6,$7)`,
      [
        profile.id,
        list(health.healthConcerns),
        health.mobilityNotes || null,
        health.cognitiveNotes || null,
        JSON.stringify({ source: "senior_onboarding_v2" }),
        list(devices.wearableSources),
        list(devices.requestedDataTypes || permissions.devicePermissions)
      ]
    );
    const capturedEvidenceIds = [photo.profilePhotoEvidenceId, verify.livenessEvidenceId].filter(isUuid);
    if (capturedEvidenceIds.length) {
      await tx(
        `UPDATE identity_evidence
         SET onboarding_session_id = $1, subject_account_id = $2, metadata = metadata || $3::jsonb
         WHERE id = ANY($4::uuid[])`,
        [completedSession.id, user.id, JSON.stringify({ linkedFrom: "senior_onboarding_v2", linkedAt: new Date().toISOString() }), capturedEvidenceIds]
      );
    }
    for (const permission of list(permissions.devicePermissions)) {
      await tx(
        `INSERT INTO device_permission_grants (onboarding_session_id, account_id, permission_name, requested_reason, grant_status, granted_at, metadata)
         VALUES ($1,$2,$3,'onboarding','granted',now(),$4)`,
        [completedSession.id, user.id, String(permission).toLowerCase().replace(/\s+/g, "_"), JSON.stringify({ source: "senior_onboarding_v2" })]
      );
    }
    for (const provider of list(music.musicApps)) {
      await tx(
        `INSERT INTO music_connections (senior_profile_id, provider, connection_status, favorite_genres)
         VALUES ($1,$2,'pending',$3)`,
        [profile.id, String(provider).toLowerCase().replace(/\s+/g, "_"), list(music.musicPreferences)]
      );
    }
    for (const provider of list(devices.wearableSources)) {
      await tx(
        `INSERT INTO health_sources (user_id, resident_id, source, display_name, status, scopes, metadata, connected_at, updated_at)
         VALUES ($1,$2,$3,$4,'pending_oauth',$5,$6,NULL,now())
         ON CONFLICT (user_id, source) DO UPDATE SET
           resident_id = EXCLUDED.resident_id,
           scopes = EXCLUDED.scopes,
           metadata = health_sources.metadata || EXCLUDED.metadata,
           updated_at = now()`,
        [user.id, resident.id, String(provider).toLowerCase().replace(/\s+/g, "_"), String(provider), list(devices.requestedDataTypes), JSON.stringify({ source: "senior_onboarding_v2" })]
      );
    }
    for (const medication of medicationRows(meds.medications)) {
      await tx(
        `INSERT INTO medications (
           resident_id, name, condition, strength, dose_quantity, dose_time,
           frequency, remaining_count, refill_threshold, prescriber, pharmacy, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,5,$8,$9,'pending')`,
        [
          resident.id,
          medication.name,
          medication.condition || null,
          medication.strength || "",
          Math.max(1, Number(medication.doseQuantity || 1)),
          medication.time,
          medication.frequency || "Once daily",
          medication.prescriber || null,
          medication.pharmacy || null
        ]
      );
    }
    const consent = (await tx(
      `INSERT INTO consent_records (subject_account_id, subject_role, consent_scope, consent_text, granted, source_ip, user_agent, metadata)
       VALUES ($1,'senior','senior_onboarding_identity_health_wearables_music_location_sos','Senior onboarding consent captured in mobile app.',true,$2,$3,$4)
       RETURNING *`,
      [
        user.id,
        req.socket?.remoteAddress || null,
        req.headers["user-agent"] || null,
        JSON.stringify({ permissions, privacy, sos, routine, version: "senior_onboarding_v2" })
      ]
    )).rows[0];
    const updatedResident = (await tx(
      `UPDATE residents SET
         community = COALESCE($1, community),
         onboarding_complete = true,
         live_tracking_enabled = COALESCE($2, live_tracking_enabled),
         memory_support_enabled = true,
         health_conditions = $3,
         mobility_notes = $4,
         cognitive_support = $5,
         display_name = $6,
         profile_photo_evidence_id = COALESCE(NULLIF($7,'')::uuid, profile_photo_evidence_id),
         health_profile = health_profile || $8::jsonb,
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [
        address.community || address.homeAddress || null,
        permissions.locationSharing === true,
        list(health.healthConcerns),
        health.mobilityNotes || null,
        health.cognitiveNotes || null,
        basic.preferredName || basic.name,
        photo.profilePhotoEvidenceId || "",
        JSON.stringify({
          onboarding: {
            profileId: profile.id,
            sessionId: completedSession.id,
            consentId: consent.id,
            address,
            privacy,
            sos,
            routine,
            skippable: {
              medicationsSkipped: progress.skippedSteps.includes(7),
              devicesSkipped: progress.skippedSteps.includes(8),
              musicSkipped: progress.skippedSteps.includes(10)
            }
          }
        }),
        resident.id
      ]
    )).rows[0];
    return { session: completedSession, profile, consent, resident: updatedResident };
  });
  if (audit) {
    await audit(req, user, "senior_onboarding_completed", "onboarding_session", result.session.id, { profileId: result.profile.id }, "info");
  }
  const onboardingStatus = await onboardingStatusForUser(query, { ...user, role: "senior" });
  return {
    ok: true,
    onboarding: {
      session: result.session,
      profile: result.profile,
      consent: result.consent
    },
    onboarding_status: onboardingStatus,
    nextStep: onboardingStatus.nextStep
  };
}

async function selectRole({ query, transaction, audit, req, user, role }) {
  const nextRole = String(role || "").trim();
  if (!["senior", "trusted_person", "business"].includes(nextRole)) {
    throw httpError("Invalid role", 400);
  }
  if (user.role) {
    throw httpError("Role has already been selected", 409);
  }
  const result = await transaction(async tx => {
    const updatedUser = (await tx(
      `UPDATE users SET role = $1::app_role, status = 'approved', updated_at = now()
       WHERE id = $2 AND role IS NULL
       RETURNING id, email, phone, display_name, gender, role, status, last_login_at, created_at, updated_at`,
      [nextRole, user.id]
    )).rows[0];
    if (!updatedUser) throw httpError("Role has already been selected", 409);
    if (nextRole === "senior") {
      await tx(
        `INSERT INTO residents (user_id, onboarding_complete)
         VALUES ($1, false)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
      await tx(
        `INSERT INTO onboarding_sessions (role, account_id, status, current_step, payload)
         VALUES ('senior', $1, 'draft', 'welcome', $2)`,
        [user.id, JSON.stringify(emptyProgressPayload())]
      );
    }
    return updatedUser;
  });
  const onboardingStatus = await onboardingStatusForUser(query, result);
  if (audit) {
    await audit(req, result, "auth_role_selected", "user", result.id, { role: nextRole, nextStep: onboardingStatus.nextStep }, "info");
  }
  return { user: result, onboarding_status: onboardingStatus, nextStep: onboardingStatus.nextStep };
}

module.exports = {
  SENIOR_STEPS,
  SKIPPABLE_KEYS,
  completeSeniorOnboarding,
  getSeniorOnboardingStatus,
  saveSeniorOnboardingStep,
  selectRole,
  statusFromSession
};
