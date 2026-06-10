const SENIOR_TOTAL_STEPS = 14;

async function latestOnboardingSession(query, accountId, role) {
  return (await query(
    `SELECT * FROM onboarding_sessions
     WHERE account_id = $1 AND role = $2
     ORDER BY
       CASE status WHEN 'complete' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
       updated_at DESC,
       created_at DESC
     LIMIT 1`,
    [accountId, role]
  )).rows[0] || null;
}

function statusFromSessionPayload(session) {
  const payload = session?.payload && typeof session.payload === "object" ? session.payload : {};
  return {
    currentStep: payload.currentStep || null,
    currentStepKey: session?.current_step || payload.currentStepKey || null,
    completedSteps: Array.isArray(payload.completedSteps) ? payload.completedSteps : [],
    skippedSteps: Array.isArray(payload.skippedSteps) ? payload.skippedSteps : []
  };
}

async function onboardingStatusForUser(query, user) {
  if (!user?.role) {
    return {
      roleSelected: false,
      role: null,
      isOnboarded: false,
      flow: null,
      currentStep: null,
      currentStepKey: null,
      totalSteps: SENIOR_TOTAL_STEPS,
      nextStep: "choose_role"
    };
  }

  if (user.role === "senior") {
    const resident = (await query(`SELECT * FROM residents WHERE user_id = $1`, [user.id])).rows[0] || null;
    const session = await latestOnboardingSession(query, user.id, "senior");
    const progress = statusFromSessionPayload(session);
    const isOnboarded = resident?.onboarding_complete === true || session?.status === "complete";
    return {
      roleSelected: true,
      role: "senior",
      isOnboarded,
      flow: "senior",
      currentStep: isOnboarded ? null : progress.currentStep,
      currentStepKey: isOnboarded ? null : progress.currentStepKey,
      totalSteps: SENIOR_TOTAL_STEPS,
      nextStep: isOnboarded ? "home" : "senior_onboarding",
      status: session?.status || (isOnboarded ? "complete" : "draft"),
      completedSteps: progress.completedSteps,
      skippedSteps: progress.skippedSteps
    };
  }

  if (user.role === "business") {
    const business = (await query(`SELECT onboarding_complete FROM businesses WHERE owner_user_id = $1`, [user.id])).rows[0] || null;
    const isOnboarded = business?.onboarding_complete === true;
    return {
      roleSelected: true,
      role: "business",
      isOnboarded,
      flow: "business",
      currentStep: null,
      currentStepKey: null,
      totalSteps: null,
      nextStep: isOnboarded ? "home" : "business_onboarding"
    };
  }

  if (user.role === "trusted_person") {
    const connection = (await query(
      `SELECT id FROM trusted_connections
       WHERE trusted_user_id = $1 AND status = 'approved'
       LIMIT 1`,
      [user.id]
    )).rows[0];
    const session = await latestOnboardingSession(query, user.id, "trust_circle");
    const isOnboarded = Boolean(connection || session?.status === "complete");
    return {
      roleSelected: true,
      role: "trusted_person",
      isOnboarded,
      flow: "trusted_circle",
      currentStep: null,
      currentStepKey: null,
      totalSteps: null,
      nextStep: isOnboarded ? "home" : "trusted_circle_onboarding"
    };
  }

  return {
    roleSelected: true,
    role: user.role,
    isOnboarded: true,
    flow: user.role,
    currentStep: null,
    currentStepKey: null,
    totalSteps: null,
    nextStep: "home"
  };
}

module.exports = {
  SENIOR_TOTAL_STEPS,
  latestOnboardingSession,
  onboardingStatusForUser
};
