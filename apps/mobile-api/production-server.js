const crypto = require("crypto");
const { resolveGuruIntent } = require("./lib/guru-intents");
const { callOpenAI, buildSeniorGuruSystemPrompt } = require("./lib/ai-client");

const FREE_YEARLY_LEADS = 5;
const PAID_MONTHLY_LEADS = 5;
const PAID_PLAN_PRICE_CENTS = 10000;
const STRIPE_API_VERSION = "2026-02-25.clover";
const RIDE_PLATFORM_MARGIN_BPS = 2000;

function required(value, name) {
  if (value === undefined || value === null || value === "") {
    const error = new Error(`${name} is required`);
    error.status = 400;
    throw error;
  }
  return value;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeProviderId(provider) {
  return String(provider || "wearable")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "wearable";
}

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!rawBody || !signatureHeader || !webhookSecret) return false;
  const parts = String(signatureHeader).split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!acc[key]) acc[key] = [];
    acc[key].push(value);
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  return signatures.some(signature => {
    const left = Buffer.from(signature, "hex");
    const right = Buffer.from(expected, "hex");
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  });
}

function createProductionApi(pool) {
  async function query(sql, params = []) {
    const result = await pool.query(sql, params);
    return result;
  }

  async function stripeRequest(path, body) {
    if (!process.env.STRIPE_SECRET_KEY) {
      const error = new Error("Stripe billing is not configured.");
      error.status = 402;
      throw error;
    }
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": STRIPE_API_VERSION
      },
      body: new URLSearchParams(body)
    });
    const json = await response.json();
    if (!response.ok) {
      const error = new Error(json.error?.message || "Stripe request failed");
      error.status = 402;
      error.details = json.error || {};
      throw error;
    }
    return json;
  }

  function googleMapsKey() {
    const key = process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY || "";
    if (!key) {
      const error = new Error("Google Maps is not configured.");
      error.status = 503;
      throw error;
    }
    return key;
  }

  async function googleMapsGet(path, params) {
    const search = new URLSearchParams({ ...params, key: googleMapsKey() });
    const response = await fetch(`https://maps.googleapis.com/maps/api/${path}?${search.toString()}`);
    const data = await response.json();
    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status)) {
      const error = new Error(data.error_message || data.status || "Google Maps request failed");
      error.status = response.ok ? 502 : response.status;
      error.details = data;
      throw error;
    }
    return data;
  }

  async function googleMapsPost(url, body) {
    const response = await fetch(`${url}?key=${encodeURIComponent(googleMapsKey())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || "Google Maps request failed");
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  }

  async function createGrowthCheckoutSession(user, business, subscription) {
    const successUrl = process.env.STRIPE_SUCCESS_URL || "https://mobile-api-nine.vercel.app/api/billing/success?session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl = process.env.STRIPE_CANCEL_URL || "https://mobile-api-nine.vercel.app/api/billing/cancelled";
    const params = {
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: business.email || user.email,
      client_reference_id: business.id,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(PAID_PLAN_PRICE_CENTS),
      "line_items[0][price_data][recurring][interval]": "month",
      "line_items[0][price_data][product_data][name]": "TheSeniorguru Growth Package",
      "line_items[0][price_data][product_data][description]": "More than one service and 5 leads per month for approved senior support businesses.",
      "metadata[businessId]": business.id,
      "metadata[subscriptionRowId]": subscription.id,
      "subscription_data[metadata][businessId]": business.id,
      "subscription_data[metadata][subscriptionRowId]": subscription.id
    };
    return stripeRequest("/v1/checkout/sessions", params);
  }

  async function createStripePaymentIntent({ amountCents, description, metadata, receiptEmail }) {
    const params = {
      amount: String(Math.max(50, Math.ceil(Number(amountCents)))),
      currency: "usd",
      description,
      "automatic_payment_methods[enabled]": "true",
      ...(receiptEmail ? { receipt_email: receiptEmail } : {})
    };
    for (const [key, value] of Object.entries(metadata || {})) {
      params[`metadata[${key}]`] = String(value ?? "");
    }
    return stripeRequest("/v1/payment_intents", params);
  }

  async function transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback((sql, params = []) => client.query(sql, params));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function audit(req, actor, action, entityType, entityId, metadata = {}, severity = "info") {
    await query(
      `INSERT INTO audit_logs (actor_user_id, entity_type, entity_id, action, severity, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actor?.id || null,
        entityType,
        entityId || null,
        action,
        severity,
        req.socket?.remoteAddress || null,
        req.headers["user-agent"] || null,
        JSON.stringify(metadata)
      ]
    );
  }

  function storageSigningSecret() {
    return process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || "local-dev-media-secret";
  }

  function sanitizeStorageKey(value) {
    return String(value || "upload.bin")
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "upload.bin";
  }

  function signStorageUrl({ method, bucket, storageKey, expiresAt }) {
    const baseUrl = (process.env.MEDIA_STORAGE_PUBLIC_BASE_URL || "https://storage.theseniorguru.local").replace(/\/+$/, "");
    const path = `/media/${sanitizeStorageKey(bucket)}/${sanitizeStorageKey(storageKey)}`;
    const expires = new Date(expiresAt).getTime();
    const signature = crypto
      .createHmac("sha256", storageSigningSecret())
      .update(`${String(method || "GET").toUpperCase()}\n${path}\n${expires}`)
      .digest("hex");
    return `${baseUrl}${path}?method=${encodeURIComponent(String(method || "GET").toUpperCase())}&expires=${expires}&signature=${signature}`;
  }

  async function enqueueJob(queueName, jobType, payload = {}, runAfter = new Date(), maxAttempts = 5) {
    const result = await query(
      `INSERT INTO job_queue (queue_name, job_type, payload, run_after, max_attempts)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, queue_name, job_type, status, run_after`,
      [queueName, jobType, JSON.stringify(payload || {}), runAfter, maxAttempts]
    );
    return result.rows[0];
  }

  async function currentUser(req) {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      const error = new Error("Missing bearer token");
      error.status = 401;
      throw error;
    }
    const tokenHash = hashToken(token);
    const result = await query(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [tokenHash]
    );
    if (!result.rows[0]) {
      const error = new Error("Invalid or expired session");
      error.status = 401;
      throw error;
    }
    return result.rows[0];
  }

  function requireRole(user, roles) {
    if (!roles.includes(user.role)) {
      const error = new Error("Insufficient permissions");
      error.status = 403;
      throw error;
    }
  }

  async function getResidentForUser(user) {
    const result = await query(`SELECT * FROM residents WHERE user_id = $1`, [user.id]);
    return result.rows[0];
  }

  async function getBusinessForUser(user) {
    const result = await query(`SELECT * FROM businesses WHERE owner_user_id = $1`, [user.id]);
    return result.rows[0];
  }

  async function ensureDemoResident() {
    const senior = (await query(
      `INSERT INTO users (email, display_name, role, status)
       VALUES ('anita@theseniorguru.local', 'Anita Sharma', 'senior', 'approved')
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, status = EXCLUDED.status
       RETURNING *`
    )).rows[0];
    return (await query(
      `INSERT INTO residents (user_id, age, community, mood, onboarding_complete, live_tracking_enabled, memory_support_enabled)
       VALUES ($1, 68, 'Park View Community', 'steady', true, true, true)
       ON CONFLICT (user_id) DO UPDATE SET live_tracking_enabled = true, memory_support_enabled = true
       RETURNING *`,
      [senior.id]
    )).rows[0];
  }

  async function ensureDefaultSubscription(businessId) {
    const subscription = (await query(
      `INSERT INTO subscriptions (business_id, plan, billing_status, current_period_start, current_period_end)
       VALUES ($1, 'free', 'active', date_trunc('year', now()), date_trunc('year', now()) + interval '1 year')
       ON CONFLICT (business_id) DO NOTHING
       RETURNING *`,
      [businessId]
    )).rows[0] || (await query(`SELECT * FROM subscriptions WHERE business_id = $1`, [businessId])).rows[0];
    return refreshSubscriptionPeriod(subscription);
  }

  async function refreshSubscriptionPeriod(subscription) {
    if (!subscription) return null;
    const periodExpired = !subscription.current_period_end || new Date(subscription.current_period_end).getTime() <= Date.now();
    if (!periodExpired) return subscription;
    if (subscription.plan === "growth_100") {
      return (await query(
        `UPDATE subscriptions
         SET used_leads_month = 0,
             lead_top_ups = 0,
             current_period_start = date_trunc('month', now()),
             current_period_end = date_trunc('month', now()) + interval '1 month',
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [subscription.id]
      )).rows[0];
    }
    return (await query(
      `UPDATE subscriptions
       SET used_leads_year = 0,
           used_leads_month = 0,
           lead_top_ups = 0,
           current_period_start = date_trunc('year', now()),
           current_period_end = date_trunc('year', now()) + interval '1 year',
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [subscription.id]
    )).rows[0];
  }

  function toBusinessState(business, subscription) {
    if (!business) return null;
    const plan = subscription?.plan === "growth_100" ? "paid" : "free";
    return {
      id: business.id,
      name: business.name,
      contactPerson: business.contact_person,
      email: business.email,
      phone: business.phone,
      website: business.website || "",
      googleBusinessProfile: business.google_business_profile || "",
      description: business.description || "",
      demographics: business.demographics || [],
      serviceAreas: business.service_areas || [],
      status: business.status,
      onboardingComplete: business.onboarding_complete === true,
      plan,
      billingStatus: subscription?.billing_status || "active",
      lockReason: subscription?.lock_reason || null,
      leadQuota: {
        freePerYear: FREE_YEARLY_LEADS,
        paidPerMonth: PAID_MONTHLY_LEADS,
        topUps: Number(subscription?.lead_top_ups || 0),
        usedThisYear: Number(subscription?.used_leads_year || 0),
        usedThisMonth: Number(subscription?.used_leads_month || 0)
      }
    };
  }

  function toServiceState(service, business) {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      price: service.price_label || "",
      priceLabel: service.price_label || "",
      status: service.status,
      provider: business?.name || "",
      rating: 0,
      eta: "Available after approval"
    };
  }

  function toLeadState(lead, service, business) {
    return {
      id: lead.id,
      resident: lead.resident_name || "Resident",
      type: lead.request_type,
      time: lead.requested_time || "Requested time pending",
      distance: lead.distance_meters ? `${(Number(lead.distance_meters) / 1000).toFixed(1)} km` : service?.price_label || "",
      duration: lead.duration_seconds ? `${Math.max(1, Math.round(Number(lead.duration_seconds) / 60))} min` : "",
      status: lead.status,
      provider: business?.name || "",
      serviceId: lead.service_id,
      pickup: lead.pickup_label ? { label: lead.pickup_label, lat: lead.pickup_lat, lng: lead.pickup_lng } : null,
      dropoff: lead.dropoff_label ? { label: lead.dropoff_label, lat: lead.dropoff_lat, lng: lead.dropoff_lng } : null,
      routeProvider: lead.route_provider || null,
      fulfillmentMode: lead.fulfillment_mode || null,
      lifecycleStatus: lead.lifecycle_status || "requested",
      fulfillmentProvider: lead.fulfillment_provider || null,
      externalTripId: lead.external_trip_id || null,
      paymentResponsibility: lead.payment_responsibility || "senior",
      paymentStatus: lead.payment_status || "payment_required",
      pricing: lead.total_charge_cents ? {
        providerBillCents: lead.provider_bill_cents,
        taxCents: lead.tax_cents,
        refundReserveCents: lead.refund_reserve_cents,
        platformMarginCents: lead.platform_margin_cents,
        totalChargeCents: lead.total_charge_cents
      } : null
    };
  }

  function toBookingState(booking, business) {
    return {
      id: booking.id,
      leadId: booking.lead_id,
      resident: booking.resident_name || "Resident",
      service: booking.label,
      time: booking.scheduled_for ? new Date(booking.scheduled_for).toLocaleString() : "Time pending",
      status: booking.status,
      provider: business?.name || "",
      pickup: booking.pickup_label ? { label: booking.pickup_label, lat: booking.pickup_lat, lng: booking.pickup_lng } : null,
      dropoff: booking.dropoff_label ? { label: booking.dropoff_label, lat: booking.dropoff_lat, lng: booking.dropoff_lng } : null,
      distance: booking.distance_meters ? `${(Number(booking.distance_meters) / 1000).toFixed(1)} km` : "",
      duration: booking.duration_seconds ? `${Math.max(1, Math.round(Number(booking.duration_seconds) / 60))} min` : "",
      routeProvider: booking.route_provider || null,
      fulfillmentMode: booking.fulfillment_mode || null,
      lifecycleStatus: booking.lifecycle_status || "requested",
      fulfillmentProvider: booking.fulfillment_provider || null,
      externalTripId: booking.external_trip_id || null,
      paymentResponsibility: booking.payment_responsibility || "senior",
      paymentStatus: booking.payment_status || "payment_required",
      pricing: booking.total_charge_cents ? {
        providerBillCents: booking.provider_bill_cents,
        taxCents: booking.tax_cents,
        refundReserveCents: booking.refund_reserve_cents,
        platformMarginCents: booking.platform_margin_cents,
        totalChargeCents: booking.total_charge_cents
      } : null
    };
  }

  function medicationParams(payload) {
    return {
      id: payload.id || null,
      name: required(payload.name, "name"),
      condition: required(payload.condition, "condition"),
      strength: required(payload.strength, "strength"),
      doseQuantity: Math.max(1, Number(payload.doseQuantity || 1)),
      time: required(payload.time, "time"),
      frequency: payload.frequency || "Once daily",
      remaining: Math.max(0, Number(payload.remaining ?? 0)),
      refillThreshold: Math.max(0, Number(payload.refillThreshold ?? 5)),
      prescriber: payload.prescriber || null,
      pharmacy: payload.pharmacy || null
    };
  }

  function list(value) {
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function validateHealthOnboarding(payload) {
    const profile = payload.healthProfile || {};
    const diagnosis = profile.primaryCondition || {};
    const allergy = profile.allergyProfile || {};
    const mobility = profile.mobilityProfile || {};
    const memory = profile.memoryProfile || {};
    const care = profile.carePreferences || {};
    const medications = Array.isArray(payload.medications) ? payload.medications : (payload.medication ? [payload.medication] : []);
    const missing = [];
    if (!payload.name) missing.push("name");
    if (!payload.age) missing.push("age");
    if (!payload.community) missing.push("community");
    if (!diagnosis.name) missing.push("healthProfile.primaryCondition.name");
    if (!diagnosis.status) missing.push("healthProfile.primaryCondition.status");
    if (!diagnosis.severity) missing.push("healthProfile.primaryCondition.severity");
    if (!mobility.transferSupport) missing.push("healthProfile.mobilityProfile.transferSupport");
    if (!memory.reassuranceStyle) missing.push("healthProfile.memoryProfile.reassuranceStyle");
    if (!care.emergencyInstructions) missing.push("healthProfile.carePreferences.emergencyInstructions");
    if (!medications.length) missing.push("medications");
    medications.forEach((med, index) => {
      if (!med.name) missing.push(`medications[${index}].name`);
      if (!med.condition) missing.push(`medications[${index}].condition`);
      if (!med.strength) missing.push(`medications[${index}].strength`);
      if (!med.time) missing.push(`medications[${index}].time`);
      if (Number(med.remaining ?? -1) < 0) missing.push(`medications[${index}].remaining`);
    });
    if (missing.length) {
      const error = new Error(`Missing health onboarding fields: ${missing.join(", ")}`);
      error.status = 400;
      throw error;
    }
    return { profile, diagnosis, allergy, mobility, memory, care, medications };
  }

  function auditSeverity(value) {
    if (value === 'critical') return 'critical';
    if (value === 'high' || value === 'watch') return 'warning';
    if (value === 'security') return 'security';
    return 'info';
  }

  function average(values) {
    const numeric = values.filter(value => Number.isFinite(Number(value))).map(Number);
    if (!numeric.length) return null;
    return Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
  }

  function evaluateHealthVitals(readings) {
    const summary = {
      heartRateAvg: average(readings.map(item => item.heart_rate ?? item.heartRate)),
      oxygenAvg: average(readings.map(item => item.oxygen_saturation ?? item.oxygenSaturation)),
      respiratoryRateAvg: average(readings.map(item => item.respiratory_rate ?? item.respiratoryRate)),
      hrvAvg: average(readings.map(item => item.hrv)),
      sleepMinutes: average(readings.map(item => item.sleep_minutes ?? item.sleepMinutes)),
      caloriesToday: average(readings.map(item => item.calories_today ?? item.caloriesToday)),
      stepsToday: average(readings.map(item => item.steps_today ?? item.stepsToday)),
      riskLevel: 'low',
      riskReasons: []
    };
    if (summary.oxygenAvg !== null && summary.oxygenAvg < 92) summary.riskReasons.push('oxygen-below-92');
    if (summary.heartRateAvg !== null && (summary.heartRateAvg > 115 || summary.heartRateAvg < 45)) summary.riskReasons.push('heart-rate-out-of-range');
    if (summary.respiratoryRateAvg !== null && (summary.respiratoryRateAvg > 24 || summary.respiratoryRateAvg < 9)) summary.riskReasons.push('respiratory-rate-out-of-range');
    if (summary.sleepMinutes !== null && summary.sleepMinutes < 240) summary.riskReasons.push('low-sleep-duration');
    if (summary.riskReasons.length >= 2) summary.riskLevel = 'high';
    else if (summary.riskReasons.length === 1) summary.riskLevel = 'watch';
    return summary;
  }

  function defaultVitalMonitorRows(summary = {}) {
    const heartRate = summary.heartRateAvg || 72;
    const hrv = summary.hrvAvg || 48;
    const oxygen = summary.oxygenAvg || 97;
    const respiratory = summary.respiratoryRateAvg || 16;
    return [
      { vital_key: "resting_heart_rate", label: "Resting Heart Rate", value_text: String(heartRate), numeric_value: heartRate, unit: "bpm", status_label: "Normal", baseline_text: "30-day baseline: 69 bpm", trend_points: [68, 70, 69, heartRate, 71], color_band_payload: { low: "green", mid: "yellow", high: "red" } },
      { vital_key: "hrv", label: "Heart Rate Variability", value_text: String(hrv), numeric_value: hrv, unit: "ms", status_label: "Good", baseline_text: "30-day baseline: 44 ms", trend_points: [42, 43, 44, hrv, 45], color_band_payload: { low: "yellow", mid: "green", high: "green" } },
      { vital_key: "oxygen_saturation", label: "Blood Oxygen (SpO2)", value_text: String(oxygen), numeric_value: oxygen, unit: "%", status_label: "Normal", baseline_text: "Normal range: 95 - 100%", trend_points: [96, 97, 96, oxygen, 98], color_band_payload: { low: "red", mid: "green", high: "green" } },
      { vital_key: "respiratory_rate", label: "Respiratory Rate", value_text: String(respiratory), numeric_value: respiratory, unit: "/min", status_label: "Normal", baseline_text: "Normal range: 12 - 20", trend_points: [15, 16, 15, respiratory, 16], color_band_payload: { low: "green", mid: "green", high: "yellow" } },
      { vital_key: "body_temperature", label: "Body Temperature", value_text: "98.3", numeric_value: 98.3, unit: "F", status_label: "Normal", baseline_text: "Normal range: 97.5 - 99.5", trend_points: [98.1, 98.2, 98.0, 98.3, 98.2], color_band_payload: { low: "green", mid: "green", high: "red" } },
      { vital_key: "blood_pressure", label: "Blood Pressure", value_text: "118 / 76", numeric_value: 118, secondary_value: 76, unit: "mmHg", status_label: "Normal", baseline_text: "Normal range: < 130/80", trend_points: [116, 118, 117, 118, 119], color_band_payload: { low: "green", mid: "green", high: "red" } }
    ];
  }

  function defaultWellnessContributors() {
    return [
      { contributor_key: "sleep_recovery", label: "Sleep Recovery", status_label: "Good", contribution_points: 18, trend: "helping", display_order: 1 },
      { contributor_key: "activity_mobility", label: "Activity / Mobility", status_label: "Good", contribution_points: 15, trend: "helping", display_order: 2 },
      { contributor_key: "medication_adherence", label: "Medication Adherence", status_label: "Excellent", contribution_points: 20, trend: "helping", display_order: 3 },
      { contributor_key: "mood_mind", label: "Mood & Mind", status_label: "Good", contribution_points: 12, trend: "helping", display_order: 4 },
      { contributor_key: "heart_health", label: "Heart Health", status_label: "Good", contribution_points: 17, trend: "helping", display_order: 5 }
    ];
  }

  function defaultContextIntelligenceState(resident, healthSummary = {}) {
    const steps = Math.round(Number(healthSummary.stepsToday || 4280));
    const mobilityStatus = steps < 2500 ? "Watch" : "Normal";
    const healthStatus = healthSummary.riskLevel === "watch" ? "Watch" : "Stable";
    return {
      dailyStatus: mobilityStatus === "Watch" ? "watch" : "stable",
      risk: {
        health: healthSummary.riskLevel || "low",
        environmental: "watch",
        mobility: mobilityStatus === "Watch" ? "watch" : "low",
        isolation: "watch",
        medication: "low",
        safety: "low"
      },
      guidanceItems: [
        {
          domain: "environment",
          severity: "watch",
          title: "High pollen today",
          body: "Limit outdoor activity this afternoon if allergies flare.",
          action: "Take allergy medication if prescribed."
        },
        {
          domain: "transportation",
          severity: "info",
          title: "Roads look clear for appointments",
          body: "Cardiology transportation can stay on the current schedule.",
          action: "Monitor weather before pickup."
        },
        {
          domain: "health",
          severity: "info",
          title: "Hydration reminder recommended",
          body: "Keep water nearby through the afternoon.",
          action: "Remind every two hours."
        }
      ],
      sections: [
        { key: "health", label: "Health", status: healthStatus, severity: healthStatus === "Watch" ? "watch" : "good" },
        { key: "environment", label: "Environment", status: "Pollen High", severity: "watch" },
        { key: "mobility", label: "Mobility", status: mobilityStatus, severity: mobilityStatus === "Watch" ? "watch" : "good" },
        { key: "social", label: "Social", status: "No family contact 4d", severity: "watch" },
        { key: "safety", label: "Safety", status: "Protected", severity: "good" }
      ],
      environment: {
        status: "Pollen High",
        temperatureF: 72,
        condition: "Partly cloudy",
        aqi: 54,
        pollenLevel: "high",
        smokeRisk: "low",
        heatRisk: "low",
        snowRisk: "none"
      },
      mobility: {
        status: mobilityStatus,
        stepsToday: steps,
        stepsDeltaPercent: -18,
        weatherAdjusted: false,
        explanation: "Activity is slightly lower than usual."
      },
      social: {
        status: "watch",
        daysWithoutFamilyContact: 4
      },
      places: [
        { place_key: "home", name: resident?.community || "Park View Community", category: "home", is_safe_zone: true },
        { place_key: "doctor", name: "Dr. Mehta Clinic", category: "doctor", is_safe_zone: true },
        { place_key: "pharmacy", name: "HealthPlus Pharmacy", category: "pharmacy", is_safe_zone: true }
      ],
      routines: [
        { routine_key: "weekly_pharmacy", title: "Weekly pharmacy visit", routine_type: "pharmacy", status: "watch" }
      ],
      transportationDecisions: [],
      signals: []
    };
  }

  async function buildContextIntelligenceState(resident, healthSummary = {}) {
    if (!resident) return defaultContextIntelligenceState(resident, healthSummary);
    const [
      guidance,
      signals,
      environment,
      alerts,
      mobility,
      social,
      places,
      routines,
      visits,
      transport
    ] = await Promise.all([
      query(`SELECT * FROM guru_daily_guidance WHERE resident_id = $1 ORDER BY guidance_date DESC, created_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM guru_context_signals WHERE resident_id = $1 AND suppressed = false ORDER BY signal_date DESC, created_at DESC LIMIT 12`, [resident.id]),
      query(`SELECT * FROM environment_observations WHERE resident_id = $1 OR resident_id IS NULL ORDER BY observed_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM environment_alerts WHERE (resident_id = $1 OR resident_id IS NULL) AND status = 'active' ORDER BY created_at DESC LIMIT 8`, [resident.id]),
      query(`SELECT * FROM mobility_context_snapshots WHERE resident_id = $1 ORDER BY snapshot_date DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM social_contact_snapshots WHERE resident_id = $1 ORDER BY snapshot_date DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM resident_places WHERE resident_id = $1 ORDER BY is_safe_zone DESC, category, name LIMIT 20`, [resident.id]),
      query(`SELECT * FROM resident_routines WHERE resident_id = $1 ORDER BY status DESC, routine_type LIMIT 20`, [resident.id]),
      query(`SELECT * FROM resident_place_visits WHERE resident_id = $1 ORDER BY visit_started_at DESC LIMIT 20`, [resident.id]),
      query(`SELECT * FROM transportation_context_decisions WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 10`, [resident.id])
    ]);
    const fallback = defaultContextIntelligenceState(resident, healthSummary);
    const guidanceRow = guidance.rows[0];
    const environmentRow = environment.rows[0];
    const mobilityRow = mobility.rows[0];
    const socialRow = social.rows[0];
    const guidanceItems = Array.isArray(guidanceRow?.guidance_items) && guidanceRow.guidance_items.length
      ? guidanceRow.guidance_items
      : (signals.rows.length
        ? signals.rows.slice(0, 3).map(signal => ({
            domain: signal.domain,
            severity: signal.severity,
            title: signal.title,
            body: signal.body,
            action: signal.metadata?.action || ""
          }))
        : fallback.guidanceItems);
    return {
      dailyStatus: guidanceRow?.daily_status || fallback.dailyStatus,
      risk: {
        health: guidanceRow?.health_risk || fallback.risk.health,
        environmental: guidanceRow?.environmental_risk || fallback.risk.environmental,
        mobility: guidanceRow?.mobility_risk || fallback.risk.mobility,
        isolation: guidanceRow?.isolation_risk || fallback.risk.isolation,
        medication: guidanceRow?.medication_risk || fallback.risk.medication,
        safety: guidanceRow?.safety_risk || fallback.risk.safety
      },
      guidanceItems,
      sections: [
        { key: "health", label: "Health", status: guidanceRow?.health_risk === "watch" ? "Watch" : "Stable", severity: guidanceRow?.health_risk === "watch" ? "watch" : "good" },
        { key: "environment", label: "Environment", status: environmentRow?.pollen_tree_level === "high" || environmentRow?.pollen_grass_level === "high" || environmentRow?.pollen_weed_level === "high" ? "Pollen High" : (alerts.rows[0]?.title || fallback.sections[1].status), severity: alerts.rows[0]?.severity || fallback.sections[1].severity },
        { key: "mobility", label: "Mobility", status: mobilityRow?.status || fallback.sections[2].status, severity: mobilityRow?.status === "watch" ? "watch" : "good" },
        { key: "social", label: "Social", status: socialRow?.days_since_family_contact ? `No family contact ${socialRow.days_since_family_contact}d` : fallback.sections[3].status, severity: socialRow?.isolation_risk === "low" ? "good" : "watch" },
        { key: "safety", label: "Safety", status: guidanceRow?.safety_risk === "low" ? "Protected" : "Watch", severity: guidanceRow?.safety_risk === "low" ? "good" : "watch" }
      ],
      environment: environmentRow ? {
        status: alerts.rows[0]?.title || environmentRow.aqi_category || environmentRow.weather_condition || fallback.environment.status,
        temperatureF: environmentRow.temperature_f,
        condition: environmentRow.weather_condition,
        aqi: environmentRow.aqi,
        pollenLevel: environmentRow.pollen_tree_level || environmentRow.pollen_grass_level || environmentRow.pollen_weed_level,
        smokeRisk: environmentRow.smoke_risk,
        heatRisk: environmentRow.heat_risk,
        snowRisk: environmentRow.snow_probability_percent && Number(environmentRow.snow_probability_percent) > 40 ? "watch" : "none"
      } : fallback.environment,
      mobility: mobilityRow ? {
        status: mobilityRow.status,
        stepsToday: mobilityRow.steps_today,
        stepsDeltaPercent: mobilityRow.steps_delta_percent,
        weatherAdjusted: mobilityRow.weather_adjusted,
        explanation: (mobilityRow.reasons || []).join(", ") || fallback.mobility.explanation
      } : fallback.mobility,
      social: socialRow ? {
        status: socialRow.isolation_risk,
        daysWithoutFamilyContact: socialRow.days_since_family_contact,
        trustedCircleTouchCount: socialRow.trusted_circle_touch_count,
        communityInteractionCount: socialRow.community_interaction_count
      } : fallback.social,
      places: places.rows.length ? places.rows : fallback.places,
      routines: routines.rows.length ? routines.rows : fallback.routines,
      recentVisits: visits.rows,
      transportationDecisions: transport.rows,
      alerts: alerts.rows,
      signals: signals.rows
    };
  }

  function clampRiskScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function numericValue(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function integerRiskLevel(value, lowAt = 0, highAt = 100) {
    const numeric = numericValue(value, 0);
    if (numeric <= lowAt) return 0;
    if (numeric >= highAt) return 100;
    return clampRiskScore(((numeric - lowAt) / Math.max(1, highAt - lowAt)) * 100);
  }

  function statusFromRiskScores(scores = {}, emergency = false) {
    if (emergency) return "EMERGENCY";
    const maxRisk = Math.max(
      numericValue(scores.health_risk_score),
      numericValue(scores.mobility_risk_score),
      numericValue(scores.medication_risk_score),
      numericValue(scores.social_risk_score),
      numericValue(scores.environmental_risk_score),
      numericValue(scores.safety_risk_score)
    );
    if (maxRisk > 80) return "NEEDS_CHECKIN";
    if (maxRisk > 60) return "WATCH";
    return "STABLE";
  }

  function textRisk(value) {
    const numeric = numericValue(value);
    if (numeric > 80) return "high";
    if (numeric > 60) return "watch";
    return "low";
  }

  function buildGuruRecommendations(context = {}) {
    const recommendations = [];
    if (numericValue(context.environment?.pollen_level) >= 70) {
      recommendations.push({
        domain: "environment",
        severity: "watch",
        title: "High pollen today",
        body: "Consider limiting outdoor activity if allergies flare.",
        why: "Pollen is above the senior-safe threshold."
      });
    }
    if (numericValue(context.environment?.snow_risk) >= 60 && context.nextBooking) {
      recommendations.push({
        domain: "transportation",
        severity: "watch",
        title: "Leave earlier for your appointment",
        body: "Snow may affect road conditions before the scheduled ride.",
        why: "Weather risk overlaps with an upcoming appointment."
      });
    }
    if (numericValue(context.health?.fall_detected) > 0 || context.health?.fall_detected === true) {
      recommendations.push({
        domain: "safety",
        severity: "emergency",
        title: "Possible fall detected",
        body: "Check location, movement, and heart-rate context immediately.",
        why: "Fall detection has the highest safety priority."
      });
    }
    if (numericValue(context.health?.sleep_minutes, 999) < 300) {
      recommendations.push({
        domain: "health",
        severity: "watch",
        title: "Sleep was lower than normal",
        body: "Take it easier today and watch for fatigue.",
        why: "Low sleep can increase fall and wellness risk."
      });
    }
    if (numericValue(context.mobility?.steps_delta_percent) <= -50 && !context.mobility?.weather_adjusted) {
      recommendations.push({
        domain: "mobility",
        severity: "watch",
        title: "Activity is down sharply",
        body: "A short indoor walk may help if Anita feels steady.",
        why: "Steps are more than 50% below baseline without weather context."
      });
    }
    if (numericValue(context.social?.days_without_family_contact) >= 5) {
      recommendations.push({
        domain: "social",
        severity: "watch",
        title: "Family check-in recommended",
        body: "Rita has not connected recently.",
        why: "Five days without family interaction increases isolation risk."
      });
    }
    if (numericValue(context.medication?.missed7) >= 2) {
      recommendations.push({
        domain: "medication",
        severity: "watch",
        title: "Medication adherence needs attention",
        body: "Two missed doses in seven days should be reviewed.",
        why: "Missed medication patterns are a direct risk signal."
      });
    }
    if (!recommendations.length) {
      recommendations.push({
        domain: "daily",
        severity: "info",
        title: "Stable today",
        body: "No urgent changes were detected across health, mobility, environment, social, or safety.",
        why: "All current risk scores are below the watch threshold."
      });
    }
    return recommendations;
  }

  async function latestGuruIntelligenceContext(resident) {
    const [
      health,
      location,
      environment,
      social,
      mobility,
      safety,
      missed7,
      missed14,
      nextBooking,
      latestScore
    ] = await Promise.all([
      query(`SELECT * FROM health_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC, updated_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM location_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC, updated_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM environmental_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC, updated_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM social_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC, updated_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM mobility_context_snapshots WHERE resident_id = $1 ORDER BY snapshot_date DESC, created_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM safety_events WHERE resident_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 5`, [resident.id]),
      query(`SELECT count(*)::int AS count FROM medications WHERE resident_id = $1 AND status IN ('missed','skipped') AND updated_at >= now() - interval '7 days'`, [resident.id]),
      query(`SELECT count(*)::int AS count FROM medications WHERE resident_id = $1 AND status IN ('missed','skipped') AND updated_at >= now() - interval '14 days'`, [resident.id]),
      query(`SELECT * FROM bookings WHERE resident_id = $1 AND scheduled_for >= now() ORDER BY scheduled_for ASC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM guru_risk_scores WHERE senior_id = $1 ORDER BY score_date DESC, updated_at DESC LIMIT 1`, [resident.id])
    ]);
    return {
      health: health.rows[0] || null,
      location: location.rows[0] || null,
      environment: environment.rows[0] || null,
      social: social.rows[0] || null,
      mobility: mobility.rows[0] || null,
      safetyEvents: safety.rows,
      medication: { missed7: missed7.rows[0]?.count || 0, missed14: missed14.rows[0]?.count || 0 },
      nextBooking: nextBooking.rows[0] || null,
      latestScore: latestScore.rows[0] || null
    };
  }

  async function calculateAndPersistGuruRisk(req, user, resident) {
    const context = await latestGuruIntelligenceContext(resident);
    const healthRisk = clampRiskScore(Math.max(
      integerRiskLevel(300 - numericValue(context.health?.sleep_minutes, 420), 0, 180),
      integerRiskLevel(55 - numericValue(context.health?.oxygen_saturation, 97), 0, 8),
      context.health?.fall_detected ? 100 : 0
    ));
    const mobilityRisk = clampRiskScore(Math.max(
      integerRiskLevel(Math.abs(Math.min(0, numericValue(context.mobility?.steps_delta_percent))), 20, 60),
      integerRiskLevel(numericValue(context.location?.no_movement_minutes), 120, 480),
      integerRiskLevel(numericValue(context.location?.out_of_zone_minutes), 30, 240)
    ));
    const medicationRisk = clampRiskScore(Math.max(
      integerRiskLevel(context.medication.missed7, 0, 3) + (context.medication.missed7 >= 2 ? 25 : 0),
      integerRiskLevel(context.medication.missed14, 0, 4)
    ));
    const socialRisk = clampRiskScore(Math.max(
      integerRiskLevel(numericValue(context.social?.days_without_family_contact), 2, 7),
      integerRiskLevel(numericValue(context.social?.days_without_social_interaction), 4, 14)
    ));
    const environmentalRisk = clampRiskScore(Math.max(
      integerRiskLevel(numericValue(context.environment?.aqi), 50, 150),
      integerRiskLevel(numericValue(context.environment?.pollen_level), 30, 90),
      integerRiskLevel(numericValue(context.environment?.snow_risk), 20, 90),
      integerRiskLevel(numericValue(context.environment?.storm_risk), 20, 90),
      integerRiskLevel(numericValue(context.environment?.wildfire_risk), 20, 90),
      integerRiskLevel(numericValue(context.environment?.heat_risk), 20, 90)
    ));
    const safetyRisk = clampRiskScore(Math.max(
      context.safetyEvents.some(event => ["critical", "emergency"].includes(String(event.severity).toLowerCase())) ? 100 : 0,
      context.safetyEvents.length ? 65 : 0,
      context.health?.fall_detected ? 100 : 0
    ));
    const scoreFields = {
      health_risk_score: healthRisk,
      mobility_risk_score: mobilityRisk,
      medication_risk_score: medicationRisk,
      social_risk_score: socialRisk,
      environmental_risk_score: environmentalRisk,
      safety_risk_score: safetyRisk
    };
    const finalStatus = statusFromRiskScores(scoreFields, safetyRisk >= 100);
    const wellnessScore = clampRiskScore(100 - Math.max(...Object.values(scoreFields)));
    const recommendations = buildGuruRecommendations(context);
    const explanation = {
      status: finalStatus,
      why: recommendations.map(item => item.why),
      context: {
        health: context.health ? { sleepMinutes: context.health.sleep_minutes, oxygenSaturation: context.health.oxygen_saturation, fallDetected: context.health.fall_detected } : null,
        environment: context.environment ? { aqi: context.environment.aqi, pollenLevel: context.environment.pollen_level, snowRisk: context.environment.snow_risk } : null,
        social: context.social ? { daysWithoutFamilyContact: context.social.days_without_family_contact, daysWithoutSocialInteraction: context.social.days_without_social_interaction } : null,
        medication: context.medication
      }
    };
    const riskScore = (await query(
      `INSERT INTO guru_risk_scores (
         senior_id, score_date, wellness_score, health_risk_score, mobility_risk_score,
         medication_risk_score, social_risk_score, environmental_risk_score, safety_risk_score,
         final_status, explanation, recommendations
       ) VALUES ($1,current_date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (senior_id, score_date) DO UPDATE SET
         wellness_score = EXCLUDED.wellness_score,
         health_risk_score = EXCLUDED.health_risk_score,
         mobility_risk_score = EXCLUDED.mobility_risk_score,
         medication_risk_score = EXCLUDED.medication_risk_score,
         social_risk_score = EXCLUDED.social_risk_score,
         environmental_risk_score = EXCLUDED.environmental_risk_score,
         safety_risk_score = EXCLUDED.safety_risk_score,
         final_status = EXCLUDED.final_status,
         explanation = EXCLUDED.explanation,
         recommendations = EXCLUDED.recommendations,
         updated_at = now()
       RETURNING *`,
      [resident.id, wellnessScore, healthRisk, mobilityRisk, medicationRisk, socialRisk, environmentalRisk, safetyRisk, finalStatus, JSON.stringify(explanation), JSON.stringify(recommendations)]
    )).rows[0];
    await query(
      `INSERT INTO guru_daily_guidance (
         resident_id, guidance_date, daily_status, health_risk, environmental_risk,
         mobility_risk, isolation_risk, medication_risk, safety_risk, guidance_items, summary, calculated_from
       ) VALUES ($1,current_date,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (resident_id, guidance_date) DO UPDATE SET
         daily_status = EXCLUDED.daily_status,
         health_risk = EXCLUDED.health_risk,
         environmental_risk = EXCLUDED.environmental_risk,
         mobility_risk = EXCLUDED.mobility_risk,
         isolation_risk = EXCLUDED.isolation_risk,
         medication_risk = EXCLUDED.medication_risk,
         safety_risk = EXCLUDED.safety_risk,
         guidance_items = EXCLUDED.guidance_items,
         summary = EXCLUDED.summary,
         calculated_from = EXCLUDED.calculated_from,
         updated_at = now()`,
      [
        resident.id,
        finalStatus.toLowerCase(),
        textRisk(healthRisk),
        textRisk(environmentalRisk),
        textRisk(mobilityRisk),
        textRisk(socialRisk),
        textRisk(medicationRisk),
        textRisk(safetyRisk),
        JSON.stringify(recommendations),
        recommendations[0]?.title || "Daily status calculated",
        JSON.stringify({ guruRiskScoreId: riskScore.id })
      ]
    );
    await audit(req, user, "guru_risk_recalculated", "guru_risk_score", riskScore.id, { finalStatus, scoreFields }, finalStatus === "STABLE" ? "info" : "warning");
    return { riskScore, recommendations, explanation };
  }

  async function buildResidentSurfaceState(resident, healthSummary = {}) {
    if (!resident) {
      return { schemaVersion: 1 };
    }
    const [
      dailyStatus,
      wellnessScore,
      wellnessContributors,
      vitalMonitor,
      familyHealth,
      riskAssessment,
      riskTimeline,
      events,
      serviceMatches,
      transportMatches,
      contextIntelligence,
      screenStates
    ] = await Promise.all([
      query(`SELECT * FROM resident_daily_status_snapshots WHERE resident_id = $1 ORDER BY snapshot_date DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM wellness_score_snapshots WHERE resident_id = $1 ORDER BY score_date DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM wellness_contributor_snapshots WHERE resident_id = $1 ORDER BY display_order, created_at DESC LIMIT 20`, [resident.id]),
      query(`SELECT * FROM vital_monitor_snapshots WHERE resident_id = $1 ORDER BY captured_at DESC LIMIT 24`, [resident.id]),
      query(`SELECT * FROM family_health_snapshots WHERE resident_id = $1 ORDER BY snapshot_date DESC, created_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM risk_assessments WHERE resident_id = $1 ORDER BY assessed_at DESC LIMIT 1`, [resident.id]),
      query(`SELECT * FROM risk_timeline_events WHERE resident_id = $1 ORDER BY event_date DESC, display_order LIMIT 20`, [resident.id]),
      query(`SELECT * FROM community_events WHERE status = 'published' AND (community IS NULL OR community = $1) ORDER BY starts_at NULLS LAST, created_at DESC LIMIT 25`, [resident.community || null]),
      query(`SELECT * FROM resident_service_matches WHERE resident_id = $1 AND status = 'active' ORDER BY match_score DESC NULLS LAST, created_at DESC LIMIT 20`, [resident.id]),
      query(`SELECT * FROM transportation_match_options WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 10`, [resident.id]),
      buildContextIntelligenceState(resident, healthSummary),
      query(`SELECT DISTINCT ON (screen_key) * FROM resident_screen_states WHERE resident_id = $1 ORDER BY screen_key, updated_at DESC LIMIT 50`, [resident.id])
    ]);
    const score = wellnessScore.rows[0] || {
      wellness_score: 82,
      score_label: "Doing Well",
      change_from_prior: 6,
      confidence_percent: 87,
      range_key: "today"
    };
    const family = familyHealth.rows[0] || {
      stability_status: "stable",
      health_confidence_percent: 87,
      summary_items: [
        { label: "Medication", value: "All taken", status: "good" },
        { label: "Sleep", value: "7h 14m", status: "good" },
        { label: "Activity", value: "4,280 steps", status: "watch" },
        { label: "Heart Rate", value: `${healthSummary.heartRateAvg || 72} bpm resting`, status: "good" },
        { label: "Mood", value: "Good", status: "good" },
        { label: "Hydration", value: "Good", status: "good" }
      ],
      changed_summary: { title: "What changed?", body: "Activity is 18% lower than usual over the last 2 days." },
      recommended_action: { title: "Recommended Action", body: "Encourage a short walk today and check in this evening." },
      guru_note: "Overall Anita is doing well. No immediate concerns."
    };
    const risk = riskAssessment.rows[0] || {
      overall_level: healthSummary.riskLevel || "low",
      urgency_label: "No urgent concerns",
      risk_score: 12,
      contributing_factors: [],
      recommended_actions: []
    };
    const timeline = riskTimeline.rows.length ? riskTimeline.rows : [
      { event_date: new Date().toISOString(), event_type: "normal", title: "Normal", body: "All vitals and activities in normal range.", severity: "normal", display_order: 1 },
      { event_date: new Date(Date.now() - 86400000).toISOString(), event_type: "reduced_activity", title: "Reduced Activity", body: "Steps were 18% below your usual range.", severity: "watch", display_order: 2 },
      { event_date: new Date(Date.now() - 172800000).toISOString(), event_type: "missed_medication", title: "Missed Medication", body: "Evening medication was missed.", severity: "high", display_order: 3 },
      { event_date: new Date(Date.now() - 259200000).toISOString(), event_type: "low_sleep", title: "Low Sleep", body: "Sleep was below the usual range.", severity: "watch", display_order: 4 }
    ];
    return {
      schemaVersion: 1,
      dailyStatus: dailyStatus.rows[0] || {
        stability_status: "stable",
        health_confidence_percent: 87,
        highlights: [],
        guru_insight: { title: "Guru Insight", body: "You slept well and completed your medications yesterday." }
      },
      wellness: {
        score,
        contributors: wellnessContributors.rows.length ? wellnessContributors.rows : defaultWellnessContributors()
      },
      vitals: {
        monitor: vitalMonitor.rows.length ? vitalMonitor.rows : defaultVitalMonitorRows(healthSummary)
      },
      familyHealth: family,
      risk: {
        assessment: risk,
        timeline
      },
      contextIntelligence,
      events: events.rows,
      serviceMatches: serviceMatches.rows,
      transportationMatches: transportMatches.rows,
      screenStates: screenStates.rows
    };
  }

  function clampHealthScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric * 100) / 100));
  }

  function rangeScore(value, ideal, caution, invert = false) {
    if (value === null || value === undefined || value === "") return 70;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 70;
    if (!invert && numeric >= ideal) return 100;
    if (invert && numeric <= ideal) return 100;
    const distance = invert ? numeric - ideal : ideal - numeric;
    return clampHealthScore(100 - Math.max(0, distance) * (100 / Math.max(1, caution)));
  }

  function calculateHealthScore(metrics = {}, recent = []) {
    const sleepScore = rangeScore(metrics.sleepMinutes ?? metrics.sleep_minutes, 420, 240);
    const steps = metrics.steps ?? metrics.steps_today;
    const mobilityMinutes = metrics.mobilityMinutes ?? metrics.mobility_minutes;
    const activityScore = clampHealthScore(Math.max(rangeScore(steps, 5500, 4500), rangeScore(mobilityMinutes, 30, 30)));
    const heartRate = metrics.restingHeartRate ?? metrics.resting_heart_rate ?? metrics.heartRateAvg ?? metrics.heart_rate_avg ?? metrics.heartRate ?? metrics.heart_rate;
    const oxygen = metrics.oxygenSaturation ?? metrics.oxygen_saturation;
    let heartScore = 100;
    if (heartRate !== null && heartRate !== undefined) {
      const hr = Number(heartRate);
      if (Number.isFinite(hr)) {
        if (hr < 45 || hr > 120) heartScore = 35;
        else if (hr < 55 || hr > 105) heartScore = 65;
      }
    }
    if (oxygen !== null && oxygen !== undefined && Number(oxygen) < 92) heartScore = Math.min(heartScore, 35);
    const medicationScore = clampHealthScore(metrics.medicationAdherencePercent ?? metrics.medication_adherence_percent ?? 80);
    const moodScore = clampHealthScore(metrics.moodScore ?? metrics.mood_score ?? 75);
    const wellnessScore = clampHealthScore((sleepScore * 0.25) + (activityScore * 0.20) + (heartScore * 0.20) + (medicationScore * 0.20) + (moodScore * 0.15));
    const riskReasons = [];
    if (Number(steps || 0) > 0 && Number(steps) < 1200) riskReasons.push("low_activity");
    if (Number(mobilityMinutes || 0) > 0 && Number(mobilityMinutes) < 10) riskReasons.push("low_mobility");
    if (Number(metrics.medicationAdherencePercent ?? metrics.medication_adherence_percent ?? 100) < 80) riskReasons.push("missed_medication_pattern");
    if (Number(metrics.sleepMinutes ?? metrics.sleep_minutes ?? 999) < 240) riskReasons.push("low_sleep");
    if (Number(metrics.isolationMinutes ?? metrics.isolation_minutes ?? 0) > 480) riskReasons.push("possible_isolation");
    if (metrics.fallDetected === true || metrics.fall_detected === true) riskReasons.push("fall_detected");
    const recentHr = recent.map(item => Number(item.resting_heart_rate || item.heart_rate_avg)).filter(Number.isFinite);
    if (recentHr.length >= 3 && Math.max(...recentHr) - Math.min(...recentHr) >= 25) riskReasons.push("heart_rate_trend_change");
    let riskLevel = "info";
    if (riskReasons.includes("fall_detected")) riskLevel = "critical";
    else if (riskReasons.length >= 2 || wellnessScore < 55) riskLevel = "high";
    else if (riskReasons.length || wellnessScore < 70) riskLevel = "watch";
    return { wellnessScore, sleepScore, activityScore, heartScore, medicationScore, moodScore, riskLevel, riskReasons };
  }

  function normalizeHealthMetrics(payload = {}) {
    return {
      metricDate: payload.metricDate || payload.metric_date || new Date().toISOString().slice(0, 10),
      source: normalizeProviderId(payload.source || "manual"),
      steps: payload.steps ?? payload.stepsToday ?? null,
      calories: payload.calories ?? payload.caloriesToday ?? null,
      sleepMinutes: payload.sleepMinutes ?? payload.sleep_minutes ?? null,
      restingHeartRate: payload.restingHeartRate ?? payload.resting_heart_rate ?? payload.heartRate ?? null,
      heartRateAvg: payload.heartRateAvg ?? payload.heart_rate_avg ?? payload.heartRate ?? null,
      heartRateMin: payload.heartRateMin ?? null,
      heartRateMax: payload.heartRateMax ?? null,
      respiratoryRate: payload.respiratoryRate ?? payload.respiratory_rate ?? null,
      oxygenSaturation: payload.oxygenSaturation ?? payload.oxygen_saturation ?? null,
      hrv: payload.hrv ?? null,
      medicationAdherencePercent: payload.medicationAdherencePercent ?? payload.medication_adherence_percent ?? null,
      moodScore: payload.moodScore ?? payload.mood_score ?? null,
      fallDetected: payload.fallDetected === true || payload.fall_detected === true,
      isolationMinutes: payload.isolationMinutes ?? payload.isolation_minutes ?? null,
      mobilityMinutes: payload.mobilityMinutes ?? payload.mobility_minutes ?? null,
      manualNotes: payload.manualNotes || payload.manual_notes || null,
      raw: payload.raw || payload
    };
  }

  function healthSourceDisplayName(source) {
    const normalized = normalizeProviderId(source);
    const names = {
      apple_health: "Apple Health",
      ios_healthkit: "Apple Health",
      android_health_connect: "Android Health Connect",
      health_connect: "Android Health Connect",
      fitbit: "Fitbit",
      oura: "Oura",
      garmin: "Garmin",
      whoop: "WHOOP",
      samsung_health: "Samsung Health",
      manual: "Manual Entry"
    };
    return names[normalized] || String(source || "Health Source");
  }

  function sourceRequiresOAuth(source) {
    return ["fitbit", "oura", "garmin", "whoop"].includes(normalizeProviderId(source));
  }

  function healthRangeDays(range) {
    const text = String(range || "7d").toLowerCase();
    if (text === "30d") return 30;
    if (text === "90d") return 90;
    return 7;
  }

  async function healthResidentAccess(user, seniorId, access = "summary") {
    const requestedId = seniorId === "self" ? null : seniorId;
    if (user.role === "senior") {
      const resident = await getResidentForUser(user);
      if (!resident || (requestedId && resident.id !== requestedId)) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      return resident;
    }
    if (user.role === "superadmin") {
      const resident = (await query(`SELECT * FROM residents WHERE id = $1`, [required(requestedId, "seniorId")])).rows[0];
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      return resident;
    }
    if (user.role === "trusted_person") {
      const result = await query(
        `SELECT r.* FROM residents r
         JOIN trusted_connections tc ON tc.resident_id = r.id
         LEFT JOIN health_sharing_permissions hp ON hp.senior_id = r.id AND hp.grantee_user_id = tc.trusted_user_id AND hp.status = 'active'
         WHERE r.id = $1 AND tc.trusted_user_id = $2 AND tc.status = 'approved'
           AND (
             $3 = 'summary'
             OR ($3 = 'trends' AND COALESCE(hp.can_view_trends, true) = true)
             OR ($3 = 'alerts' AND COALESCE(hp.can_view_alerts, true) = true)
           )`,
        [required(requestedId, "seniorId"), user.id, access]
      );
      if (result.rows[0]) return result.rows[0];
    }
    const error = new Error("Insufficient permissions");
    error.status = 403;
    throw error;
  }

  async function persistHealthMetric(req, user, resident, metric) {
    const recent = (await query(
      `SELECT * FROM health_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 14`,
      [resident.id]
    )).rows;
    const savedMetric = (await query(
      `INSERT INTO health_daily_metrics (senior_id, metric_date, source, steps, calories, sleep_minutes, resting_heart_rate, heart_rate_avg, heart_rate_min, heart_rate_max, respiratory_rate, oxygen_saturation, hrv, medication_adherence_percent, mood_score, fall_detected, isolation_minutes, mobility_minutes, manual_notes, raw, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,now())
       ON CONFLICT (senior_id, metric_date, source) DO UPDATE SET
         steps = COALESCE(EXCLUDED.steps, health_daily_metrics.steps),
         calories = COALESCE(EXCLUDED.calories, health_daily_metrics.calories),
         sleep_minutes = COALESCE(EXCLUDED.sleep_minutes, health_daily_metrics.sleep_minutes),
         resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, health_daily_metrics.resting_heart_rate),
         heart_rate_avg = COALESCE(EXCLUDED.heart_rate_avg, health_daily_metrics.heart_rate_avg),
         heart_rate_min = COALESCE(EXCLUDED.heart_rate_min, health_daily_metrics.heart_rate_min),
         heart_rate_max = COALESCE(EXCLUDED.heart_rate_max, health_daily_metrics.heart_rate_max),
         respiratory_rate = COALESCE(EXCLUDED.respiratory_rate, health_daily_metrics.respiratory_rate),
         oxygen_saturation = COALESCE(EXCLUDED.oxygen_saturation, health_daily_metrics.oxygen_saturation),
         hrv = COALESCE(EXCLUDED.hrv, health_daily_metrics.hrv),
         medication_adherence_percent = COALESCE(EXCLUDED.medication_adherence_percent, health_daily_metrics.medication_adherence_percent),
         mood_score = COALESCE(EXCLUDED.mood_score, health_daily_metrics.mood_score),
         fall_detected = EXCLUDED.fall_detected OR health_daily_metrics.fall_detected,
         isolation_minutes = COALESCE(EXCLUDED.isolation_minutes, health_daily_metrics.isolation_minutes),
         mobility_minutes = COALESCE(EXCLUDED.mobility_minutes, health_daily_metrics.mobility_minutes),
         manual_notes = COALESCE(EXCLUDED.manual_notes, health_daily_metrics.manual_notes),
         raw = health_daily_metrics.raw || EXCLUDED.raw,
         updated_at = now()
       RETURNING *`,
      [
        resident.id, metric.metricDate, metric.source, metric.steps, metric.calories, metric.sleepMinutes,
        metric.restingHeartRate, metric.heartRateAvg, metric.heartRateMin, metric.heartRateMax, metric.respiratoryRate,
        metric.oxygenSaturation, metric.hrv, metric.medicationAdherencePercent, metric.moodScore,
        metric.fallDetected, metric.isolationMinutes, metric.mobilityMinutes, metric.manualNotes, JSON.stringify(metric.raw || {})
      ]
    )).rows[0];
    const score = calculateHealthScore(savedMetric, recent);
    const savedScore = (await query(
      `INSERT INTO health_scores (senior_id, metric_date, wellness_score, sleep_score, activity_score, heart_score, medication_score, mood_score, risk_level, risk_reasons, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (senior_id, metric_date) DO UPDATE SET wellness_score = EXCLUDED.wellness_score, sleep_score = EXCLUDED.sleep_score, activity_score = EXCLUDED.activity_score, heart_score = EXCLUDED.heart_score, medication_score = EXCLUDED.medication_score, mood_score = EXCLUDED.mood_score, risk_level = EXCLUDED.risk_level, risk_reasons = EXCLUDED.risk_reasons, updated_at = now()
       RETURNING *`,
      [resident.id, savedMetric.metric_date, score.wellnessScore, score.sleepScore, score.activityScore, score.heartScore, score.medicationScore, score.moodScore, score.riskLevel, score.riskReasons]
    )).rows[0];
    const alerts = [];
    for (const reason of score.riskReasons) {
      const existing = (await query(
        `SELECT * FROM health_alerts WHERE senior_id = $1 AND alert_type = $2 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
        [resident.id, reason]
      )).rows[0];
      if (existing) {
        const updatedExisting = (await query(
          `UPDATE health_alerts
           SET signal_count = signal_count + 1,
               confidence = LEAST(0.99, confidence + 0.12),
               last_signal_at = now(),
               metadata = metadata || $2::jsonb
           WHERE id = $1
           RETURNING *`,
          [existing.id, JSON.stringify({ repeatedAt: new Date().toISOString(), metricId: savedMetric.id })]
        )).rows[0];
        const orchestration = await orchestrateHealthCareAction(req, user, resident, updatedExisting, savedMetric, savedScore, score);
        alerts.push({ ...updatedExisting, orchestration });
        continue;
      }
      const title = reason === "fall_detected" ? "Possible fall detected" : reason.replace(/_/g, " ");
      const initialDecision = healthFalseAlarmDecision(reason, score, { signalCount: 1, confidence: initialHealthConfidence(reason, score) });
      const alert = (await query(
        `INSERT INTO health_alerts (senior_id, score_id, alert_type, severity, title, body, confirmation_status, signal_count, confidence, suppressed_until, action_required, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [resident.id, savedScore.id, reason, score.riskLevel === "info" ? "watch" : score.riskLevel, title, `Guru noticed ${title} for ${user.display_name}. Please review and check in if needed.`, initialDecision.confirmationStatus, 1, initialDecision.confidence, initialDecision.suppressedUntil, initialDecision.actionRequired, JSON.stringify({ metricId: savedMetric.id, source: savedMetric.source, falseAlarmGuard: initialDecision })]
      )).rows[0];
      const orchestration = await orchestrateHealthCareAction(req, user, resident, alert, savedMetric, savedScore, score);
      alerts.push({ ...alert, orchestration });
    }
    if (score.riskLevel === "critical" || score.riskLevel === "high") {
      await createSafetyEvent(req, user, resident.id, "health-intelligence-risk", score.riskLevel, `${user.display_name} has health risk signals: ${score.riskReasons.join(", ")}. Trusted circle notification triggered.`, { scoreId: savedScore.id });
    }
    await audit(req, user, "health_metric_saved", "health_daily_metric", savedMetric.id, { scoreId: savedScore.id, riskLevel: score.riskLevel, riskReasons: score.riskReasons });
    return { metric: savedMetric, score: savedScore, alerts };
  }

  function initialHealthConfidence(reason, score) {
    if (reason === "fall_detected") return 0.91;
    if (score.riskLevel === "critical") return 0.88;
    if (score.riskReasons.length >= 3) return 0.78;
    if (score.riskReasons.length >= 2) return 0.68;
    return 0.54;
  }

  function healthFalseAlarmDecision(reason, score, context = {}) {
    const signalCount = Number(context.signalCount || 1);
    const confidence = Number(context.confidence || initialHealthConfidence(reason, score));
    const now = Date.now();
    const softSignals = new Set(["low_sleep", "low_activity", "low_mobility", "possible_isolation", "missed_medication_pattern", "heart_rate_trend_change"]);
    const immediate = reason === "fall_detected" && confidence >= 0.85;
    const combinedRisk = score.riskReasons.length >= 2 && confidence >= 0.66;
    const repeatedSoftSignal = softSignals.has(reason) && signalCount >= 2;
    const actionRequired = immediate || combinedRisk || repeatedSoftSignal || score.riskLevel === "critical";
    return {
      confidence: Math.max(0.1, Math.min(0.99, confidence)),
      actionRequired,
      confirmationStatus: actionRequired ? "confirmed_for_action" : "watching_for_confirmation",
      suppressedUntil: actionRequired ? null : new Date(now + 45 * 60 * 1000).toISOString(),
      policy: immediate ? "immediate-high-confidence" : repeatedSoftSignal ? "repeated-soft-signal" : combinedRisk ? "combined-risk" : "suppressed-single-soft-signal"
    };
  }

  function careActionForHealthAlert(alert, score) {
    const type = alert.alert_type;
    if (type === "fall_detected") return { actionType: "urgent_safety_check", title: "Immediate safety check", body: "Possible fall detected. Call the senior and verify safety now.", recommendedFor: ["primary_contact", "caregiver"], urgency: "critical" };
    if (type === "missed_medication_pattern") return { actionType: "medication_check", title: "Medication check-in", body: "Medication rhythm changed. Confirm whether the dose was taken and whether a reminder is needed.", recommendedFor: ["trusted_circle", "caregiver"], urgency: score.riskLevel === "high" ? "high" : "watch" };
    if (type === "low_activity" || type === "low_mobility") return { actionType: "mobility_check", title: "Gentle mobility check", body: "Activity is lower than usual. Encourage a short safe walk or check for discomfort.", recommendedFor: ["trusted_circle"], urgency: "watch" };
    if (type === "low_sleep") return { actionType: "sleep_recovery_check", title: "Sleep recovery support", body: "Sleep is below the normal range. Encourage rest and monitor for repeat sleep disruption.", recommendedFor: ["trusted_circle"], urgency: "watch" };
    if (type === "possible_isolation") return { actionType: "connection_check", title: "Connection check", body: "Guru noticed possible isolation. A warm call or visit may help.", recommendedFor: ["trusted_circle"], urgency: "watch" };
    return { actionType: "health_review", title: "Health review", body: "Guru noticed a health signal that should be reviewed.", recommendedFor: ["trusted_circle", "caregiver"], urgency: score.riskLevel === "info" ? "watch" : score.riskLevel };
  }

  async function createRealtimeHealthEvent(residentId, eventType, severity, title, body, sourceTable, sourceId, payload = {}, audience = ["senior", "trusted_circle", "caregiver"]) {
    return (await query(
      `INSERT INTO health_realtime_events (senior_id, event_type, severity, source_table, source_id, audience, title, body, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [residentId, eventType, severity, sourceTable, sourceId, audience, title, body, JSON.stringify(payload)]
    )).rows[0];
  }

  async function notifyCareCircleForAction(residentId, action, event) {
    const userIds = await trustedSafetyUserIds(residentId);
    for (const userId of userIds) {
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1, 'push', $2, $3, 'queued')`,
        [userId, action.title, action.body]
      );
    }
    return { notifiedUserIds: userIds, realtimeEventId: event.id };
  }

  async function orchestrateHealthCareAction(req, user, resident, alert, metric, scoreRow, score) {
    const decision = healthFalseAlarmDecision(alert.alert_type, score, { signalCount: alert.signal_count, confidence: alert.confidence });
    await query(
      `UPDATE health_alerts SET confirmation_status = $2, confidence = $3, suppressed_until = $4, action_required = $5, metadata = metadata || $6::jsonb WHERE id = $1`,
      [alert.id, decision.confirmationStatus, decision.confidence, decision.suppressedUntil, decision.actionRequired, JSON.stringify({ falseAlarmGuard: decision, latestMetricId: metric.id })]
    );
    const watchEvent = await createRealtimeHealthEvent(resident.id, decision.actionRequired ? "health_action_required" : "health_signal_observed", alert.severity, alert.title, alert.body, "health_alerts", alert.id, { alertId: alert.id, metricId: metric.id, scoreId: scoreRow.id, decision });
    if (!decision.actionRequired) {
      await audit(req, user, "health_alert_suppressed_false_alarm_guard", "health_alert", alert.id, decision, "info");
      return { actionRequired: false, decision, realtimeEvent: watchEvent };
    }
    const actionPlan = careActionForHealthAlert(alert, score);
    const existingAction = (await query(`SELECT * FROM health_care_actions WHERE alert_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`, [alert.id])).rows[0];
    const action = existingAction || (await query(
      `INSERT INTO health_care_actions (senior_id, alert_id, action_type, urgency, title, body, recommended_for, false_alarm_guard)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [resident.id, alert.id, actionPlan.actionType, actionPlan.urgency, actionPlan.title, actionPlan.body, actionPlan.recommendedFor, JSON.stringify(decision)]
    )).rows[0];
    const actionEvent = await createRealtimeHealthEvent(resident.id, "care_action_created", action.urgency, action.title, action.body, "health_care_actions", action.id, { alertId: alert.id, actionId: action.id, decision });
    const notificationResult = await notifyCareCircleForAction(resident.id, action, actionEvent);
    await audit(req, user, "health_care_action_created", "health_care_action", action.id, { alertId: alert.id, notificationResult, decision }, auditSeverity(action.urgency));
    return { actionRequired: true, decision, action, realtimeEvent: actionEvent, notificationResult };
  }

  function healthReadingDataTypes(reading) {
    const types = [];
    if (reading.heartRate !== undefined) types.push('heartRate');
    if (reading.oxygenSaturation !== undefined) types.push('oxygenSaturation');
    if (reading.respiratoryRate !== undefined) types.push('respiratoryRate');
    if (reading.hrv !== undefined) types.push('hrv');
    if (reading.sleepMinutes !== undefined) types.push('sleep');
    if (reading.caloriesToday !== undefined) types.push('calories');
    if (reading.stepsToday !== undefined) types.push('steps');
    return types;
  }

  function evaluateWearables(devices, proximity) {
    const summary = {
      connectedCount: devices.filter(device => device.status === 'connected').length,
      lowBatteryCount: devices.filter(device => Number(device.battery_percent ?? device.batteryPercent) <= 20).length,
      sosPressed: devices.some(device => device.sos_pressed === true || device.sosPressed === true),
      fallDetected: devices.some(device => Number((device.fall_confidence ?? device.fallConfidence) || 0) >= 0.82),
      proximityRisk: proximity?.safe === false || Number(proximity?.distanceMeters || proximity?.distance_meters || 0) > 40 ? 'watch' : 'low',
      riskLevel: 'low',
      riskReasons: []
    };
    if (summary.lowBatteryCount) summary.riskReasons.push('wearable-low-battery');
    if (summary.sosPressed) summary.riskReasons.push('wearable-sos-pressed');
    if (summary.fallDetected) summary.riskReasons.push('wearable-fall-detected');
    if (summary.proximityRisk === 'watch') summary.riskReasons.push('proximity-out-of-range');
    if (summary.sosPressed || summary.fallDetected) summary.riskLevel = 'high';
    else if (summary.riskReasons.length) summary.riskLevel = 'watch';
    return summary;
  }

  function healthRiskContext(profile = {}) {
    const text = JSON.stringify(profile || {}).toLowerCase();
    return {
      fallThreshold: text.includes("fall-risk") || text.includes("walker") || text.includes("standby assist") || text.includes("falls in last") ? 0.7 : 0.82,
      stillnessThreshold: text.includes("transfer") || text.includes("standby assist") || text.includes("parkinson") ? 30 : 45,
      wanderingSensitive: text.includes("wandering") && !text.includes("wandering risk\":\"low"),
      fallContext: profile?.mobilityProfile?.transferSupport || profile?.mobilityProfile?.fallHistory || "",
      memoryContext: profile?.memoryProfile?.reassuranceStyle || "",
      emergencyContext: profile?.carePreferences?.emergencyInstructions || ""
    };
  }

  function distanceMeters(lat1, lng1, lat2, lng2) {
    const toRadians = value => (Number(value) * Math.PI) / 180;
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function parseRoutePoint(point = {}, name) {
    const label = String(point.label || "").trim();
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      const error = new Error(`${name} label, latitude, and longitude are required`);
      error.status = 400;
      throw error;
    }
    return { label, lat, lng };
  }

  async function estimateRoute(pickup, dropoff) {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY || "";
    if (googleKey) {
      const params = new URLSearchParams({
        origins: `${pickup.lat},${pickup.lng}`,
        destinations: `${dropoff.lat},${dropoff.lng}`,
        units: "metric",
        key: googleKey
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`);
      const data = await response.json();
      const element = data.rows?.[0]?.elements?.[0];
      if (data.status === "OK" && element?.status === "OK") {
        return {
          distanceMeters: Number(element.distance.value),
          durationSeconds: Number(element.duration.value),
          provider: "google_distance_matrix",
          metadata: { status: data.status, elementStatus: element.status, distanceText: element.distance.text, durationText: element.duration.text }
        };
      }
    }
    const directDistance = distanceMeters(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const roadAdjustedDistance = Math.round(directDistance * 1.28);
    const averageSeniorTransportMetersPerSecond = 8.1;
    return {
      distanceMeters: roadAdjustedDistance,
      durationSeconds: Math.max(300, Math.round(roadAdjustedDistance / averageSeniorTransportMetersPerSecond)),
      provider: "haversine_estimate",
      metadata: { directDistanceMeters: Math.round(directDistance), roadAdjustmentFactor: 1.28 }
    };
  }

  function isTransportationService(service = {}) {
    const text = `${service.name || ""} ${service.category || ""}`.toLowerCase();
    return text.includes("ride") || text.includes("transport") || text.includes("cab") || text.includes("driver");
  }

  function uberHealthConfigured() {
    return Boolean(process.env.UBER_HEALTH_CLIENT_ID && process.env.UBER_HEALTH_CLIENT_SECRET);
  }

  function lyftHealthcareConfigured() {
    return Boolean(process.env.LYFT_HEALTHCARE_CLIENT_ID && process.env.LYFT_HEALTHCARE_CLIENT_SECRET);
  }

  async function ensureRideProviderConfigs() {
    const defaults = [
      {
        provider: "uber_health",
        displayName: "Uber Health",
        configured: uberHealthConfigured(),
        credentialSource: "UBER_HEALTH_CLIENT_ID/UBER_HEALTH_CLIENT_SECRET",
        notes: "Healthcare/guest ride dispatch. Provider may bill the organization account; TheSeniorguru should collect senior/trusted-payer payment before dispatch."
      },
      {
        provider: "lyft_healthcare",
        displayName: "Lyft Healthcare",
        configured: lyftHealthcareConfigured(),
        credentialSource: "LYFT_HEALTHCARE_CLIENT_ID/LYFT_HEALTHCARE_CLIENT_SECRET",
        notes: "Healthcare ride option for Lyft programs. Dispatch requires provider onboarding and credentials."
      },
      {
        provider: "local_partner",
        displayName: "Approved local partner",
        configured: true,
        credentialSource: "approved_business_network",
        notes: "Fallback for approved senior-transport businesses and assisted rides."
      },
      {
        provider: "manual_coordination",
        displayName: "Manual coordination",
        configured: true,
        credentialSource: "care_team_operations",
        notes: "Fallback when automated provider dispatch is not available."
      }
    ];
    for (const item of defaults) {
      await query(
        `INSERT INTO ride_provider_configs (provider, display_name, status, credential_source, credential_status, notes, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (provider) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             status = CASE
               WHEN ride_provider_configs.status IN ('enabled','disabled') THEN ride_provider_configs.status
               ELSE EXCLUDED.status
             END,
             credential_source = EXCLUDED.credential_source,
             credential_status = EXCLUDED.credential_status,
             notes = EXCLUDED.notes,
             metadata = ride_provider_configs.metadata || EXCLUDED.metadata,
             updated_at = now()`,
        [
          item.provider,
          item.displayName,
          item.configured ? "enabled" : "credential_required",
          item.credentialSource,
          item.configured ? "configured" : "missing",
          item.notes,
          JSON.stringify({ envConfigured: item.configured })
        ]
      );
    }
    return (await query(`SELECT * FROM ride_provider_configs ORDER BY provider`)).rows;
  }

  function supportProviderEnvConfigured(provider) {
    if (String(provider || "").toLowerCase() === "google_places") {
      return Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY);
    }
    const key = String(provider || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    return Boolean(process.env[`${key}_CLIENT_ID`] && process.env[`${key}_CLIENT_SECRET`]);
  }

  async function ensureSupportOrderProviderConfigs() {
    const defaults = [
      ["food", "uber_eats", "Uber Eats", "UBER_EATS_CLIENT_ID/UBER_EATS_CLIENT_SECRET", "Partner/API access required. Use only after provider approval."],
      ["food", "grubhub", "Grubhub", "GRUBHUB_CLIENT_ID/GRUBHUB_CLIENT_SECRET", "Partner/API access required; keep credential-gated until approved."],
      ["food", "doordash_drive", "DoorDash Drive", "DOORDASH_DRIVE_CLIENT_ID/DOORDASH_DRIVE_CLIENT_SECRET", "Delivery fulfillment option when order ownership is through TheSeniorguru or partner merchant."],
      ["grocery", "instacart", "Instacart", "INSTACART_CLIENT_ID/INSTACART_CLIENT_SECRET", "Grocery partner/API access required."],
      ["grocery", "walmart", "Walmart", "WALMART_CLIENT_ID/WALMART_CLIENT_SECRET", "Partner/API access required for grocery ordering."],
      ["pharmacy", "local_pharmacy", "Local pharmacy", "approved_business_network", "Approved pharmacy partner fallback."],
      ["errand", "local_partner", "Approved local partner", "approved_business_network", "Approved local support business fallback."],
      ["outdoor", "google_places", "Google Places Outdoor Discovery", "GOOGLE_MAPS_API_KEY", "Nearby parks, trails, gardens, and outdoor destinations. Results are discovery data and need senior-suitability review before referral."],
      ["outdoor", "alltrails_partner", "AllTrails Partner", "ALLTRAILS_CLIENT_ID/ALLTRAILS_CLIENT_SECRET", "Partner/API access required. Keep credential-gated until AllTrails approves access."],
      ["outdoor", "local_partner", "Approved local outdoor partner", "approved_business_network", "Approved senior-friendly outdoor activity partner fallback."],
      ["all", "manual_coordination", "Manual coordination", "care_team_operations", "Manual fallback when partner API credentials are unavailable."]
    ];
    for (const [category, provider, displayName, credentialSource, notes] of defaults) {
      const configured = credentialSource === "approved_business_network" || credentialSource === "care_team_operations" || supportProviderEnvConfigured(provider);
      await query(
        `INSERT INTO support_order_provider_configs (category, provider, display_name, status, credential_source, credential_status, notes, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (category, provider) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             status = CASE
               WHEN support_order_provider_configs.status IN ('enabled','disabled') THEN support_order_provider_configs.status
               ELSE EXCLUDED.status
             END,
             credential_source = EXCLUDED.credential_source,
             credential_status = EXCLUDED.credential_status,
             notes = EXCLUDED.notes,
             metadata = support_order_provider_configs.metadata || EXCLUDED.metadata,
             updated_at = now()`,
        [
          category,
          provider,
          displayName,
          configured ? "enabled" : "credential_required",
          credentialSource,
          configured ? "configured" : "missing",
          notes,
          JSON.stringify({ envConfigured: configured })
        ]
      );
    }
    return (await query(`SELECT * FROM support_order_provider_configs ORDER BY category, provider`)).rows;
  }

  function allowedSupportCategory(category) {
    const value = String(category || "").trim().toLowerCase();
    if (!["ride", "food", "grocery", "pharmacy", "errand", "outdoor"].includes(value)) {
      const error = new Error("Unsupported support order category");
      error.status = 400;
      throw error;
    }
    return value;
  }

  function outdoorKeywordForActivity(activity) {
    const value = String(activity || "").trim().toLowerCase();
    if (value.includes("trail") || value.includes("hike") || value.includes("walking")) return "easy walking trail park";
    if (value.includes("garden")) return "garden park accessible walking";
    if (value.includes("bird") || value.includes("nature")) return "nature preserve walking trail";
    if (value.includes("water") || value.includes("lake") || value.includes("waterfall")) return "waterfront park walking trail";
    if (value.includes("picnic")) return "picnic park accessible";
    return "park walking trail outdoor recreation";
  }

  function seniorSuitabilityForOutdoorPlace(place) {
    const types = Array.isArray(place.types) ? place.types : [];
    const notes = [
      "Confirm path accessibility, benches, bathrooms, weather, supervision needs, and transport before booking."
    ];
    const careRiskFlags = [];
    if (types.includes("tourist_attraction")) careRiskFlags.push("crowd_or_distance_review");
    if (types.includes("amusement_park")) careRiskFlags.push("stimulation_and_fatigue_review");
    if (!place.rating || Number(place.user_ratings_total || 0) < 10) careRiskFlags.push("limited_public_review_data");
    return {
      level: careRiskFlags.length ? "needs_review" : "candidate",
      notes,
      careRiskFlags
    };
  }

  function normalizeFulfillmentMode(mode, service = {}) {
    const requested = String(mode || "").trim();
    if (["uber_health", "lyft_healthcare", "local_partner", "trusted_circle", "manual_coordination"].includes(requested)) return requested;
    return isTransportationService(service) ? "uber_health" : "local_partner";
  }

  function buildFulfillmentOptions(route = null, service = {}) {
    const uberReady = uberHealthConfigured();
    return [
      {
        mode: "uber_health",
        recommended: isTransportationService(service),
        available: uberReady,
        provider: "uber_health",
        lifecycleStatus: uberReady ? "ready_to_dispatch" : "credential_required",
        reason: uberReady ? "Uber Health can be used for guest ride dispatch." : "Uber Health credentials are not configured yet."
      },
      {
        mode: "lyft_healthcare",
        recommended: false,
        available: lyftHealthcareConfigured(),
        provider: "lyft_healthcare",
        lifecycleStatus: lyftHealthcareConfigured() ? "ready_to_dispatch" : "credential_required",
        reason: lyftHealthcareConfigured() ? "Lyft Healthcare can be used for healthcare ride dispatch." : "Lyft Healthcare credentials are not configured yet."
      },
      {
        mode: "local_partner",
        recommended: !uberReady,
        available: Boolean(service?.business_id || service?.businessId || service?.id),
        provider: service?.provider_name || service?.provider || "approved_local_partner",
        lifecycleStatus: "partner_match_required",
        reason: "Use approved local senior-transport businesses only where Uber Health is unavailable or unsuitable."
      },
      {
        mode: "manual_coordination",
        recommended: false,
        available: true,
        provider: "care_team",
        lifecycleStatus: "manual_coordination_required",
        reason: "Fallback for wheelchair support, caregiver handoff, or regions without automated ride fulfillment."
      }
    ].map(option => ({ ...option, distanceMeters: route?.distanceMeters || null, durationSeconds: route?.durationSeconds || null }));
  }

  function ridePricingConfig() {
    return {
      marginBps: Number(process.env.RIDE_PLATFORM_MARGIN_BPS || RIDE_PLATFORM_MARGIN_BPS),
      taxBps: Number(process.env.RIDE_TAX_RATE_BPS || 0),
      refundReserveBps: Number(process.env.RIDE_REFUND_RESERVE_BPS || 0),
      baseFareCents: Number(process.env.RIDE_ESTIMATE_BASE_CENTS || 750),
      perKmCents: Number(process.env.RIDE_ESTIMATE_PER_KM_CENTS || 225),
      perMinuteCents: Number(process.env.RIDE_ESTIMATE_PER_MINUTE_CENTS || 35)
    };
  }

  function estimateProviderBillCents(route = {}, config = ridePricingConfig()) {
    const km = Number(route.distanceMeters || 0) / 1000;
    const minutes = Number(route.durationSeconds || 0) / 60;
    return Math.max(config.baseFareCents, Math.ceil(config.baseFareCents + (km * config.perKmCents) + (minutes * config.perMinuteCents)));
  }

  function calculateRidePricing({ providerBillCents, route = null, provider = "unknown", source = "provider_estimate" }) {
    const config = ridePricingConfig();
    const bill = Math.max(0, Math.ceil(Number(providerBillCents || estimateProviderBillCents(route, config))));
    const refundReserveCents = Math.ceil((bill * config.refundReserveBps) / 10000);
    const platformMarginCents = Math.ceil((bill * config.marginBps) / 10000);
    const taxableAmountCents = bill + refundReserveCents + platformMarginCents;
    const taxCents = Math.ceil((taxableAmountCents * config.taxBps) / 10000);
    const totalChargeCents = bill + refundReserveCents + platformMarginCents + taxCents;
    return {
      currency: "usd",
      provider,
      source,
      providerBillCents: bill,
      taxCents,
      refundReserveCents,
      platformMarginCents,
      totalChargeCents,
      marginBps: config.marginBps,
      taxBps: config.taxBps,
      refundReserveBps: config.refundReserveBps,
      seniorPays: true,
      rule: "total = provider bill + tax + refund reserve + 20% platform margin"
    };
  }

  function calculateSupportOrderPricing({ providerBillCents, provider = "unknown", category = "support_order", source = "provider_bill" }) {
    return calculateRidePricing({ providerBillCents, provider: `${category}:${provider}`, source });
  }

  async function evaluateResidentSafeZone(residentId, location = {}, fallbackStatus = null) {
    const zones = (await query(
      `SELECT * FROM resident_safe_zones
       WHERE resident_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [residentId]
    )).rows;
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!zones.length || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        status: fallbackStatus || "unknown",
        zone: zones[0] || null,
        distanceMeters: null,
        evaluated: false
      };
    }
    const nearest = zones
      .map(zone => ({
        zone,
        distance: distanceMeters(lat, lng, Number(zone.center_lat), Number(zone.center_lng))
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    const radius = Number(nearest.zone.radius_meters);
    return {
      status: nearest.distance <= radius ? "inside" : "outside",
      zone: nearest.zone,
      distanceMeters: Math.round(nearest.distance),
      evaluated: true
    };
  }

  async function trustedSafetyUserIds(residentId) {
    return (await query(
      `SELECT trusted_user_id FROM trusted_connections
       WHERE resident_id = $1 AND status = 'approved' AND ('sos' = ANY(permissions) OR 'safety' = ANY(permissions))`,
      [residentId]
    )).rows.map(row => row.trusted_user_id);
  }

  async function authorizeSafetyEventAccess(user, eventId) {
    if (user.role === "superadmin") {
      const event = (await query(`SELECT * FROM safety_events WHERE id = $1`, [eventId])).rows[0];
      if (!event) {
        const error = new Error("SOS event not found");
        error.status = 404;
        throw error;
      }
      return event;
    }
    const event = (await query(
      `SELECT se.*
       FROM safety_events se
       JOIN trusted_connections tc ON tc.resident_id = se.resident_id
       WHERE se.id = $1
         AND tc.trusted_user_id = $2
         AND tc.status = 'approved'
         AND ('sos' = ANY(tc.permissions) OR 'safety' = ANY(tc.permissions))`,
      [eventId, user.id]
    )).rows[0];
    if (!event) {
      const error = new Error("SOS event is not accessible for this trusted person");
      error.status = 403;
      throw error;
    }
    return event;
  }

  function notificationChannels(severity) {
    if (severity === 'critical') return ['push', 'sms', 'call'];
    if (severity === 'high') return ['push', 'sms'];
    return ['push'];
  }

  async function enqueueNotifications(residentId, event, notifiedUserIds) {
    for (const userId of notifiedUserIds) {
      for (const channel of notificationChannels(event.severity)) {
        await query(
          `INSERT INTO notifications (user_id, event_id, channel, title, body, status)
           VALUES ($1, $2, $3, 'TheSeniorguru safety alert', $4, 'queued')`,
          [userId, event.id, channel, event.body]
        );
      }
    }
  }

  async function createSafetyEvent(req, actor, residentId, eventType, severity, body, metadata = {}) {
    const notified = await trustedSafetyUserIds(residentId);
    const event = (await query(
      `INSERT INTO safety_events (resident_id, event_type, severity, body, notified_user_ids)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [residentId, eventType, severity, body, notified]
    )).rows[0];
    await enqueueNotifications(residentId, event, notified);
    await audit(req, actor, 'sos_event_created', 'safety_event', event.id, { eventType, severity, ...metadata }, auditSeverity(severity));
    return event;
  }

  function classifyVoiceSosCommand(command) {
    const normalized = String(command || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalized.includes('call emergency') || normalized.includes('call 911') || normalized.includes('emergency now')) return { route: '911-and-trusted-circle', emergencyNumber: '911', type: 'voice-sos-911', severity: 'critical', label: 'Guru, call emergency' };
    if (normalized.includes('ambulance') || normalized.includes('need medical help')) return { route: 'ambulance-and-trusted-circle', emergencyNumber: '911', type: 'voice-sos-ambulance', severity: 'critical', label: 'Guru, I need an ambulance' };
    if (normalized.includes('call rita') || normalized.includes('call my daughter') || normalized.includes('call trusted')) return { route: 'trusted-circle-first', emergencyNumber: null, type: 'voice-sos-trusted-circle', severity: 'high', label: 'Guru, call Rita now' };
    return null;
  }

  async function getLeadEntitlement(businessId) {
    const result = await query(`SELECT * FROM subscriptions WHERE business_id = $1`, [businessId]);
    const sub = await refreshSubscriptionPeriod(result.rows[0] || await ensureDefaultSubscription(businessId));
    if (sub?.plan === "growth_100" && sub?.billing_status && sub.billing_status !== "active") {
      return { plan: "growth_100", billingStatus: sub.billing_status, locked: true, lockReason: sub.lock_reason || "billing_not_active", serviceLimit: Infinity, allowed: 0, used: sub.used_leads_month || 0 };
    }
    if (!sub || sub.plan === "free") {
      return { plan: "free", billingStatus: sub?.billing_status || "active", serviceLimit: 1, allowed: FREE_YEARLY_LEADS, used: sub?.used_leads_year || 0 };
    }
    return { plan: "growth_100", billingStatus: sub.billing_status || "active", priceCents: PAID_PLAN_PRICE_CENTS, serviceLimit: Infinity, allowed: PAID_MONTHLY_LEADS + (sub.lead_top_ups || 0), used: sub.used_leads_month || 0 };
  }

  function requireBillingAccess(entitlement, action) {
    if (!entitlement?.locked) return;
    const error = new Error(`Billing is ${entitlement.billingStatus || "not active"}. Restore billing before ${action}.`);
    error.status = 402;
    error.details = {
      paymentRequired: true,
      billingStatus: entitlement.billingStatus,
      lockReason: entitlement.lockReason || "billing_not_active"
    };
    throw error;
  }

  async function businessIdFromStripeObject(object) {
    if (object?.metadata?.businessId) return object.metadata.businessId;
    if (object?.subscription) {
      const bySubscription = (await query(
        `SELECT business_id FROM subscriptions WHERE stripe_subscription_id = $1`,
        [object.subscription]
      )).rows[0];
      if (bySubscription?.business_id) return bySubscription.business_id;
    }
    if (object?.id) {
      const byDeletedSubscription = (await query(
        `SELECT business_id FROM subscriptions WHERE stripe_subscription_id = $1`,
        [object.id]
      )).rows[0];
      if (byDeletedSubscription?.business_id) return byDeletedSubscription.business_id;
    }
    if (object?.customer) {
      const byCustomer = (await query(
        `SELECT business_id FROM subscriptions WHERE stripe_customer_id = $1`,
        [object.customer]
      )).rows[0];
      if (byCustomer?.business_id) return byCustomer.business_id;
    }
    return null;
  }

  async function enqueueBillingNotifications(businessId, title, body, metadata = {}) {
    const recipients = (await query(
      `SELECT owner_user_id AS user_id FROM businesses WHERE id = $1
       UNION
       SELECT id AS user_id FROM users WHERE role = 'superadmin' AND status = 'approved'`,
      [businessId]
    )).rows.map(row => row.user_id).filter(Boolean);
    for (const userId of recipients) {
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1, 'push', $2, $3, 'queued')`,
        [userId, title, body]
      );
    }
    await query(
      `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
       VALUES ('subscription', $1, 'billing_notifications_queued', 'info', $2)`,
      [businessId, JSON.stringify({ recipients: recipients.length, title, ...metadata })]
    );
    return recipients.length;
  }

  async function evaluateLaunchReadiness() {
    const requiredTables = [
      "users",
      "sessions",
      "residents",
      "trusted_connections",
      "businesses",
      "subscriptions",
      "services",
      "leads",
      "bookings",
      "medications",
      "resident_diagnoses",
      "resident_allergies",
      "resident_mobility_profiles",
      "resident_cognitive_support_profiles",
      "medication_inventory_events",
      "medication_refill_requests",
      "safety_telemetry",
      "resident_safe_zones",
      "safety_events",
      "health_consents",
      "health_vitals",
      "wearable_devices",
      "wearable_telemetry",
      "notifications",
      "audit_logs",
      "ride_provider_configs",
      "support_order_provider_configs",
      "support_orders",
      "stripe_webhook_events"
    ];
    const tableRows = (await query(
      `SELECT table_name, to_regclass('public.' || table_name) IS NOT NULL AS exists
       FROM unnest($1::text[]) AS table_name
       ORDER BY table_name`,
      [requiredTables]
    )).rows;
    const missingTables = tableRows.filter(row => !row.exists).map(row => row.table_name);
    const counts = (await query(
      `SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM residents) AS residents,
          (SELECT count(*)::int FROM businesses) AS businesses,
          (SELECT count(*)::int FROM services) AS services,
          (SELECT count(*)::int FROM medications) AS medications,
          (SELECT count(*)::int FROM trusted_connections) AS trusted_connections,
          (SELECT count(*)::int FROM bookings) AS bookings,
          (SELECT count(*)::int FROM notifications WHERE status IN ('queued','sent')) AS notifications,
          (SELECT count(*)::int FROM audit_logs) AS audit_logs`
    )).rows[0];
    const rideProviders = await ensureRideProviderConfigs();
    const supportProviders = await ensureSupportOrderProviderConfigs();
    const configuredRideProviders = rideProviders.filter(item => item.status === "enabled");
    const manualRideReady = configuredRideProviders.some(item => ["manual_coordination", "local_partner"].includes(item.provider));
    const automatedRideReady = configuredRideProviders.some(item => ["uber_health", "lyft_healthcare"].includes(item.provider));
    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
    const googleMapsConfigured = Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY);
    const checks = [
      {
        key: "database",
        label: "Database connection",
        status: "pass",
        severity: "blocker",
        detail: "Postgres accepted the readiness query."
      },
      {
        key: "schema",
        label: "Required schema",
        status: missingTables.length ? "fail" : "pass",
        severity: "blocker",
        detail: missingTables.length ? `Missing tables: ${missingTables.join(", ")}` : `${requiredTables.length} required tables are present.`
      },
      {
        key: "stripe",
        label: "Stripe payments and webhooks",
        status: stripeConfigured ? "pass" : "fail",
        severity: "blocker",
        detail: stripeConfigured ? "Stripe secret and webhook secret are configured." : "Stripe secret and webhook secret must both be configured before paid plans and ride payments launch."
      },
      {
        key: "google_maps",
        label: "Google Maps",
        status: googleMapsConfigured ? "pass" : "fail",
        severity: "blocker",
        detail: googleMapsConfigured ? "Google Maps key is configured for places, routes, address validation, and nearby discovery." : "Google Maps key is missing."
      },
      {
        key: "resident_core",
        label: "Resident onboarding and care profile",
        status: Number(counts.residents) > 0 && Number(counts.medications) > 0 ? "pass" : "fail",
        severity: "blocker",
        detail: `${counts.residents} residents and ${counts.medications} medications found.`
      },
      {
        key: "trusted_circle",
        label: "Trusted circle safety access",
        status: Number(counts.trusted_connections) > 0 ? "pass" : "warning",
        severity: "launch_warning",
        detail: `${counts.trusted_connections} trusted connections found.`
      },
      {
        key: "business_marketplace",
        label: "Business onboarding and services",
        status: Number(counts.businesses) > 0 && Number(counts.services) > 0 ? "pass" : "warning",
        severity: "launch_warning",
        detail: `${counts.businesses} businesses and ${counts.services} services found.`
      },
      {
        key: "ride_fulfillment",
        label: "Ride fulfillment",
        status: automatedRideReady ? "pass" : (manualRideReady ? "gated" : "fail"),
        severity: manualRideReady ? "vendor_gated" : "blocker",
        detail: automatedRideReady
          ? "At least one automated healthcare ride provider is enabled."
          : (manualRideReady ? "Automated Uber/Lyft dispatch is credential-gated; manual/local coordination is available." : "No ride fulfillment path is enabled.")
      },
      {
        key: "support_orders",
        label: "Food, grocery, pharmacy, outdoor support orders",
        status: supportProviders.some(item => item.status === "enabled") ? "gated" : "warning",
        severity: "vendor_gated",
        detail: "Partner APIs can stay credential-gated if manual/local coordination remains enabled and visible."
      },
      {
        key: "audit_logging",
        label: "Audit logging",
        status: Number(counts.audit_logs) >= 0 ? "pass" : "fail",
        severity: "blocker",
        detail: `${counts.audit_logs} audit log rows found.`
      }
    ];
    const blockers = checks.filter(check => check.severity === "blocker" && check.status === "fail");
    const warnings = checks.filter(check => ["warning", "gated"].includes(check.status));
    return {
      launchTarget: "Monday MVP v1",
      evaluatedAt: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
      launchable: blockers.length === 0,
      blockers,
      warnings,
      checks,
      counts,
      providerReadiness: {
        rideProviders: rideProviders.map(item => ({
          provider: item.provider,
          displayName: item.display_name,
          status: item.status,
          credentialStatus: item.credential_status,
          paymentModel: item.payment_model
        })),
        supportProviders: supportProviders.map(item => ({
          category: item.category,
          provider: item.provider,
          displayName: item.display_name,
          status: item.status,
          credentialStatus: item.credential_status,
          paymentModel: item.payment_model
        }))
      },
      configuredServices: {
        stripe: stripeConfigured,
        googleMaps: googleMapsConfigured,
        uberHealth: uberHealthConfigured(),
        lyftHealthcare: lyftHealthcareConfigured()
      }
    };
  }

  async function route(req, payload, url) {
    if (req.method === "POST" && url.pathname === "/api/stripe/webhook") {
      if (!verifyStripeSignature(req.rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET)) {
        const error = new Error("Invalid Stripe webhook signature");
        error.status = 400;
        throw error;
      }
      const event = JSON.parse(req.rawBody || "{}");
      if (!event.id) {
        const error = new Error("Stripe webhook event id is required");
        error.status = 400;
        throw error;
      }
      const ledger = (await query(
        `INSERT INTO stripe_webhook_events (id, type, metadata)
         VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [event.id, event.type || "unknown", JSON.stringify({ livemode: event.livemode === true })]
      )).rows[0];
      if (!ledger) {
        return { received: true, duplicate: true };
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object || {};
        const businessId = session.metadata?.businessId || session.client_reference_id;
        if (businessId && session.mode === "subscription") {
          await query(
            `UPDATE subscriptions
             SET plan = 'growth_100',
                 billing_status = 'active',
                 lock_reason = null,
                 locked_at = null,
                 stripe_customer_id = $1,
                 stripe_subscription_id = $2,
                 used_leads_month = 0,
                 current_period_start = date_trunc('month', now()),
                 current_period_end = date_trunc('month', now()) + interval '1 month',
                 updated_at = now()
             WHERE business_id = $3`,
            [session.customer || null, session.subscription || null, businessId]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('subscription', $1, 'stripe_checkout_completed', 'info', $2)`,
            [businessId, JSON.stringify({ stripeSessionId: session.id, stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription })]
          );
        }
      }
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data?.object || {};
        const businessId = await businessIdFromStripeObject(subscription);
        if (businessId) {
          await query(
            `UPDATE subscriptions
             SET plan = 'free',
                 billing_status = 'cancelled',
                 lock_reason = 'subscription_cancelled',
                 locked_at = now(),
                 stripe_subscription_id = $1,
                 used_leads_month = 0,
                 lead_top_ups = 0,
                 current_period_start = date_trunc('year', now()),
                 current_period_end = date_trunc('year', now()) + interval '1 year',
                 updated_at = now()
             WHERE business_id = $2`,
            [subscription.id || null, businessId]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('subscription', $1, 'stripe_subscription_cancelled', 'warning', $2)`,
            [businessId, JSON.stringify({ stripeSubscriptionId: subscription.id })]
          );
          await enqueueBillingNotifications(
            businessId,
            "Billing subscription cancelled",
            "Your Growth package was cancelled and your account has been moved to the Free package. Paid lead actions are disabled until billing is restored.",
            { stripeSubscriptionId: subscription.id, source: "customer.subscription.deleted" }
          );
        }
      }
      if (event.type === "invoice.payment_failed") {
        const invoice = event.data?.object || {};
        const businessId = await businessIdFromStripeObject(invoice);
        if (businessId) {
          await query(
            `UPDATE subscriptions
             SET billing_status = 'payment_failed',
                 lock_reason = 'invoice_payment_failed',
                 locked_at = now(),
                 updated_at = now()
             WHERE business_id = $1`,
            [businessId]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('subscription', $1, 'stripe_payment_failed', 'warning', $2)`,
            [businessId, JSON.stringify({ stripeInvoiceId: invoice.id, stripeCustomerId: invoice.customer, stripeSubscriptionId: invoice.subscription })]
          );
          await enqueueBillingNotifications(
            businessId,
            "Billing payment failed",
            "We could not process your Growth package payment. Service creation, lead top-ups, and lead acceptance are paused until billing is restored.",
            { stripeInvoiceId: invoice.id, stripeCustomerId: invoice.customer, stripeSubscriptionId: invoice.subscription, source: "invoice.payment_failed" }
          );
        }
      }
      if (event.type === "invoice.paid") {
        const invoice = event.data?.object || {};
        const businessId = await businessIdFromStripeObject(invoice);
        if (businessId) {
          await query(
            `UPDATE subscriptions
             SET plan = 'growth_100',
                 billing_status = 'active',
                 lock_reason = null,
                 locked_at = null,
                 stripe_customer_id = coalesce($2, stripe_customer_id),
                 stripe_subscription_id = coalesce($3, stripe_subscription_id),
                 current_period_start = date_trunc('month', now()),
                 current_period_end = date_trunc('month', now()) + interval '1 month',
                 updated_at = now()
             WHERE business_id = $1`,
            [businessId, invoice.customer || null, invoice.subscription || null]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('subscription', $1, 'stripe_invoice_paid', 'info', $2)`,
            [businessId, JSON.stringify({ stripeInvoiceId: invoice.id, stripeCustomerId: invoice.customer, stripeSubscriptionId: invoice.subscription })]
          );
          await enqueueBillingNotifications(
            businessId,
            "Billing restored",
            "Your Growth package billing is active again. Service creation, lead top-ups, and lead acceptance are available.",
            { stripeInvoiceId: invoice.id, stripeCustomerId: invoice.customer, stripeSubscriptionId: invoice.subscription, source: "invoice.paid" }
          );
        }
      }
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data?.object || {};
        const kind = paymentIntent.metadata?.kind;
        const entityId = paymentIntent.metadata?.entityId;
        if (kind === "ride_booking" && entityId) {
          await query(
            `UPDATE bookings
             SET payment_status = 'paid',
                 lifecycle_status = CASE WHEN lifecycle_status = 'credential_required' THEN lifecycle_status ELSE 'ready_to_dispatch' END,
                 payment_metadata = payment_metadata || $1::jsonb,
                 updated_at = now()
             WHERE id = $2`,
            [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status, paidAt: new Date().toISOString() }), entityId]
          );
          await query(
            `UPDATE leads
             SET payment_status = 'paid',
                 lifecycle_status = CASE WHEN lifecycle_status = 'credential_required' THEN lifecycle_status ELSE 'ready_to_dispatch' END,
                 payment_metadata = payment_metadata || $1::jsonb,
                 updated_at = now()
             WHERE id = (SELECT lead_id FROM bookings WHERE id = $2)`,
            [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status, paidAt: new Date().toISOString() }), entityId]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('booking', $1, 'stripe_ride_payment_succeeded', 'info', $2)`,
            [entityId, JSON.stringify({ stripePaymentIntentId: paymentIntent.id, amountReceived: paymentIntent.amount_received })]
          );
        }
        if (kind === "support_order" && entityId) {
          await query(
            `UPDATE support_orders
             SET payment_status = 'paid',
                 lifecycle_status = CASE WHEN lifecycle_status = 'credential_required' THEN lifecycle_status ELSE 'ready_to_dispatch' END,
                 payment_metadata = payment_metadata || $1::jsonb,
                 updated_at = now()
             WHERE id = $2`,
            [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status, paidAt: new Date().toISOString() }), entityId]
          );
          await query(
            `INSERT INTO audit_logs (entity_type, entity_id, action, severity, metadata)
             VALUES ('support_order', $1, 'stripe_order_payment_succeeded', 'info', $2)`,
            [entityId, JSON.stringify({ stripePaymentIntentId: paymentIntent.id, amountReceived: paymentIntent.amount_received })]
          );
        }
      }
      if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data?.object || {};
        const kind = paymentIntent.metadata?.kind;
        const entityId = paymentIntent.metadata?.entityId;
        if (kind === "ride_booking" && entityId) {
          await query(`UPDATE bookings SET payment_status = 'payment_failed', payment_metadata = payment_metadata || $1::jsonb, updated_at = now() WHERE id = $2`, [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status, failureMessage: paymentIntent.last_payment_error?.message || null }), entityId]);
          await query(`UPDATE leads SET payment_status = 'payment_failed', payment_metadata = payment_metadata || $1::jsonb, updated_at = now() WHERE id = (SELECT lead_id FROM bookings WHERE id = $2)`, [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status }), entityId]);
        }
        if (kind === "support_order" && entityId) {
          await query(`UPDATE support_orders SET payment_status = 'payment_failed', payment_metadata = payment_metadata || $1::jsonb, updated_at = now() WHERE id = $2`, [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status, failureMessage: paymentIntent.last_payment_error?.message || null }), entityId]);
        }
      }
      return { received: true };
    }

    if (req.method === "POST" && url.pathname === "/api/auth/device-session") {
      const installationId = required(payload.installationId, "installationId");
      const role = ["senior", "trusted_person", "business"].includes(payload.role) ? payload.role : "senior";
      const installHash = hashToken(String(installationId)).slice(0, 32);
      const email = `install-${installHash}@device.theseniorguru.local`;
      let user = (await query(`SELECT * FROM users WHERE email = $1`, [email])).rows[0];
      if (!user) {
        user = (await query(
          `INSERT INTO users (email, display_name, role, status)
           VALUES ($1, $2, $3, 'approved')
           RETURNING *`,
          [email, payload.displayName || (role === "business" ? "Business Owner" : role === "trusted_person" ? "Trusted Person" : "Senior"), role]
        )).rows[0];
        if (role === "senior") {
          await query(
            `INSERT INTO residents (user_id, onboarding_complete)
             VALUES ($1, false)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id]
          );
        }
        await audit(req, user, "device_user_bootstrapped", "user", user.id, { role }, "info");
      }
      const token = crypto.randomBytes(32).toString("hex");
      await query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
        [user.id, hashToken(token)]
      );
      await audit(req, user, "device_session_created", "session", null, { role }, "info");
      return { token, user };
    }

    if (req.method === "POST" && url.pathname === "/api/auth/dev-session") {
      const email = required(payload.email, "email");
      let user = (await query(`SELECT * FROM users WHERE email = $1`, [email])).rows[0];
      if (!user) {
        const bootstrapUsers = {
          "anita@theseniorguru.local": { role: "senior", name: "Anita Sharma", phone: "+13035550101" },
          "rohit@careride.local": { role: "business", name: "Rohit Mehta", phone: "+13035550104" },
          "rita@theseniorguru.local": { role: "trusted_person", name: "Rita Sharma", phone: "+13035550102" },
          "arjun@theseniorguru.local": { role: "trusted_person", name: "Arjun Sharma", phone: "+13035550103" },
          "drmehta@theseniorguru.local": { role: "trusted_person", name: "Dr. Mehta", phone: "+13035550105" },
          "sunita@theseniorguru.local": { role: "trusted_person", name: "Sunita Patel", phone: "+13035550106" },
          "admin@theseniorguru.local": { role: "superadmin", name: "TheSeniorguru Admin", phone: "+13035550100" }
        };
        const bootstrap = bootstrapUsers[email];
        if (!bootstrap) {
          const error = new Error("User not found");
          error.status = 404;
          throw error;
        }
        user = (await query(
          `INSERT INTO users (email, display_name, role, status)
           VALUES ($1, $2, $3, 'approved')
           RETURNING *`,
          [email, bootstrap.name, bootstrap.role]
        )).rows[0];
        if (bootstrap.role === "senior") {
          await query(
            `INSERT INTO residents (user_id, age, community, onboarding_complete)
             VALUES ($1, 68, 'Park View Community', false)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.id]
          );
        }
        if (bootstrap.role === "business") {
          const business = (await query(
            `INSERT INTO businesses (owner_user_id, name, contact_person, email, phone, website, google_business_profile, description, demographics, service_areas, status, onboarding_complete)
             VALUES ($1, 'CareRide', 'Rohit Mehta', $2, '(555) 013-2234', '', '', 'Senior transportation and appointment support.', '{}', '{}', 'draft', false)
             RETURNING *`,
            [user.id, email]
          )).rows[0];
          await ensureDefaultSubscription(business.id);
        }
        await audit(req, user, "dev_user_bootstrapped", "user", user.id, { email, role: bootstrap.role }, "warning");
      }
      const bootstrapUsers = {
        "anita@theseniorguru.local": "+13035550101",
        "rohit@careride.local": "+13035550104",
        "rita@theseniorguru.local": "+13035550102",
        "arjun@theseniorguru.local": "+13035550103",
        "drmehta@theseniorguru.local": "+13035550105",
        "sunita@theseniorguru.local": "+13035550106",
        "admin@theseniorguru.local": "+13035550100"
      };
      if (!user.phone && bootstrapUsers[email]) {
        user = (await query(`UPDATE users SET phone = $1, updated_at = now() WHERE id = $2 RETURNING *`, [bootstrapUsers[email], user.id])).rows[0];
      }
      const token = crypto.randomBytes(32).toString("hex");
      await query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
        [user.id, hashToken(token)]
      );
      await audit(req, user, "dev_session_created", "session", null, { email });
      return { token, user };
    }

    const user = await currentUser(req);

    if (req.method === "GET" && url.pathname === "/api/me") {
      return { user };
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      if (user.role === "superadmin") {
        const approvals = await query(
          `SELECT
            (SELECT count(*) FROM businesses WHERE status = 'pending_review')::int AS pending_businesses,
            (SELECT count(*) FROM services WHERE status = 'pending_review')::int AS pending_services,
            (SELECT count(*) FROM safety_events WHERE status = 'active')::int AS active_safety_events`
        );
        return { user, superadmin: approvals.rows[0] };
      }
      if (user.role === "business") {
        const business = await getBusinessForUser(user);
        const subscription = business ? await ensureDefaultSubscription(business.id) : null;
        const services = business ? (await query(`SELECT * FROM services WHERE business_id = $1 ORDER BY created_at DESC`, [business.id])).rows : [];
        const requests = business ? (await query(
          `SELECT l.*, r_user.display_name AS resident_name
           FROM leads l
           JOIN residents r ON r.id = l.resident_id
           JOIN users r_user ON r_user.id = r.user_id
           WHERE l.business_id = $1 ORDER BY l.created_at DESC`,
          [business.id]
        )).rows : [];
        const bookings = business ? (await query(
          `SELECT b.*, r_user.display_name AS resident_name
           FROM bookings b
           JOIN residents r ON r.id = b.resident_id
           JOIN users r_user ON r_user.id = r.user_id
           WHERE b.business_id = $1 ORDER BY b.created_at DESC`,
          [business.id]
        )).rows : [];
        const refillRequests = business ? (await query(
          `SELECT rr.*, m.name AS medication_name, m.strength, m.remaining_count, m.refill_threshold, r_user.display_name AS resident_name
           FROM medication_refill_requests rr
           JOIN medications m ON m.id = rr.medication_id
           JOIN residents r ON r.id = rr.resident_id
           JOIN users r_user ON r_user.id = r.user_id
           WHERE rr.business_id = $1
           ORDER BY rr.requested_at DESC`,
          [business.id]
        )).rows : [];
        return {
          user,
          business: toBusinessState(business, subscription),
          services: services.map(service => toServiceState(service, business)),
          requests: requests.map(lead => toLeadState(lead, services.find(service => service.id === lead.service_id), business)),
          bookings: bookings.map(booking => toBookingState(booking, business)),
          refillRequests,
          subscription
        };
      }
      if (user.role === "senior") {
        const resident = await getResidentForUser(user);
        const services = (await query(
          `SELECT s.*, b.name AS provider_name
           FROM services s
           JOIN businesses b ON b.id = s.business_id
           WHERE s.status = 'approved' AND b.status = 'approved'
           ORDER BY s.created_at DESC`
        )).rows;
        const people = resident ? (await query(
          `SELECT u.id, u.display_name AS name, u.role, u.phone, tc.permissions, tc.status
           FROM trusted_connections tc JOIN users u ON u.id = tc.trusted_user_id
           WHERE tc.resident_id = $1`,
          [resident.id]
        )).rows : [];
        const bookings = resident ? (await query(`SELECT * FROM bookings WHERE resident_id = $1 ORDER BY created_at DESC`, [resident.id])).rows : [];
        const safetyEvents = resident ? (await query(`SELECT * FROM safety_events WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 25`, [resident.id])).rows : [];
        const telemetry = resident ? (await query(`SELECT * FROM safety_telemetry WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 1`, [resident.id])).rows[0] : null;
        const safeZones = resident ? (await query(`SELECT * FROM resident_safe_zones WHERE resident_id = $1 AND status = 'active' ORDER BY created_at DESC`, [resident.id])).rows : [];
        const healthConsent = resident ? (await query(`SELECT * FROM health_consents WHERE resident_id = $1`, [resident.id])).rows[0] : null;
        const healthRows = resident ? (await query(`SELECT * FROM health_vitals WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 24`, [resident.id])).rows : [];
        const healthSummary = evaluateHealthVitals(healthRows);
        const latestHealthSummary = evaluateHealthVitals(healthRows.slice(0, 1));
        const residentSurface = resident ? await buildResidentSurfaceState(resident, healthSummary) : { schemaVersion: 1 };
        const wearableDevices = resident ? (await query(`SELECT * FROM wearable_devices WHERE resident_id = $1 ORDER BY updated_at DESC`, [resident.id])).rows : [];
        const wearableRows = resident ? (await query(`SELECT * FROM wearable_telemetry WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 10`, [resident.id])).rows : [];
        const medications = resident ? (await query(
          `SELECT id::text, name, condition, strength, dose_quantity AS "doseQuantity", dose_time AS time,
             frequency, remaining_count AS remaining, refill_threshold AS "refillThreshold",
             prescriber, pharmacy, status, last_confirmed_at AS "lastConfirmedAt"
           FROM medications
           WHERE resident_id = $1
           ORDER BY CASE WHEN status = 'taken' THEN 1 ELSE 0 END, dose_time, created_at`,
          [resident.id]
        )).rows : [];
        const refillRequests = resident ? (await query(
          `SELECT rr.*, m.name AS medication_name, m.strength, b.name AS business_name
           FROM medication_refill_requests rr
           JOIN medications m ON m.id = rr.medication_id
           LEFT JOIN businesses b ON b.id = rr.business_id
           WHERE rr.resident_id = $1
           ORDER BY rr.requested_at DESC`,
          [resident.id]
        )).rows : [];
        const circleMessages = resident ? (await query(
          `SELECT cm.*, u.display_name AS trusted_name
           FROM circle_messages cm
           JOIN users u ON u.id = cm.trusted_user_id
           WHERE cm.resident_id = $1
           ORDER BY cm.created_at DESC LIMIT 25`,
          [resident.id]
        )).rows : [];
        const circleCallRequests = resident ? (await query(
          `SELECT cr.*, u.display_name AS trusted_name
           FROM circle_call_requests cr
           JOIN users u ON u.id = cr.trusted_user_id
           WHERE cr.resident_id = $1
           ORDER BY cr.created_at DESC LIMIT 25`,
          [resident.id]
        )).rows : [];
        const residentProfile = resident ? {
          ...resident,
          healthProfile: resident.health_profile && Object.keys(resident.health_profile).length ? resident.health_profile : {
            primaryCondition: { name: (resident.health_conditions || [])[0] || "", status: "", severity: "", diagnosedWhen: "", symptomsToWatch: [], careTeamNotes: "" },
            allergyProfile: { allergen: (resident.allergies || [])[0] || "", reaction: "", severity: "", instructions: "" },
            mobilityProfile: { assistiveDevice: "", fallHistory: "", transferSupport: resident.mobility_notes || "", walkingTolerance: "", homeRiskAreas: [] },
            memoryProfile: { wanderingRisk: "", confusionTriggers: [], reassuranceStyle: resident.cognitive_support || "", routineAnchors: [] },
            carePreferences: { preferredHospital: "", emergencyInstructions: "" }
          }
        } : null;
        return { user, resident: residentProfile, people, bookings, services: services.map(service => toServiceState(service, { name: service.provider_name })), medications, refillRequests, circleMessages, circleCallRequests, safety: { latestTelemetry: telemetry, safeZones, sosEvents: safetyEvents }, healthConsent, healthVitals: { readings: healthRows, summary: healthSummary, latestSummary: latestHealthSummary }, wearables: { devices: wearableDevices, readings: wearableRows, latestSummary: evaluateWearables(wearableDevices, wearableRows[0] || {}) }, residentSurface };
      }
      if (user.role === "trusted_person") {
        const connections = await query(
          `SELECT tc.*, r.community, r.mood, u.display_name AS resident_name
           FROM trusted_connections tc
           JOIN residents r ON r.id = tc.resident_id
           JOIN users u ON u.id = r.user_id
           WHERE tc.trusted_user_id = $1`,
          [user.id]
        );
        return { user, connections: connections.rows };
      }
    }

    if (req.method === "POST" && url.pathname === "/api/onboarding/senior") {
      const requiredFields = ["name"];
      const missing = requiredFields.filter(field => !payload[field]);
      if (missing.length) {
        const error = new Error(`Missing senior onboarding fields: ${missing.join(", ")}`);
        error.status = 400;
        throw error;
      }
      const result = await transaction(async tx => {
        const session = (await tx(
          `INSERT INTO onboarding_sessions (role, account_id, status, current_step, payload, completed_at)
           VALUES ('senior', $1, 'complete', 'complete', $2, now()) RETURNING *`,
          [user.id, JSON.stringify(payload)]
        )).rows[0];
        const profile = (await tx(
          `INSERT INTO senior_onboarding_profiles (onboarding_session_id, senior_account_id, full_name, preferred_name, phone, email, date_of_birth, address_line, living_type)
           VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::date,$8,$9) RETURNING *`,
          [session.id, user.id, payload.name, payload.preferredName || null, payload.phone, payload.email || null, payload.dob || null, payload.address || null, payload.livingType || null]
        )).rows[0];
        await tx(`UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`, [payload.preferredName || payload.name, user.id]);
        await tx(
          `INSERT INTO senior_health_onboarding (senior_profile_id, health_concerns, allergies, mobility_notes, baseline_metrics, wearable_sources, health_data_scopes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [profile.id, payload.healthConcerns || [], payload.allergies || null, payload.mobility || null, JSON.stringify({ height: payload.height, weight: payload.weight, bloodPressure: payload.bloodPressure, heartRate: payload.heartRate, medications: payload.medications }), payload.wearableSources || [], payload.devicePermissions || []]
        );
        const capturedEvidenceIds = [payload.profilePhotoEvidenceId, payload.livenessEvidenceId].filter(isUuid);
        if (capturedEvidenceIds.length) {
          await tx(
            `UPDATE identity_evidence
             SET onboarding_session_id = $1, subject_account_id = $2, metadata = metadata || $3::jsonb
             WHERE id = ANY($4::uuid[])`,
            [session.id, user.id, JSON.stringify({ linkedFrom: "senior_onboarding", linkedAt: new Date().toISOString() }), capturedEvidenceIds]
          );
        }
        for (const permission of payload.devicePermissions || []) {
          await tx(
            `INSERT INTO device_permission_grants (onboarding_session_id, account_id, permission_name, requested_reason, grant_status, granted_at, metadata)
             VALUES ($1,$2,$3,'onboarding', 'granted', now(), $4)`,
            [session.id, user.id, String(permission).toLowerCase().replace(/\s+/g, '_'), JSON.stringify({ source: 'mobile_onboarding' })]
          );
        }
        for (const provider of payload.musicApps || []) {
          await tx(
            `INSERT INTO music_connections (senior_profile_id, provider, connection_status, favorite_genres)
             VALUES ($1,$2,'pending',$3)`,
            [profile.id, String(provider).toLowerCase().replace(/\s+/g, '_'), payload.musicPreferences || []]
          );
        }
        const consent = (await tx(
          `INSERT INTO consent_records (subject_account_id, subject_role, consent_scope, consent_text, granted, source_ip, user_agent, metadata)
           VALUES ($1,'senior','senior_onboarding_identity_health_wearables_music_location_sos','Senior onboarding consent captured in mobile app.',true,$2,$3,$4) RETURNING *`,
          [user.id, req.socket?.remoteAddress || null, req.headers["user-agent"] || null, JSON.stringify({ healthSharing: payload.healthSharing, locationSharing: payload.locationSharing, sosOrder: payload.sosOrder })]
        )).rows[0];
        if (user.role === "senior") {
          const resident = await getResidentForUser(user);
          if (resident) await tx(
            `UPDATE residents SET community = COALESCE($1, community), onboarding_complete = true, live_tracking_enabled = true, memory_support_enabled = true,
              health_conditions = $2, allergies = $3, mobility_notes = $4, display_name = $5,
              profile_photo_evidence_id = COALESCE(NULLIF($6,'')::uuid, profile_photo_evidence_id),
              health_profile = health_profile || $7::jsonb, updated_at = now()
             WHERE id = $8`,
            [payload.address || null, payload.healthConcerns || [], payload.allergies ? [payload.allergies] : [], payload.mobility || null, payload.preferredName || payload.name, payload.profilePhotoEvidenceId || "", JSON.stringify({ onboarding: { profileId: profile.id, sessionId: session.id, consentId: consent.id, baselineMetrics: { height: payload.height, weight: payload.weight, bloodPressure: payload.bloodPressure, heartRate: payload.heartRate }, wearableSources: payload.wearableSources || [] } }), resident.id]
          );
        }
        return { session, profile, consent };
      });
      await audit(req, user, "role_onboarding_senior_completed", "onboarding_session", result.session.id, { profileId: result.profile.id });
      return { ok: true, onboarding: result };
    }

    if (req.method === "POST" && url.pathname === "/api/onboarding/trust-circle") {
      const requiredFields = ["name", "relationship", "phone", "email"];
      const missing = requiredFields.filter(field => !payload[field]);
      if (missing.length) {
        const error = new Error(`Missing trust-circle onboarding fields: ${missing.join(", ")}`);
        error.status = 400;
        throw error;
      }
      const result = await transaction(async tx => {
        const session = (await tx(`INSERT INTO onboarding_sessions (role, account_id, status, current_step, payload, completed_at) VALUES ('trust_circle',$1,'complete','complete',$2,now()) RETURNING *`, [user.id, JSON.stringify(payload)])).rows[0];
        const member = (await tx(
          `INSERT INTO trust_circle_onboarding (onboarding_session_id, member_account_id, full_name, relationship, phone, email, timezone, escalation_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [session.id, user.id, payload.name, payload.relationship, payload.phone, payload.email, payload.timezone || null, payload.escalationRole || null]
        )).rows[0];
        await tx(`INSERT INTO trust_circle_messaging_rules (trust_circle_member_id, routine_window, quiet_hours, emergency_override, alert_types, preferred_channels) VALUES ($1,$2,$3,$4,$5,$6)`, [member.id, payload.routineWindow || null, payload.quietHours || null, String(payload.emergencyOverride || "Yes").toLowerCase() !== "no", payload.alertTypes || [], ["app"]]);
        const capturedEvidenceIds = [payload.identityPhotoEvidenceId, payload.livenessEvidenceId].filter(isUuid);
        if (capturedEvidenceIds.length) {
          await tx(
            `UPDATE identity_evidence
             SET onboarding_session_id = $1, subject_account_id = $2, metadata = metadata || $3::jsonb
             WHERE id = ANY($4::uuid[])`,
            [session.id, user.id, JSON.stringify({ linkedFrom: "trust_circle_onboarding", linkedAt: new Date().toISOString() }), capturedEvidenceIds]
          );
        }
        await tx(`INSERT INTO consent_records (subject_account_id, subject_role, consent_scope, consent_text, granted, source_ip, user_agent, metadata) VALUES ($1,'trust_circle','alert_receipt_and_senior_approved_visibility','Trust circle onboarding consent captured in mobile app.',true,$2,$3,$4)`, [user.id, req.socket?.remoteAddress || null, req.headers["user-agent"] || null, JSON.stringify({ visibility: payload.visibility || [], alertTypes: payload.alertTypes || [] })]);
        return { session, member };
      });
      await audit(req, user, "role_onboarding_trust_circle_completed", "onboarding_session", result.session.id, { memberId: result.member.id });
      return { ok: true, onboarding: result };
    }

    if (req.method === "POST" && url.pathname === "/api/onboarding/business") {
      const requiredFields = ["legalName", "ownerName", "phone", "email", "businessType"];
      const missing = requiredFields.filter(field => !payload[field]);
      if (missing.length) {
        const error = new Error(`Missing business onboarding fields: ${missing.join(", ")}`);
        error.status = 400;
        throw error;
      }
      const result = await transaction(async tx => {
        const session = (await tx(`INSERT INTO onboarding_sessions (role, account_id, status, current_step, payload, completed_at) VALUES ('business',$1,'submitted','submitted',$2,now()) RETURNING *`, [user.id, JSON.stringify(payload)])).rows[0];
        const businessProfile = (await tx(
          `INSERT INTO business_onboarding_profiles (onboarding_session_id, business_account_id, business_type, legal_name, dba_name, owner_name, phone, email, website, business_address, verification_status, trust_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',60) RETURNING *`,
          [session.id, user.id, payload.businessType, payload.legalName, payload.dba || null, payload.ownerName, payload.phone, payload.email, payload.website || null, payload.address || null]
        )).rows[0];
        const serviceLines = String(payload.services || payload.businessType).split(/\n|,/).map(v => v.trim()).filter(Boolean).slice(0, 10);
        for (const serviceName of serviceLines.length ? serviceLines : [payload.businessType]) {
          await tx(`INSERT INTO business_service_catalog (business_profile_id, category, service_name, description, price_unit) VALUES ($1,$2,$3,$4,'custom')`, [businessProfile.id, payload.businessType, serviceName, payload.pricing || null]);
        }
        await tx(`INSERT INTO business_service_areas (business_profile_id, service_radius_miles, zip_codes, boundary_notes, boundary_geojson) VALUES ($1,NULLIF($2,'')::numeric,$3,$4,$5)`, [businessProfile.id, String(payload.serviceRadius || '').replace(/[^0-9.]/g, '') || null, String(payload.serviceZips || '').split(',').map(v => v.trim()).filter(Boolean), payload.serviceBoundary || null, JSON.stringify({ source: 'mobile_onboarding', pendingGoogleMapsBoundaryValidation: true })]);
        await tx(`INSERT INTO business_lead_rules (business_profile_id, max_leads_per_day, lead_types, communication_channels, accepts_urgent, accepts_recurring) VALUES ($1,NULLIF($2,'')::int,$3,$4,true,true)`, [businessProfile.id, String(payload.maxLeads || '').replace(/[^0-9]/g, '') || null, payload.leadTypes || [], payload.communication || ['app']]);
        const capturedEvidenceIds = [payload.ownerPhotoEvidenceId, payload.ownerLivenessEvidenceId].filter(isUuid);
        if (capturedEvidenceIds.length) {
          await tx(
            `UPDATE identity_evidence
             SET onboarding_session_id = $1, subject_account_id = $2, metadata = metadata || $3::jsonb
             WHERE id = ANY($4::uuid[])`,
            [session.id, user.id, JSON.stringify({ linkedFrom: "business_onboarding", linkedAt: new Date().toISOString() }), capturedEvidenceIds]
          );
        }
        await tx(`INSERT INTO consent_records (subject_account_id, subject_role, consent_scope, consent_text, granted, source_ip, user_agent, metadata) VALUES ($1,'business','business_identity_verification_service_matching_lead_delivery','Business onboarding consent captured in mobile app.',true,$2,$3,$4)`, [user.id, req.socket?.remoteAddress || null, req.headers["user-agent"] || null, JSON.stringify({ serviceArea: payload.serviceBoundary, verificationDocs: payload.verificationDocs || [] })]);
        if (user.role === 'business') {
          const business = await getBusinessForUser(user);
          if (business) await tx(`UPDATE businesses SET name=$1, contact_person=$2, email=$3, phone=$4, website=$5, description=$6, service_areas=$7, demographics=$8, onboarding_complete=true, status='pending_review', updated_at=now() WHERE id=$9`, [payload.dba || payload.legalName, payload.ownerName, payload.email, payload.phone, payload.website || '', payload.services || '', String(payload.serviceZips || '').split(',').map(v => v.trim()).filter(Boolean), [payload.businessType], business.id]);
        }
        return { session, businessProfile };
      });
      await audit(req, user, "role_onboarding_business_submitted", "onboarding_session", result.session.id, { businessProfileId: result.businessProfile.id });
      return { ok: true, onboarding: result };
    }

    if (req.method === "GET" && url.pathname === "/api/onboarding") {
      const rows = await query(`SELECT * FROM onboarding_sessions WHERE account_id = $1 ORDER BY created_at DESC LIMIT 20`, [user.id]);
      return { onboarding: rows.rows };
    }

    if (req.method === "POST" && url.pathname === "/api/resident/onboarding") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      await query(
        `UPDATE residents SET age = $1, community = $2, mood = $3, onboarding_complete = true, live_tracking_enabled = $4, memory_support_enabled = $5, updated_at = now()
         WHERE id = $6`,
        [payload.age, payload.community, payload.mood || null, Boolean(payload.liveTrackingEnabled), Boolean(payload.memorySupportEnabled), resident.id]
      );
      await audit(req, user, "resident_onboarding_completed", "resident", resident.id, payload);
      return { ok: true };
    }

    if (req.method === "POST" && url.pathname === "/api/resident/health-onboarding") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const validated = validateHealthOnboarding(payload);
      const { profile, diagnosis, allergy, mobility, memory, care, medications } = validated;
      const result = await transaction(async tx => {
        await tx(
          `UPDATE users SET display_name = $1, updated_at = now() WHERE id = $2`,
          [required(payload.name, "name"), user.id]
        );
        await tx(
          `UPDATE residents
           SET age = $1,
               community = $2,
               health_conditions = $3,
               allergies = $4,
               mobility_notes = $5,
               cognitive_support = $6,
               health_profile = $7,
               updated_at = now()
           WHERE id = $8`,
          [
            Number(payload.age),
            required(payload.community, "community"),
            [diagnosis.name],
            allergy.allergen ? [allergy.allergen] : [],
            mobility.transferSupport,
            memory.reassuranceStyle,
            JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }),
            resident.id
          ]
        );
        await tx(`DELETE FROM resident_diagnoses WHERE resident_id = $1`, [resident.id]);
        await tx(
          `INSERT INTO resident_diagnoses (resident_id, condition_name, status, severity, diagnosed_when, symptoms_to_watch, care_team_notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [resident.id, diagnosis.name, diagnosis.status, diagnosis.severity, diagnosis.diagnosedWhen || null, list(diagnosis.symptomsToWatch), diagnosis.careTeamNotes || null]
        );
        await tx(`DELETE FROM resident_allergies WHERE resident_id = $1`, [resident.id]);
        if (allergy.allergen) {
          await tx(
            `INSERT INTO resident_allergies (resident_id, allergen, reaction, severity, emergency_instructions)
             VALUES ($1,$2,$3,$4,$5)`,
            [resident.id, allergy.allergen, allergy.reaction || null, allergy.severity || "unknown", allergy.instructions || null]
          );
        }
        await tx(
          `INSERT INTO resident_mobility_profiles (resident_id, assistive_device, fall_history, transfer_support, walking_tolerance, home_risk_areas, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,now())
           ON CONFLICT (resident_id) DO UPDATE SET assistive_device = EXCLUDED.assistive_device, fall_history = EXCLUDED.fall_history,
             transfer_support = EXCLUDED.transfer_support, walking_tolerance = EXCLUDED.walking_tolerance, home_risk_areas = EXCLUDED.home_risk_areas, updated_at = now()`,
          [resident.id, mobility.assistiveDevice || null, mobility.fallHistory || null, mobility.transferSupport, mobility.walkingTolerance || null, list(mobility.homeRiskAreas)]
        );
        await tx(
          `INSERT INTO resident_cognitive_support_profiles (resident_id, wandering_risk, confusion_triggers, reassurance_style, routine_anchors, preferred_hospital, emergency_instructions, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,now())
           ON CONFLICT (resident_id) DO UPDATE SET wandering_risk = EXCLUDED.wandering_risk, confusion_triggers = EXCLUDED.confusion_triggers,
             reassurance_style = EXCLUDED.reassurance_style, routine_anchors = EXCLUDED.routine_anchors,
             preferred_hospital = EXCLUDED.preferred_hospital, emergency_instructions = EXCLUDED.emergency_instructions, updated_at = now()`,
          [resident.id, memory.wanderingRisk || null, list(memory.confusionTriggers), memory.reassuranceStyle, list(memory.routineAnchors), care.preferredHospital || null, care.emergencyInstructions]
        );
        const savedMedications = [];
        for (const item of medications) {
          const med = medicationParams(item);
          let saved = null;
          if (isUuid(med.id)) {
            saved = (await tx(
              `UPDATE medications
               SET name = $1, condition = $2, strength = $3, dose_quantity = $4, dose_time = $5, frequency = $6,
                   remaining_count = $7, refill_threshold = $8, prescriber = $9, pharmacy = $10,
                   status = CASE WHEN status = 'taken' THEN 'pending' ELSE status END, updated_at = now()
               WHERE id = $11 AND resident_id = $12
               RETURNING *`,
              [med.name, med.condition, med.strength, med.doseQuantity, med.time, med.frequency, med.remaining, med.refillThreshold, med.prescriber, med.pharmacy, med.id, resident.id]
            )).rows[0];
          }
          if (!saved) {
            saved = (await tx(
              `INSERT INTO medications (resident_id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
               RETURNING *`,
              [resident.id, med.name, med.condition, med.strength, med.doseQuantity, med.time, med.frequency, med.remaining, med.refillThreshold, med.prescriber, med.pharmacy]
            )).rows[0];
          }
          await tx(
            `INSERT INTO medication_inventory_events (medication_id, resident_id, event_type, quantity_delta, remaining_after, reason)
             VALUES ($1,$2,'onboarding_inventory_set',$3,$4,'Health onboarding medication inventory')`,
            [saved.id, resident.id, Number(saved.remaining_count), Number(saved.remaining_count)]
          );
          savedMedications.push(saved);
        }
        return { medications: savedMedications };
      });
      await audit(req, user, "resident_health_onboarding_saved", "resident", resident.id, { medicationCount: result.medications.length, diagnosis: diagnosis.name }, "info");
      return { ok: true, residentId: resident.id, medications: result.medications };
    }

    if (req.method === "PATCH" && url.pathname === "/api/resident") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const healthProfile = payload.healthProfile || {};
      await query(
        `UPDATE residents
         SET age = COALESCE($1, age),
             community = COALESCE($2, community),
             health_conditions = $3,
             allergies = $4,
             mobility_notes = $5,
             cognitive_support = $6,
             health_profile = $7,
             updated_at = now()
         WHERE id = $8`,
        [
          payload.age ? Number(payload.age) : null,
          payload.community || null,
          healthProfile.primaryCondition?.name ? [healthProfile.primaryCondition.name] : (Array.isArray(healthProfile.conditions) ? healthProfile.conditions : resident.health_conditions || []),
          healthProfile.allergyProfile?.allergen ? [healthProfile.allergyProfile.allergen] : (Array.isArray(healthProfile.allergies) ? healthProfile.allergies : resident.allergies || []),
          (healthProfile.mobilityProfile?.transferSupport || healthProfile.mobilityNotes) ?? resident.mobility_notes,
          (healthProfile.memoryProfile?.reassuranceStyle || healthProfile.cognitiveSupport) ?? resident.cognitive_support,
          JSON.stringify({ ...(resident.health_profile || {}), ...healthProfile, updatedAt: new Date().toISOString() }),
          resident.id
        ]
      );
      await query(`UPDATE users SET display_name = COALESCE($1, display_name), updated_at = now() WHERE id = $2`, [payload.name || null, user.id]);
      await audit(req, user, "resident_health_profile_updated", "resident", resident.id, payload);
      return { ok: true };
    }

    if (req.method === "POST" && url.pathname === "/api/resident/complete") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const refreshed = (await query(`SELECT * FROM residents WHERE id = $1`, [resident.id])).rows[0];
      const medCount = Number((await query(`SELECT count(*) FROM medications WHERE resident_id = $1`, [resident.id])).rows[0].count);
      const missing = [];
      if (!refreshed.age) missing.push("age");
      if (!refreshed.community) missing.push("community");
      const structuredProfile = refreshed.health_profile || {};
      if (!structuredProfile.primaryCondition?.name) missing.push("healthProfile.primaryCondition");
      if (!structuredProfile.mobilityProfile?.transferSupport) missing.push("healthProfile.mobilityProfile");
      if (!structuredProfile.memoryProfile?.reassuranceStyle) missing.push("healthProfile.memoryProfile");
      if (!medCount) missing.push("medications");
      if (missing.length) {
        const error = new Error(`Missing resident onboarding fields: ${missing.join(", ")}`);
        error.status = 400;
        throw error;
      }
      await query(`UPDATE residents SET onboarding_complete = true, updated_at = now() WHERE id = $1`, [resident.id]);
      await audit(req, user, "resident_onboarding_completed", "resident", resident.id, { medicationCount: medCount });
      return { ok: true };
    }

    if (req.method === "POST" && url.pathname === "/api/media/upload-url") {
      const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/heic", "video/mp4", "video/quicktime", "application/pdf"]);
      const contentType = String(payload.contentType || "").trim().toLowerCase();
      if (!allowedContentTypes.has(contentType)) {
        const error = new Error("Unsupported media content type");
        error.status = 400;
        throw error;
      }
      const resident = user.role === "senior" ? await getResidentForUser(user) : null;
      const originalFileName = sanitizeStorageKey(payload.fileName || `upload-${Date.now()}`);
      const bucket = sanitizeStorageKey(payload.bucket || (String(payload.evidenceType || "").includes("license") ? "business-evidence" : "identity-evidence"));
      const storageKey = sanitizeStorageKey(`${user.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${originalFileName}`);
      const uploadExpiresAt = new Date(Date.now() + Number(process.env.MEDIA_UPLOAD_URL_TTL_MS || 15 * 60 * 1000));
      const uploadUrl = signStorageUrl({ method: "PUT", bucket, storageKey, expiresAt: uploadExpiresAt });
      const mediaObject = (await query(
        `INSERT INTO media_objects (
          owner_user_id, resident_id, bucket, storage_key, original_file_name,
          content_type, byte_size, checksum_sha256, upload_url, upload_expires_at,
          status, metadata
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending_upload',$11)
        RETURNING *`,
        [
          user.id,
          resident?.id || payload.residentId || null,
          bucket,
          storageKey,
          originalFileName,
          contentType,
          payload.byteSize ? Number(payload.byteSize) : null,
          payload.checksumSha256 || null,
          uploadUrl,
          uploadExpiresAt,
          JSON.stringify({ evidenceType: payload.evidenceType || null, captureMethod: payload.captureMethod || null, requestedAt: new Date().toISOString() })
        ]
      )).rows[0];
      await enqueueJob("media", "media_postprocess", { mediaObjectId: mediaObject.id, storageKey, contentType }, uploadExpiresAt, 3);
      await audit(req, user, "media_object_created", "media_object", mediaObject.id, { bucket, storageKey, contentType, byteSize: mediaObject.byte_size }, "info");
      return { mediaObject, upload: { url: uploadUrl, method: "PUT", expiresAt: uploadExpiresAt.toISOString(), headers: { "Content-Type": contentType } } };
    }

    if (req.method === "POST" && url.pathname === "/api/media/download-url") {
      const mediaObjectId = required(payload.mediaObjectId, "mediaObjectId");
      const mediaObject = (await query(`SELECT * FROM media_objects WHERE id = $1`, [mediaObjectId])).rows[0];
      if (!mediaObject) {
        const error = new Error("Media object not found");
        error.status = 404;
        throw error;
      }
      const isOwner = mediaObject.owner_user_id === user.id;
      const resident = user.role === "senior" ? await getResidentForUser(user) : null;
      const isResidentOwner = resident?.id && resident.id === mediaObject.resident_id;
      if (!isOwner && !isResidentOwner && user.role !== "admin") {
        const error = new Error("Insufficient permissions for media object");
        error.status = 403;
        throw error;
      }
      const downloadExpiresAt = new Date(Date.now() + Number(process.env.MEDIA_DOWNLOAD_URL_TTL_MS || 10 * 60 * 1000));
      const downloadUrl = signStorageUrl({ method: "GET", bucket: mediaObject.bucket, storageKey: mediaObject.storage_key, expiresAt: downloadExpiresAt });
      const updated = (await query(
        `UPDATE media_objects
         SET download_url = $1, download_expires_at = $2, updated_at = now()
         WHERE id = $3 RETURNING *`,
        [downloadUrl, downloadExpiresAt, mediaObject.id]
      )).rows[0];
      await audit(req, user, "media_download_url_created", "media_object", mediaObject.id, { bucket: mediaObject.bucket }, "info");
      return { mediaObject: updated, download: { url: downloadUrl, method: "GET", expiresAt: downloadExpiresAt.toISOString() } };
    }

    if (req.method === "POST" && url.pathname === "/api/media/evidence-upload/start") {
      const allowedRoles = new Set(["senior", "trust_circle", "business_owner", "business_staff"]);
      const allowedTypes = new Set(["profile_photo", "liveness_video", "government_id", "business_license", "insurance", "background_check", "professional_license", "driver_license"]);
      const allowedContentTypes = new Set(["image/jpeg", "image/png", "image/heic", "video/mp4", "video/quicktime"]);
      const subjectRole = String(payload.subjectRole || "").trim();
      const evidenceType = String(payload.evidenceType || "").trim();
      const localUri = String(payload.localUri || "").trim();
      const contentType = String(payload.mimeType || (evidenceType === "liveness_video" ? "video/mp4" : "image/jpeg")).trim().toLowerCase();
      if (!allowedRoles.has(subjectRole)) {
        const error = new Error("Invalid evidence subject role");
        error.status = 400;
        throw error;
      }
      if (!allowedTypes.has(evidenceType)) {
        const error = new Error("Invalid evidence type");
        error.status = 400;
        throw error;
      }
      if (!allowedContentTypes.has(contentType)) {
        const error = new Error("Unsupported media content type");
        error.status = 400;
        throw error;
      }
      if (!localUri) {
        const error = new Error("localUri is required");
        error.status = 400;
        throw error;
      }
      const subjectAccountId = payload.subjectAccountId || user.id;
      const fileName = String(payload.fileName || `${evidenceType}.${evidenceType === "liveness_video" ? "mp4" : "jpg"}`).replace(/[^\w.\-]+/g, "_");
      const result = await transaction(async tx => {
        const saved = (await tx(
          `INSERT INTO identity_evidence
            (subject_role, subject_account_id, evidence_type, capture_method, verification_status, metadata)
           VALUES ($1,$2,$3,$4,'captured',$5)
           RETURNING id, onboarding_session_id, subject_role, subject_account_id, evidence_type, capture_method, verification_status, metadata, created_at`,
          [
            subjectRole,
            subjectAccountId,
            evidenceType,
            payload.captureMethod === "upload" ? "upload" : "camera",
            JSON.stringify({
              localUri,
              mimeType: contentType,
              fileName,
              width: Number(payload.width || 0) || null,
              height: Number(payload.height || 0) || null,
              durationMs: Number(payload.durationMs || 0) || null,
              source: payload.source || "mobile-native-capture",
              capturedAt: new Date().toISOString(),
              chunkedUpload: true,
              persistedBytes: false,
              expectedByteSize: Number(payload.byteSize || 0) || null
            })
          ]
        )).rows[0];
        const bucket = evidenceType === "liveness_video" ? "identity-videos" : "identity-images";
        const storageKey = `${subjectRole}/${subjectAccountId}/${saved.id}/${fileName}`;
        const upload = (await tx(
          `INSERT INTO media_upload_sessions
            (owner_user_id, resident_id, identity_evidence_id, subject_role, evidence_type, bucket, storage_key,
             original_file_name, content_type, expected_byte_size, metadata)
           VALUES ($1, (SELECT id FROM residents WHERE user_id = $1 LIMIT 1), $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            user.id,
            saved.id,
            subjectRole,
            evidenceType,
            bucket,
            storageKey,
            fileName,
            contentType,
            Number(payload.byteSize || 0) || null,
            JSON.stringify({ source: "mobile-camera", evidenceType, subjectRole })
          ]
        )).rows[0];
        return { saved, upload };
      });
      await audit(req, user, "identity_evidence_chunked_upload_started", "identity_evidence", result.saved.id, { subjectRole, evidenceType, uploadId: result.upload.id });
      return {
        evidence: {
          id: result.saved.id,
          subjectRole: result.saved.subject_role,
          subjectAccountId: result.saved.subject_account_id,
          evidenceType: result.saved.evidence_type,
          verificationStatus: result.saved.verification_status,
          metadata: result.saved.metadata,
          createdAt: result.saved.created_at
        },
        upload: {
          id: result.upload.id,
          status: result.upload.status,
          contentType: result.upload.content_type,
          storageKey: result.upload.storage_key
        }
      };
    }

    if (req.method === "POST" && url.pathname === "/api/media/evidence-upload/chunk") {
      const uploadId = required(payload.uploadId, "uploadId");
      const chunkIndex = Number(payload.chunkIndex);
      const totalChunks = Number(payload.totalChunks);
      const base64Chunk = String(payload.base64Chunk || "");
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
        const error = new Error("Invalid chunk index");
        error.status = 400;
        throw error;
      }
      if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 200) {
        const error = new Error("Invalid chunk count");
        error.status = 400;
        throw error;
      }
      if (!base64Chunk) {
        const error = new Error("base64Chunk is required");
        error.status = 400;
        throw error;
      }
      const upload = (await query(`SELECT * FROM media_upload_sessions WHERE id = $1 AND owner_user_id = $2`, [uploadId, user.id])).rows[0];
      if (!upload) {
        const error = new Error("Upload session not found");
        error.status = 404;
        throw error;
      }
      if (upload.status !== "receiving") {
        const error = new Error("Upload session is not accepting chunks");
        error.status = 409;
        throw error;
      }
      const chunkBuffer = Buffer.from(base64Chunk.replace(/^data:[^;]+;base64,/, ""), "base64");
      await transaction(async tx => {
        await tx(
          `INSERT INTO media_upload_chunks (upload_session_id, chunk_index, content, byte_size)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (upload_session_id, chunk_index)
           DO UPDATE SET content = EXCLUDED.content, byte_size = EXCLUDED.byte_size, created_at = now()`,
          [uploadId, chunkIndex, chunkBuffer, chunkBuffer.length]
        );
        await tx(
          `UPDATE media_upload_sessions
           SET total_chunks = $2,
               received_chunks = (SELECT count(*) FROM media_upload_chunks WHERE upload_session_id = $1),
               metadata = metadata || $3::jsonb
           WHERE id = $1`,
          [uploadId, totalChunks, JSON.stringify({ lastChunkAt: new Date().toISOString() })]
        );
      });
      return { ok: true, uploadId, chunkIndex };
    }

    if (req.method === "POST" && url.pathname === "/api/media/evidence-upload/complete") {
      const uploadId = required(payload.uploadId, "uploadId");
      const totalChunks = Number(payload.totalChunks);
      const upload = (await query(`SELECT * FROM media_upload_sessions WHERE id = $1 AND owner_user_id = $2`, [uploadId, user.id])).rows[0];
      if (!upload) {
        const error = new Error("Upload session not found");
        error.status = 404;
        throw error;
      }
      const chunks = (await query(
        `SELECT chunk_index, content, byte_size
         FROM media_upload_chunks
         WHERE upload_session_id = $1
         ORDER BY chunk_index ASC`,
        [uploadId]
      )).rows;
      const expectedChunks = Number.isInteger(totalChunks) && totalChunks > 0 ? totalChunks : Number(upload.total_chunks || 0);
      if (!expectedChunks || chunks.length !== expectedChunks) {
        const error = new Error(`Upload incomplete: received ${chunks.length} of ${expectedChunks || "unknown"} chunks`);
        error.status = 400;
        throw error;
      }
      for (let index = 0; index < expectedChunks; index += 1) {
        if (chunks[index].chunk_index !== index) {
          const error = new Error(`Upload incomplete: missing chunk ${index}`);
          error.status = 400;
          throw error;
        }
      }
      const byteBuffer = Buffer.concat(chunks.map(chunk => chunk.content));
      const result = await transaction(async tx => {
        const mediaObject = (await tx(
          `INSERT INTO media_objects
            (owner_user_id, resident_id, identity_evidence_id, bucket, storage_key, original_file_name, content_type, byte_size, status, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded', $9)
           RETURNING *`,
          [
            user.id,
            upload.resident_id || null,
            upload.identity_evidence_id,
            upload.bucket,
            upload.storage_key,
            upload.original_file_name,
            upload.content_type,
            byteBuffer.length,
            JSON.stringify({ source: "mobile-camera-chunked", uploadSessionId: upload.id, evidenceType: upload.evidence_type, subjectRole: upload.subject_role })
          ]
        )).rows[0];
        await tx(
          `INSERT INTO media_object_bytes (media_object_id, content)
           VALUES ($1,$2)
           ON CONFLICT (media_object_id) DO UPDATE SET content = EXCLUDED.content`,
          [mediaObject.id, byteBuffer]
        );
        const evidence = (await tx(
          `UPDATE identity_evidence
           SET storage_url = $1,
               thumbnail_url = CASE WHEN evidence_type = 'profile_photo' THEN $1 ELSE thumbnail_url END,
               metadata = metadata || $2::jsonb
           WHERE id = $3
           RETURNING id, onboarding_session_id, subject_role, subject_account_id, evidence_type, capture_method, verification_status, storage_url, thumbnail_url, metadata, created_at`,
          [`db-media://${mediaObject.id}`, JSON.stringify({ mediaObjectId: mediaObject.id, storageKey: upload.storage_key, persistedBytes: true, byteSize: byteBuffer.length, chunkedUpload: true }), upload.identity_evidence_id]
        )).rows[0];
        await tx(
          `UPDATE media_upload_sessions
           SET status = 'completed', received_chunks = $2, total_chunks = $2, completed_at = now()
           WHERE id = $1`,
          [upload.id, expectedChunks]
        );
        return { evidence, mediaObject };
      });
      await audit(req, user, "identity_evidence_chunked_upload_completed", "identity_evidence", result.evidence.id, { uploadId, byteSize: byteBuffer.length, totalChunks: expectedChunks });
      return {
        evidence: {
          id: result.evidence.id,
          onboardingSessionId: result.evidence.onboarding_session_id,
          subjectRole: result.evidence.subject_role,
          subjectAccountId: result.evidence.subject_account_id,
          evidenceType: result.evidence.evidence_type,
          captureMethod: result.evidence.capture_method,
          verificationStatus: result.evidence.verification_status,
          storageUrl: result.evidence.storage_url,
          thumbnailUrl: result.evidence.thumbnail_url,
          metadata: result.evidence.metadata,
          createdAt: result.evidence.created_at
        },
        mediaObject: result.mediaObject
      };
    }

    if (req.method === "POST" && url.pathname === "/api/media/evidence") {
      const allowedRoles = new Set(["senior", "trust_circle", "business_owner", "business_staff"]);
      const allowedTypes = new Set(["profile_photo", "liveness_video", "government_id", "business_license", "insurance", "background_check", "professional_license", "driver_license"]);
      const subjectRole = String(payload.subjectRole || "").trim();
      const evidenceType = String(payload.evidenceType || "").trim();
      const localUri = String(payload.localUri || "").trim();
      const base64Data = String(payload.base64Data || "").trim();
      if (!allowedRoles.has(subjectRole)) {
        const error = new Error("Invalid evidence subject role");
        error.status = 400;
        throw error;
      }
      if (!allowedTypes.has(evidenceType)) {
        const error = new Error("Invalid evidence type");
        error.status = 400;
        throw error;
      }
      if (!localUri) {
        const error = new Error("localUri is required");
        error.status = 400;
        throw error;
      }
      const subjectAccountId = payload.subjectAccountId || user.id;
      const contentType = String(payload.mimeType || (evidenceType === "liveness_video" ? "video/mp4" : "image/jpeg")).trim();
      const fileName = String(payload.fileName || `${evidenceType}.${evidenceType === "liveness_video" ? "mp4" : "jpg"}`).replace(/[^\w.\-]+/g, "_");
      const byteBuffer = base64Data ? Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ""), "base64") : null;
      const result = await transaction(async tx => {
        await tx(`CREATE TABLE IF NOT EXISTS media_object_bytes (media_object_id UUID PRIMARY KEY REFERENCES media_objects(id) ON DELETE CASCADE, content BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        const saved = (await tx(
          `INSERT INTO identity_evidence
            (subject_role, subject_account_id, evidence_type, capture_method, verification_status, metadata)
           VALUES ($1,$2,$3,$4,'captured',$5)
           RETURNING id, onboarding_session_id, subject_role, subject_account_id, evidence_type, capture_method, verification_status, metadata, created_at`,
          [
            subjectRole,
            subjectAccountId,
            evidenceType,
            payload.captureMethod === "upload" ? "upload" : "camera",
            JSON.stringify({
              localUri,
              mimeType: contentType,
              fileName,
              width: Number(payload.width || 0) || null,
              height: Number(payload.height || 0) || null,
              durationMs: Number(payload.durationMs || 0) || null,
              source: payload.source || "mobile-native-capture",
              capturedAt: new Date().toISOString(),
              persistedBytes: Boolean(byteBuffer),
              byteSize: byteBuffer ? byteBuffer.length : null
            })
          ]
        )).rows[0];
        let mediaObject = null;
        if (byteBuffer) {
          const storageKey = `${subjectRole}/${subjectAccountId}/${saved.id}/${fileName}`;
          mediaObject = (await tx(
            `INSERT INTO media_objects
              (owner_user_id, resident_id, identity_evidence_id, bucket, storage_key, original_file_name, content_type, byte_size, status, metadata)
             VALUES ($1, (SELECT id FROM residents WHERE user_id = $1 LIMIT 1), $2, $3, $4, $5, $6, $7, 'uploaded', $8)
             RETURNING *`,
            [
              user.id,
              saved.id,
              evidenceType === "liveness_video" ? "identity-videos" : "identity-images",
              storageKey,
              fileName,
              contentType,
              byteBuffer.length,
              JSON.stringify({ source: "mobile-camera", evidenceType, subjectRole })
            ]
          )).rows[0];
          await tx(`INSERT INTO media_object_bytes (media_object_id, content) VALUES ($1,$2) ON CONFLICT (media_object_id) DO UPDATE SET content = EXCLUDED.content`, [mediaObject.id, byteBuffer]);
          await tx(
            `UPDATE identity_evidence
             SET storage_url = $1,
                 thumbnail_url = CASE WHEN $2 = 'profile_photo' THEN $1 ELSE thumbnail_url END,
                 metadata = metadata || $3::jsonb
             WHERE id = $4`,
            [`db-media://${mediaObject.id}`, evidenceType, JSON.stringify({ mediaObjectId: mediaObject.id, storageKey, persistedBytes: true, byteSize: byteBuffer.length }), saved.id]
          );
          if (subjectRole === "senior" && evidenceType === "profile_photo") {
            await tx(
              `UPDATE residents
               SET profile_photo_media_object_id = $1,
                   profile_photo_evidence_id = $2,
                   profile_photo_url = $3,
                   updated_at = now()
               WHERE user_id = $4`,
              [mediaObject.id, saved.id, `db-media://${mediaObject.id}`, user.id]
            );
          }
        }
        const updated = (await tx(
          `SELECT id, onboarding_session_id, subject_role, subject_account_id, evidence_type, capture_method, verification_status, storage_url, thumbnail_url, metadata, created_at
           FROM identity_evidence WHERE id = $1`,
          [saved.id]
        )).rows[0];
        return { saved: updated, mediaObject };
      });
      const saved = result.saved;
      await audit(req, user, "identity_evidence_captured", "identity_evidence", saved.id, { subjectRole, evidenceType, captureMethod: saved.capture_method });
      return {
        evidence: {
          id: saved.id,
          onboardingSessionId: saved.onboarding_session_id,
          subjectRole: saved.subject_role,
          subjectAccountId: saved.subject_account_id,
          evidenceType: saved.evidence_type,
          captureMethod: saved.capture_method,
          verificationStatus: saved.verification_status,
          storageUrl: saved.storage_url,
          thumbnailUrl: saved.thumbnail_url,
          metadata: saved.metadata,
          createdAt: saved.created_at
        },
        mediaObject: result.mediaObject
      };
    }

    if (req.method === "POST" && url.pathname === "/api/wearables/connect") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const provider = String(payload.provider || "").trim();
      if (!provider) {
        const error = new Error("provider is required");
        error.status = 400;
        throw error;
      }
      const diagnostics = payload.nativeDiagnostics || {};
      const requestedDataTypes = Array.isArray(payload.requestedDataTypes) ? payload.requestedDataTypes : [];
      const status = diagnostics.available === false ? "failed" : "connected";
      const source = payload.source || "mobile-onboarding";
      const providerId = normalizeProviderId(provider);
      const connection = (await query(
        `INSERT INTO wearable_connections
          (resident_id, account_id, provider, status, source, requested_data_types, native_diagnostics, connected_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $4 = 'connected' THEN now() ELSE NULL END, now())
         RETURNING *`,
        [resident.id, user.id, provider, status, source, requestedDataTypes, JSON.stringify(diagnostics)]
      )).rows[0];
      const readings = Array.isArray(diagnostics.readings) ? diagnostics.readings : [];
      const latestReading = readings[0] || {};
      await query(
        `INSERT INTO wearable_devices (id, resident_id, device_type, name, status, battery_percent, signal, last_seen_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE(NULLIF($8,'')::timestamptz, now()),now())
         ON CONFLICT (id) DO UPDATE SET
           resident_id = EXCLUDED.resident_id,
           device_type = EXCLUDED.device_type,
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           battery_percent = EXCLUDED.battery_percent,
           signal = EXCLUDED.signal,
           last_seen_at = EXCLUDED.last_seen_at,
           updated_at = now()`,
        [
          providerId,
          resident.id,
          provider.toLowerCase().includes("health") ? "health-platform" : "wearable-platform",
          provider,
          status,
          Number(latestReading.batteryPercent ?? 0),
          requestedDataTypes.join(", ") || "Health and safety telemetry",
          latestReading.capturedAt || ""
        ]
      );
      await query(
        `INSERT INTO health_consents (resident_id, granted, source, data_types, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (resident_id) DO UPDATE SET granted = EXCLUDED.granted, source = EXCLUDED.source, data_types = EXCLUDED.data_types, updated_at = now()`,
        [resident.id, status === "connected", "mobile-healthkit-health-connect-sync", requestedDataTypes.filter(type => ["heartRate", "oxygenSaturation", "respiratoryRate", "hrv", "sleep", "calories", "steps"].includes(type))]
      );
      const wearableDevices = (await query(`SELECT * FROM wearable_devices WHERE resident_id = $1 ORDER BY updated_at DESC`, [resident.id])).rows;
      const healthConsent = (await query(`SELECT * FROM health_consents WHERE resident_id = $1`, [resident.id])).rows[0];
      await audit(req, user, status === "connected" ? "wearable_connection_completed" : "wearable_connection_failed", "wearable_connection", connection.id, { provider, status, source }, status === "connected" ? "info" : "warning");
      return {
        connection,
        healthConsent,
        wearables: {
          devices: wearableDevices,
          latestSummary: evaluateWearables(wearableDevices, {})
        }
      };
    }

    if (req.method === "POST" && url.pathname === "/api/medications") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const med = medicationParams(payload);
      let result;
      if (isUuid(med.id)) {
        result = await query(
          `UPDATE medications
           SET name = $1, condition = $2, strength = $3, dose_quantity = $4, dose_time = $5,
               frequency = $6, remaining_count = $7, refill_threshold = $8, prescriber = $9,
               pharmacy = $10, status = CASE WHEN status = 'taken' THEN 'pending' ELSE status END, updated_at = now()
           WHERE id = $11 AND resident_id = $12
           RETURNING *`,
          [med.name, med.condition, med.strength, med.doseQuantity, med.time, med.frequency, med.remaining, med.refillThreshold, med.prescriber, med.pharmacy, med.id, resident.id]
        );
      }
      if (!result?.rows?.[0]) {
        result = await query(
          `INSERT INTO medications (resident_id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
           RETURNING *`,
          [resident.id, med.name, med.condition, med.strength, med.doseQuantity, med.time, med.frequency, med.remaining, med.refillThreshold, med.prescriber, med.pharmacy]
        );
      }
      const saved = result.rows[0];
      await audit(req, user, isUuid(med.id) ? "medication_inventory_updated" : "medication_inventory_created", "medication", saved.id, { name: saved.name, strength: saved.strength, remainingCount: saved.remaining_count, refillThreshold: saved.refill_threshold });
      return { medication: saved };
    }

    if (req.method === "POST" && url.pathname === "/api/medications/confirm") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const medication = (await query(
        `SELECT id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status, last_confirmed_at
         FROM medications
         WHERE id = $1 AND resident_id = $2`,
        [required(payload.id, "id"), resident.id]
      )).rows[0];
      if (!medication) {
        const error = new Error("Medication not found");
        error.status = 404;
        throw error;
      }
      if (medication.status === "taken") {
        return { medication, alreadyTaken: true };
      }
      const updated = (await query(
        `UPDATE medications
         SET status = 'taken',
             remaining_count = GREATEST(remaining_count - 1, 0),
             last_confirmed_at = now(),
             updated_at = now()
         WHERE id = $1 AND resident_id = $2
         RETURNING id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status, last_confirmed_at`,
        [medication.id, resident.id]
      )).rows[0];
      await query(
        `INSERT INTO medication_inventory_events (medication_id, resident_id, event_type, quantity_delta, remaining_after, reason)
         VALUES ($1,$2,'dose_confirmed',-1,$3,'Resident confirmed medication dose')`,
        [updated.id, resident.id, Number(updated.remaining_count)]
      );
      if (Number(updated.remaining_count) <= Number(updated.refill_threshold)) {
        await query(
          `INSERT INTO notifications (user_id, channel, title, body, status)
           VALUES ($1,'push','Medication refill needed',$2,'queued')`,
          [user.id, `${updated.name} ${updated.strength || ""} is at ${updated.remaining_count} remaining. Please request a refill or confirm pharmacy support.`.trim()]
        );
      }
      await audit(req, user, "medication_confirmed", "medication", updated.id, { name: updated.name, remainingCount: updated.remaining_count });
      return { medication: updated, alreadyTaken: false };
    }

    if (req.method === "POST" && url.pathname === "/api/medications/remind-later") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const minutes = Math.max(5, Math.min(240, Number(payload.minutes || 30)));
      const medication = (await query(
        `SELECT id, name, strength, dose_time, remaining_count
         FROM medications
         WHERE id = $1 AND resident_id = $2`,
        [required(payload.id, "id"), resident.id]
      )).rows[0];
      if (!medication) {
        const error = new Error("Medication not found");
        error.status = 404;
        throw error;
      }
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status, next_retry_at)
         VALUES ($1,'push','Medication reminder snoozed',$2,'queued', now() + ($3 || ' minutes')::interval)`,
        [user.id, `${medication.name} ${medication.strength || ""} reminder snoozed for ${minutes} minutes.`.trim(), String(minutes)]
      );
      await audit(req, user, "medication_reminder_snoozed", "medication", medication.id, { name: medication.name, minutes }, "info");
      return { medication, reminder: { status: "queued", minutes } };
    }

    if (req.method === "POST" && url.pathname === "/api/medications/skip-dose") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const medication = (await query(
        `UPDATE medications
         SET status = 'skipped',
             last_confirmed_at = now(),
             updated_at = now()
         WHERE id = $1 AND resident_id = $2
         RETURNING id, name, condition, strength, dose_quantity, dose_time, frequency, remaining_count, refill_threshold, prescriber, pharmacy, status, last_confirmed_at`,
        [required(payload.id, "id"), resident.id]
      )).rows[0];
      if (!medication) {
        const error = new Error("Medication not found");
        error.status = 404;
        throw error;
      }
      await query(
        `INSERT INTO medication_inventory_events (medication_id, resident_id, event_type, quantity_delta, remaining_after, reason)
         VALUES ($1,$2,'dose_skipped',0,$3,$4)`,
        [medication.id, resident.id, Number(medication.remaining_count), payload.reason || "Resident skipped dose"]
      );
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push','Medication dose skipped',$2,'queued')`,
        [user.id, `${medication.name} ${medication.strength || ""} was logged as skipped. Inventory was not changed.`.trim()]
      );
      await audit(req, user, "medication_dose_skipped", "medication", medication.id, { name: medication.name, remainingCount: medication.remaining_count }, "warning");
      return { medication, skipped: true };
    }

    if (req.method === "POST" && url.pathname === "/api/medications/refill-request") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const medication = (await query(
        `SELECT * FROM medications WHERE id = $1 AND resident_id = $2`,
        [required(payload.medicationId, "medicationId"), resident.id]
      )).rows[0];
      if (!medication) {
        const error = new Error("Medication not found");
        error.status = 404;
        throw error;
      }
      const business = (await query(
        `SELECT b.*
         FROM businesses b
         JOIN services s ON s.business_id = b.id
         WHERE b.status = 'approved'
           AND s.status = 'approved'
           AND (lower(s.category) LIKE '%med%' OR lower(s.name) LIKE '%pharmacy%' OR lower(s.name) LIKE '%med%')
         ORDER BY s.created_at DESC
         LIMIT 1`
      )).rows[0];
      const refill = (await query(
        `INSERT INTO medication_refill_requests (medication_id, resident_id, business_id, requested_by, pharmacy_name, status, notes)
         VALUES ($1,$2,$3,$4,$5,'requested',$6)
         RETURNING *`,
        [medication.id, resident.id, business?.id || null, user.id, medication.pharmacy || null, payload.notes || null]
      )).rows[0];
      if (business?.owner_user_id) {
        await query(
          `INSERT INTO notifications (user_id, channel, title, body, status)
           VALUES ($1,'push','Medication refill request',$2,'queued')`,
          [business.owner_user_id, `${user.display_name} requested a refill for ${medication.name} ${medication.strength || ""}. Remaining count: ${medication.remaining_count}.`.trim()]
        );
      }
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push','Refill request created',$2,'queued')`,
        [user.id, `${medication.name} refill request was created${business ? ` for ${business.name}` : ""}.`.trim()]
      );
      await audit(req, user, "medication_refill_requested", "medication_refill_request", refill.id, { medicationId: medication.id, businessId: business?.id || null, remainingCount: medication.remaining_count }, "info");
      return { refillRequest: refill };
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/business/refill-requests/")) {
      requireRole(user, ["business"]);
      const business = await getBusinessForUser(user);
      if (!business || business.status !== "approved") {
        const error = new Error("Business must be approved before managing refill requests");
        error.status = 403;
        throw error;
      }
      const id = url.pathname.split("/")[4];
      const status = ["accepted", "ready", "completed", "rejected"].includes(payload.status) ? payload.status : "accepted";
      const refill = (await query(
        `UPDATE medication_refill_requests
         SET status = $1, response_notes = $2, acted_by = $3, acted_at = now(), updated_at = now()
         WHERE id = $4 AND business_id = $5
         RETURNING *`,
        [status, payload.responseNotes || null, user.id, id, business.id]
      )).rows[0];
      if (!refill) {
        const error = new Error("Refill request not found for this business");
        error.status = 404;
        throw error;
      }
      const seniorUser = (await query(`SELECT u.id, u.display_name FROM residents r JOIN users u ON u.id = r.user_id WHERE r.id = $1`, [refill.resident_id])).rows[0];
      let medication = (await query(`SELECT id, name, strength, remaining_count FROM medications WHERE id = $1`, [refill.medication_id])).rows[0];
      let dispensedQuantity = 0;
      if (status === "completed") {
        dispensedQuantity = Math.max(1, Number(payload.dispensedQuantity || 30));
        medication = (await query(
          `UPDATE medications
           SET remaining_count = remaining_count + $1,
               status = CASE WHEN status = 'taken' THEN 'pending' ELSE status END,
               updated_at = now()
           WHERE id = $2
           RETURNING id, name, strength, remaining_count`,
          [dispensedQuantity, refill.medication_id]
        )).rows[0];
        await query(
          `INSERT INTO medication_inventory_events (medication_id, resident_id, event_type, quantity_delta, remaining_after, reason)
           VALUES ($1,$2,'refill_completed',$3,$4,$5)`,
          [refill.medication_id, refill.resident_id, dispensedQuantity, Number(medication.remaining_count), `${business.name} completed refill request ${refill.id}`]
        );
      }
      if (seniorUser) {
        await query(
          `INSERT INTO notifications (user_id, channel, title, body, status)
           VALUES ($1,'push','Refill request updated',$2,'queued')`,
          [seniorUser.id, `${business.name} marked ${medication?.name || "medication"} refill as ${status}.${dispensedQuantity ? ` Inventory updated to ${medication.remaining_count} remaining.` : ""}`.trim()]
        );
      }
      await audit(req, user, "medication_refill_status_updated", "medication_refill_request", refill.id, { status, medicationId: refill.medication_id, dispensedQuantity, remainingCount: medication?.remaining_count }, "info");
      return { refillRequest: refill };
    }

    if (req.method === "POST" && url.pathname === "/api/business/onboarding") {
      requireRole(user, ["business"]);
      const business = await getBusinessForUser(user);
      if (!business) {
        const error = new Error("Business profile not found");
        error.status = 404;
        throw error;
      }
      await query(
        `UPDATE businesses SET name = $1, contact_person = $2, email = $3, phone = $4, website = $5,
          google_business_profile = $6, description = $7, demographics = $8, service_areas = $9,
          onboarding_complete = true, status = 'pending_review', updated_at = now()
         WHERE id = $10`,
        [
          required(payload.name, "name"),
          required(payload.contactPerson, "contactPerson"),
          required(payload.email, "email"),
          required(payload.phone, "phone"),
          payload.website || null,
          payload.googleBusinessProfile || null,
          payload.description || null,
          payload.demographics || [],
          payload.serviceAreas || [],
          business.id
        ]
      );
      await ensureDefaultSubscription(business.id);
      await audit(req, user, "business_submitted_for_approval", "business", business.id, payload);
      return { ok: true, status: "pending_review" };
    }

    if (req.method === "PATCH" && url.pathname === "/api/business/plan") {
      requireRole(user, ["business"]);
      const business = await getBusinessForUser(user);
      if (!business) {
        const error = new Error("Business profile not found");
        error.status = 404;
        throw error;
      }
      const requestedPlan = payload.plan === "paid" || payload.plan === "growth_100" ? "growth_100" : "free";
      const current = await ensureDefaultSubscription(business.id);
      if (requestedPlan === "growth_100") {
        const checkout = await createGrowthCheckoutSession(user, business, current);
        await audit(req, user, "business_growth_checkout_created", "subscription", current.id, { checkoutSessionId: checkout.id, priceCents: PAID_PLAN_PRICE_CENTS });
        return {
          paymentRequired: true,
          checkoutSessionId: checkout.id,
          checkoutUrl: checkout.url,
          priceCents: PAID_PLAN_PRICE_CENTS,
          plan: "growth_100"
        };
      }
      const subscription = (await query(
        `UPDATE subscriptions
         SET plan = $1::subscription_plan,
             current_period_start = CASE WHEN $1::text = 'growth_100' THEN date_trunc('month', now()) ELSE date_trunc('year', now()) END,
             current_period_end = CASE WHEN $1::text = 'growth_100' THEN date_trunc('month', now()) + interval '1 month' ELSE date_trunc('year', now()) + interval '1 year' END,
             updated_at = now()
         WHERE business_id = $2
         RETURNING *`,
        [requestedPlan, business.id]
      )).rows[0];
      await audit(req, user, "business_plan_updated", "subscription", subscription.id, { plan: requestedPlan });
      return { subscription, business: toBusinessState(business, subscription) };
    }

    if (req.method === "POST" && url.pathname === "/api/business/top-up") {
      requireRole(user, ["business"]);
      const business = await getBusinessForUser(user);
      if (!business) {
        const error = new Error("Business profile not found");
        error.status = 404;
        throw error;
      }
      const current = await ensureDefaultSubscription(business.id);
      if (current.plan !== "growth_100") {
        const error = new Error("Lead top-ups are only available on the $100/month Growth package.");
        error.status = 402;
        throw error;
      }
      requireBillingAccess(await getLeadEntitlement(business.id), "buying lead top-ups");
      if (!process.env.STRIPE_SECRET_KEY) {
        await audit(req, user, "business_top_up_requested_without_billing", "subscription", current.id, { leads: payload.leads || 5 }, "warning");
        const error = new Error("Lead top-up requires Stripe billing to be configured before purchase.");
        error.status = 402;
        error.details = { paymentRequired: true };
        throw error;
      }
      const leads = Math.max(1, Number(payload.leads || 5));
      const subscription = (await query(
        `UPDATE subscriptions SET lead_top_ups = lead_top_ups + $1, updated_at = now()
         WHERE business_id = $2 RETURNING *`,
        [leads, business.id]
      )).rows[0];
      await audit(req, user, "business_lead_top_up_added", "subscription", subscription.id, { leads });
      return { subscription, business: toBusinessState(business, subscription) };
    }

    if (req.method === "POST" && url.pathname === "/api/business/services") {
      requireRole(user, ["business"]);
      const business = await getBusinessForUser(user);
      if (!business || business.status !== "approved") {
        const error = new Error("Business must be approved before publishing services");
        error.status = 403;
        throw error;
      }
      const entitlement = await getLeadEntitlement(business.id);
      requireBillingAccess(entitlement, "adding services");
      const count = Number((await query(`SELECT count(*) FROM services WHERE business_id = $1 AND status != 'rejected'`, [business.id])).rows[0].count);
      if (count >= entitlement.serviceLimit) {
        const error = new Error("Free package allows 1 service. Upgrade to $100/month to add more.");
        error.status = 402;
        throw error;
      }
      const result = await query(
        `INSERT INTO services (business_id, name, category, price_label, status)
         VALUES ($1, $2, $3, $4, 'pending_review') RETURNING *`,
        [business.id, required(payload.name, "name"), required(payload.category, "category"), payload.priceLabel || payload.price || null]
      );
      await audit(req, user, "service_submitted_for_approval", "service", result.rows[0].id, payload);
      return { service: result.rows[0] };
    }

    if (req.method === "POST" && url.pathname === "/api/circle/accept-invite") {
      requireRole(user, ["trusted_person"]);
      const inviteCode = String(required(payload.inviteCode, "inviteCode")).trim().toUpperCase();
      const inviteMap = {
        "RITA-ANITA": ["safety", "sos", "location", "messages", "wellness", "medications"],
        "ARJUN-ANITA": ["safety", "sos", "location", "messages", "rides"],
        "DRMEHTA-ANITA": ["wellness", "medications", "safety"],
        "SUNITA-ANITA": ["messages", "wellness"]
      };
      const permissions = inviteMap[inviteCode];
      if (!permissions) {
        const error = new Error("Invalid or expired invite code");
        error.status = 404;
        throw error;
      }
      const resident = await ensureDemoResident();
      const connection = (await query(
        `INSERT INTO trusted_connections (resident_id, trusted_user_id, permissions, status, updated_at)
         VALUES ($1,$2,$3,'approved',now())
         ON CONFLICT (resident_id, trusted_user_id) DO UPDATE SET permissions = EXCLUDED.permissions, status = 'approved', updated_at = now()
         RETURNING *`,
        [resident.id, user.id, permissions]
      )).rows[0];
      await audit(req, user, "trusted_invite_accepted", "trusted_connection", connection.id, { inviteCode, permissions }, "info");
      return { person: { id: user.id, name: user.display_name, role: "Trusted person", phone: user.phone, permissions, status: "approved" }, connection };
    }

    if (req.method === "GET" && url.pathname === "/api/circle") {
      requireRole(user, ["trusted_person"]);
      const connection = (await query(
        `SELECT tc.*, r.id AS resident_id, r.community, r.mood, r.health_profile, senior.display_name AS resident_name, senior.phone AS resident_phone
         FROM trusted_connections tc
         JOIN residents r ON r.id = tc.resident_id
         JOIN users senior ON senior.id = r.user_id
         WHERE tc.trusted_user_id = $1 AND tc.status = 'approved'
         ORDER BY tc.updated_at DESC LIMIT 1`,
        [user.id]
      )).rows[0];
      if (!connection) {
        const error = new Error("Trusted circle invite has not been accepted");
        error.status = 404;
        throw error;
      }
      const permissions = connection.permissions || [];
      const safetyEvents = permissions.includes("safety") || permissions.includes("sos")
        ? (await query(`SELECT * FROM safety_events WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 25`, [connection.resident_id])).rows
        : [];
      const telemetry = permissions.includes("location") || permissions.includes("safety")
        ? (await query(`SELECT * FROM safety_telemetry WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 1`, [connection.resident_id])).rows[0]
        : null;
      const safeZones = permissions.includes("location") || permissions.includes("safety")
        ? (await query(`SELECT * FROM resident_safe_zones WHERE resident_id = $1 AND status = 'active' ORDER BY created_at DESC`, [connection.resident_id])).rows
        : [];
      const healthRows = permissions.includes("wellness")
        ? (await query(`SELECT * FROM health_vitals WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 24`, [connection.resident_id])).rows
        : [];
      const wearableDevices = permissions.includes("safety")
        ? (await query(`SELECT * FROM wearable_devices WHERE resident_id = $1 ORDER BY updated_at DESC`, [connection.resident_id])).rows
        : [];
      const notifications = (await query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [user.id])).rows;
      const messages = permissions.includes("messages")
        ? (await query(`SELECT * FROM circle_messages WHERE resident_id = $1 AND trusted_user_id = $2 ORDER BY created_at DESC LIMIT 25`, [connection.resident_id, user.id])).rows
        : [];
      const callRequests = permissions.includes("messages") || permissions.includes("sos") || permissions.includes("safety")
        ? (await query(`SELECT * FROM circle_call_requests WHERE resident_id = $1 AND trusted_user_id = $2 ORDER BY created_at DESC LIMIT 25`, [connection.resident_id, user.id])).rows
        : [];
      return {
        person: { id: user.id, name: user.display_name, role: "Trusted person", phone: user.phone, permissions, status: connection.status },
        resident: { id: connection.resident_id, name: connection.resident_name, phone: connection.resident_phone, community: connection.community, mood: connection.mood },
        safety: {
          location: telemetry ? { label: connection.community || "Shared location", accuracyMeters: telemetry.accuracy_meters || 18 } : { label: connection.community || "Shared location", accuracyMeters: 18 },
          safeZones: safeZones.length ? safeZones.map(zone => ({ ...zone, status: telemetry?.safe_zone_status || "unknown" })) : [{ status: telemetry?.safe_zone_status || "unknown" }],
          movement: { status: telemetry?.movement_status || "steady", stillMinutes: telemetry?.still_minutes || 0, phoneBattery: telemetry?.phone_battery || 80 },
          fallDetection: { confidence: Number(telemetry?.fall_confidence || 0), status: Number(telemetry?.fall_confidence || 0) > 0.7 ? "watch" : "clear" },
          sosEvents: safetyEvents
        },
        healthVitals: { readings: healthRows, summary: evaluateHealthVitals(healthRows), latestSummary: evaluateHealthVitals(healthRows.slice(0, 1)) },
        wearables: { devices: wearableDevices, readings: [], latestSummary: evaluateWearables(wearableDevices, {}) },
        notifications,
        messages,
        callRequests,
        tasks: []
      };
    }

    if (req.method === "POST" && url.pathname === "/api/circle/help-message") {
      requireRole(user, ["trusted_person"]);
      const connection = (await query(
        `SELECT tc.*, r.user_id AS senior_user_id, senior.display_name AS resident_name
         FROM trusted_connections tc
         JOIN residents r ON r.id = tc.resident_id
         JOIN users senior ON senior.id = r.user_id
         WHERE tc.trusted_user_id = $1 AND tc.status = 'approved'
         ORDER BY tc.updated_at DESC LIMIT 1`,
        [user.id]
      )).rows[0];
      if (!connection) {
        const error = new Error("Trusted circle invite has not been accepted");
        error.status = 404;
        throw error;
      }
      if (!(connection.permissions || []).includes("messages")) {
        const error = new Error("This trusted person does not have message access");
        error.status = 403;
        throw error;
      }
      const notification = (await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push',$2,$3,'queued') RETURNING *`,
        [connection.senior_user_id, `${user.display_name} checked in`, required(payload.body, "body")]
      )).rows[0];
      const message = (await query(
        `INSERT INTO circle_messages (resident_id, trusted_user_id, sender_user_id, body, status)
         VALUES ($1,$2,$3,$4,'sent') RETURNING *`,
        [connection.resident_id, user.id, user.id, required(payload.body, "body")]
      )).rows[0];
      await audit(req, user, "trusted_person_help_message_sent", "circle_message", message.id, { resident: connection.resident_name, notificationId: notification.id }, "info");
      return { notification, message };
    }

    if (req.method === "POST" && url.pathname === "/api/circle/call-request") {
      requireRole(user, ["trusted_person"]);
      const connection = (await query(
        `SELECT tc.*, r.user_id AS senior_user_id, senior.display_name AS resident_name
         FROM trusted_connections tc
         JOIN residents r ON r.id = tc.resident_id
         JOIN users senior ON senior.id = r.user_id
         WHERE tc.trusted_user_id = $1 AND tc.status = 'approved'
         ORDER BY tc.updated_at DESC LIMIT 1`,
        [user.id]
      )).rows[0];
      if (!connection) {
        const error = new Error("Trusted circle invite has not been accepted");
        error.status = 404;
        throw error;
      }
      if (!(connection.permissions || []).includes("messages") && !(connection.permissions || []).includes("safety")) {
        const error = new Error("This trusted person does not have contact access");
        error.status = 403;
        throw error;
      }
      const channel = payload.channel === "voice" ? "voice" : null;
      if (!channel) {
        const error = new Error("Only standard phone call requests are supported for trusted-circle calling.");
        error.status = 400;
        throw error;
      }
      const callRequest = (await query(
        `INSERT INTO circle_call_requests (resident_id, trusted_user_id, requested_by, channel, message, status)
         VALUES ($1,$2,$3,$4,$5,'requested') RETURNING *`,
        [connection.resident_id, user.id, user.id, channel, payload.message || null]
      )).rows[0];
      const notification = (await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push',$2,$3,'queued') RETURNING *`,
        [connection.senior_user_id, `${user.display_name} requested a ${channel} call`, payload.message || `${user.display_name} wants to connect with you.`]
      )).rows[0];
      await audit(req, user, "trusted_person_call_requested", "circle_call_request", callRequest.id, { resident: connection.resident_name, channel, notificationId: notification.id }, "info");
      return { callRequest, notification };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/resident/call-requests/") && url.pathname.endsWith("/respond")) {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const id = url.pathname.split("/")[4];
      const status = payload.status === "declined" ? "declined" : "accepted";
      const callRequest = (await query(
        `UPDATE circle_call_requests
         SET status = $1, message = COALESCE($2, message), responded_at = now()
         WHERE id = $3 AND resident_id = $4
         RETURNING *`,
        [status, payload.message || null, id, resident.id]
      )).rows[0];
      if (!callRequest) {
        const error = new Error("Call request not found");
        error.status = 404;
        throw error;
      }
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push',$2,$3,'queued')`,
        [callRequest.trusted_user_id, `${user.display_name} ${status} your ${callRequest.channel} call`, payload.message || `${user.display_name} ${status} the call request.`]
      );
      await audit(req, user, "resident_call_request_responded", "circle_call_request", callRequest.id, { status, channel: callRequest.channel }, "info");
      return { callRequest };
    }

    if (req.method === "POST" && url.pathname === "/api/resident/circle-message") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const trustedUserId = required(payload.trustedUserId, "trustedUserId");
      const connection = (await query(
        `SELECT * FROM trusted_connections
         WHERE resident_id = $1 AND trusted_user_id = $2 AND status = 'approved' AND 'messages' = ANY(permissions)`,
        [resident.id, trustedUserId]
      )).rows[0];
      if (!connection) {
        const error = new Error("Trusted person does not have message access");
        error.status = 403;
        throw error;
      }
      const message = (await query(
        `INSERT INTO circle_messages (resident_id, trusted_user_id, sender_user_id, body, status)
         VALUES ($1,$2,$3,$4,'sent') RETURNING *`,
        [resident.id, trustedUserId, user.id, required(payload.body, "body")]
      )).rows[0];
      await query(
        `INSERT INTO notifications (user_id, channel, title, body, status)
         VALUES ($1,'push',$2,$3,'queued')`,
        [trustedUserId, `${user.display_name} replied`, message.body]
      );
      await audit(req, user, "resident_circle_message_sent", "circle_message", message.id, { trustedUserId }, "info");
      return { message };
    }

    if (req.method === "POST" && url.pathname === "/api/circle/tasks/ack") {
      requireRole(user, ["trusted_person"]);
      await audit(req, user, "trusted_task_acknowledged", "trusted_task", payload.id || null, {}, "info");
      return { ok: true, id: payload.id || null, status: "acknowledged" };
    }

    if (req.method === "POST" && url.pathname === "/api/messages") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const body = String(payload.body || "").trim();
      if (!body) {
        const error = new Error("Message body is required");
        error.status = 400;
        throw error;
      }
      const message = (await query(
        `INSERT INTO resident_messages (resident_id, sender_user_id, recipient_key, priority, body, status, metadata)
         VALUES ($1,$2,$3,$4,$5,'sent',$6) RETURNING *`,
        [resident.id, user.id, payload.recipient || null, payload.priority || "normal", body, JSON.stringify(payload.metadata || {})]
      )).rows[0];
      const job = await enqueueJob("notifications", "notification_delivery", {
        source: "resident_message",
        messageId: message.id,
        residentId: resident.id,
        recipientKey: message.recipient_key,
        priority: message.priority
      });
      await audit(req, user, "resident_message_sent", "resident_message", message.id, { recipient: message.recipient_key, priority: message.priority }, message.priority === "help_request" ? "high" : "info");
      return { ok: true, message, job };
    }

    if (req.method === "POST" && url.pathname === "/api/help/match") {
      requireRole(user, ["senior"]);
      const need = String(payload.need || "").toLowerCase();
      const rows = (await query(
        `SELECT s.*, b.name AS provider_name
         FROM services s
         JOIN businesses b ON b.id = s.business_id
         WHERE s.status = 'approved' AND b.status = 'approved'
         ORDER BY s.created_at DESC`
      )).rows;
      const matches = rows
        .map(service => {
          const haystack = `${service.name} ${service.category}`.toLowerCase();
          const score = (need.includes("ride") || need.includes("doctor") || need.includes("appointment") || need.includes("transport"))
            && haystack.includes("transport") ? 96
            : need.includes("med") && haystack.includes("med") ? 94
              : 72;
          return { ...toServiceState(service, { name: service.provider_name }), score };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);
      await audit(req, user, "resident_service_matches_requested", "service_match", null, { need: payload.need, matches: matches.length });
      return { matches };
    }

    if (req.method === "POST" && url.pathname === "/api/help/chat") {
      requireRole(user, ["senior"]);
      const message = String(payload.message || "").trim();
      if (!message) throw new Error("Message is required");
      const need = message.toLowerCase();
      const rows = (await query(
        `SELECT s.*, b.name AS provider_name
         FROM services s
         JOIN businesses b ON b.id = s.business_id
         WHERE s.status = 'approved' AND b.status = 'approved'
         ORDER BY s.created_at DESC`
      )).rows;
      const matches = rows
        .map(service => {
          const haystack = `${service.name} ${service.category}`.toLowerCase();
          const score = (need.includes("ride") || need.includes("doctor") || need.includes("appointment") || need.includes("transport"))
            && haystack.includes("transport") ? 96
            : need.includes("med") && haystack.includes("med") ? 94
              : need.includes("food") && (haystack.includes("food") || haystack.includes("meal")) ? 92
                : 72;
          return { ...toServiceState(service, { name: service.provider_name }), score };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);
      const reply = need.includes("ride") || need.includes("doctor") || need.includes("appointment")
        ? "I can help with the ride. Please confirm pickup, drop-off, date, time, rider phone, assistance needs, and driver-sharing consent before requesting it."
        : need.includes("med")
          ? "I can help with medication support. Tell me whether you need a reminder, refill, dosage help, or a pharmacy/provider request."
          : need.includes("food") || need.includes("meal") || need.includes("grocery")
            ? "I can help find food or grocery support. Please tell me delivery address, dietary needs, timing, and whether someone should check in after delivery."
            : need.includes("urgent") || need.includes("emergency") || need.includes("fall")
              ? "If this is urgent, use SOS now. I can also notify your trusted circle and log the safety event."
              : "I can help with that. Tell me what you need, when you need it, where it should happen, and whether a trusted person should be notified.";
      await audit(req, user, "resident_help_chat_message", "help_chat", null, { message, reply, matches: matches.length }, need.includes("urgent") || need.includes("emergency") || need.includes("fall") ? "warning" : "info");
      return {
        userMessage: { from: user.display_name || "You", body: message, createdAt: new Date().toISOString() },
        assistantMessage: { from: "Guru", body: reply, createdAt: new Date().toISOString() },
        matches
      };
    }

    if (req.method === "POST" && url.pathname === "/api/maps/route-estimate") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const pickup = parseRoutePoint(payload.pickup || {}, "pickup");
      const dropoff = parseRoutePoint(payload.dropoff || {}, "dropoff");
      const route = await estimateRoute(pickup, dropoff);
      await audit(req, user, "route_estimate_requested", "route", null, { provider: route.provider, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds });
      return { pickup, dropoff, route };
    }

    if (req.method === "POST" && url.pathname === "/api/places/autocomplete") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const input = String(required(payload.input, "input")).trim();
      const location = payload.location && Number.isFinite(Number(payload.location.lat)) && Number.isFinite(Number(payload.location.lng))
        ? { lat: Number(payload.location.lat), lng: Number(payload.location.lng) }
        : null;
      const radiusMeters = Math.max(1000, Math.min(50000, Number(payload.radiusMeters || 25000)));
      const params = {
        input,
        ...(payload.components ? { components: payload.components } : {}),
        ...(location ? { location: `${location.lat},${location.lng}`, radius: String(radiusMeters), strictbounds: "true" } : {}),
        ...(payload.sessionToken ? { sessiontoken: payload.sessionToken } : {})
      };
      if (location) {
        const nearby = await googleMapsGet("place/textsearch/json", {
          query: input,
          location: `${location.lat},${location.lng}`,
          radius: String(radiusMeters)
        });
        const nearbyPredictions = (nearby.results || []).slice(0, 6).map(item => ({
          placeId: item.place_id,
          description: item.formatted_address ? `${item.name}, ${item.formatted_address}` : item.name,
          primaryText: item.name || item.formatted_address || input,
          secondaryText: item.formatted_address || item.vicinity || "",
          lat: item.geometry?.location?.lat || null,
          lng: item.geometry?.location?.lng || null,
          rating: item.rating || null,
          userRatingsTotal: item.user_ratings_total || 0,
          source: "google_places_text_search_nearby"
        }));
        if (nearbyPredictions.length) {
          await audit(req, user, "google_places_autocomplete_requested", "place", null, { inputLength: input.length, results: nearbyPredictions.length, locationBiased: true, radiusMeters, globalSearch: !payload.components, source: "text_search_nearby" }, "info");
          return { provider: "google_places_text_search_nearby", predictions: nearbyPredictions, locationBias: location, radiusMeters, globalSearch: !payload.components };
        }
      }
      const data = await googleMapsGet("place/autocomplete/json", params);
      const predictions = (data.predictions || []).slice(0, 6).map(item => ({
        placeId: item.place_id,
        description: item.description,
        primaryText: item.structured_formatting?.main_text || item.description,
        secondaryText: item.structured_formatting?.secondary_text || ""
      }));
      await audit(req, user, "google_places_autocomplete_requested", "place", null, { inputLength: input.length, results: predictions.length, locationBiased: Boolean(location), radiusMeters, globalSearch: !payload.components }, "info");
      return { provider: "google_places_autocomplete", predictions, locationBias: location, radiusMeters, globalSearch: !payload.components };
    }

    if (req.method === "POST" && url.pathname === "/api/places/details") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const placeId = String(required(payload.placeId, "placeId")).trim();
      const data = await googleMapsGet("place/details/json", {
        place_id: placeId,
        fields: "place_id,name,formatted_address,geometry,types,url,address_components"
      });
      const result = data.result || {};
      const place = {
        placeId: result.place_id,
        name: result.name || "",
        formattedAddress: result.formatted_address || "",
        lat: result.geometry?.location?.lat || null,
        lng: result.geometry?.location?.lng || null,
        types: result.types || [],
        url: result.url || null,
        addressComponents: result.address_components || []
      };
      await audit(req, user, "google_place_details_requested", "place", null, { placeId, hasGeometry: Boolean(place.lat && place.lng) }, "info");
      return { provider: "google_place_details", place };
    }

    if (req.method === "POST" && url.pathname === "/api/address/validate") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const address = String(required(payload.address, "address")).trim();
      const data = await googleMapsPost("https://addressvalidation.googleapis.com/v1:validateAddress", {
        address: { addressLines: [address] },
        enableUspsCass: true
      });
      const verdict = data.result?.verdict || {};
      const validatedAddress = data.result?.address || {};
      await audit(req, user, "google_address_validation_requested", "address", null, { hasUnconfirmedComponents: Boolean(verdict.hasUnconfirmedComponents), validationGranularity: verdict.validationGranularity || null }, "info");
      return {
        provider: "google_address_validation",
        verdict,
        formattedAddress: validatedAddress.formattedAddress || "",
        addressComplete: Boolean(!verdict.hasUnconfirmedComponents && validatedAddress.formattedAddress),
        result: data.result || {}
      };
    }

    if (req.method === "POST" && url.pathname === "/api/places/nearby-recommendations") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const location = parseRoutePoint(payload.location || {}, "location");
      const keyword = String(payload.keyword || "senior services").trim();
      const radiusMeters = Math.max(250, Math.min(15000, Number(payload.radiusMeters || 3000)));
      const data = await googleMapsGet("place/nearbysearch/json", {
        location: `${location.lat},${location.lng}`,
        radius: String(radiusMeters),
        keyword
      });
      const approvedPartners = (await query(
        `SELECT b.id AS business_id, b.name AS business_name, s.id AS service_id, s.name AS service_name, s.category
         FROM businesses b
         LEFT JOIN services s ON s.business_id = b.id
         WHERE b.status = 'approved'
           AND (LOWER(b.name) LIKE LOWER($1) OR LOWER(COALESCE(s.name,'')) LIKE LOWER($1) OR LOWER(COALESCE(s.category,'')) LIKE LOWER($1))`,
        [`%${keyword}%`]
      )).rows;
      const recommendations = (data.results || []).slice(0, 8).map(place => {
        const approved = approvedPartners.find(partner =>
          String(place.name || "").toLowerCase().includes(String(partner.business_name || "").toLowerCase()) ||
          String(partner.business_name || "").toLowerCase().includes(String(place.name || "").toLowerCase())
        );
        return {
          placeId: place.place_id,
          name: place.name,
          address: place.vicinity || "",
          lat: place.geometry?.location?.lat || null,
          lng: place.geometry?.location?.lng || null,
          rating: place.rating || null,
          userRatingsTotal: place.user_ratings_total || 0,
          businessStatus: place.business_status || "UNKNOWN",
          types: place.types || [],
          vettingStatus: approved ? "approved_partner" : "google_unverified",
          approvedPartner: approved || null,
          careNote: approved ? "Approved TheSeniorguru partner." : "Google discovery result. Needs approval before care referral."
        };
      });
      await audit(req, user, "nearby_recommendations_requested", "place", null, { keyword, radiusMeters, results: recommendations.length, approvedMatches: recommendations.filter(item => item.vettingStatus === "approved_partner").length }, "info");
      return { provider: "google_nearby_search", location, keyword, radiusMeters, recommendations };
    }

    if (req.method === "POST" && url.pathname === "/api/outdoor/recommendations") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      const location = parseRoutePoint(payload.location || {}, "location");
      const activity = String(payload.activity || "easy walking trail").trim();
      const keyword = outdoorKeywordForActivity(activity);
      const radiusMeters = Math.max(500, Math.min(25000, Number(payload.radiusMeters || 8000)));
      const data = await googleMapsGet("place/nearbysearch/json", {
        location: `${location.lat},${location.lng}`,
        radius: String(radiusMeters),
        keyword
      });
      const approvedPartners = (await query(
        `SELECT b.id AS business_id, b.name AS business_name, s.id AS service_id, s.name AS service_name, s.category
         FROM businesses b
         LEFT JOIN services s ON s.business_id = b.id
         WHERE b.status = 'approved'
           AND (LOWER(b.name) LIKE LOWER($1) OR LOWER(COALESCE(s.name,'')) LIKE LOWER($1) OR LOWER(COALESCE(s.category,'')) LIKE LOWER($1))`,
        [`%outdoor%`]
      )).rows;
      const recommendations = (data.results || []).slice(0, 8).map(place => {
        const approved = approvedPartners.find(partner =>
          String(place.name || "").toLowerCase().includes(String(partner.business_name || "").toLowerCase()) ||
          String(partner.business_name || "").toLowerCase().includes(String(place.name || "").toLowerCase())
        );
        const suitability = seniorSuitabilityForOutdoorPlace(place);
        return {
          placeId: place.place_id,
          name: place.name,
          address: place.vicinity || "",
          lat: place.geometry?.location?.lat || null,
          lng: place.geometry?.location?.lng || null,
          rating: place.rating || null,
          userRatingsTotal: place.user_ratings_total || 0,
          businessStatus: place.business_status || "UNKNOWN",
          types: place.types || [],
          source: "google_places",
          activity,
          vettingStatus: approved ? "approved_partner" : "google_unverified",
          approvedPartner: approved || null,
          seniorSuitability: suitability,
          careNote: approved
            ? "Approved TheSeniorguru outdoor partner."
            : "Google outdoor discovery result. Confirm accessibility, supervision, and care needs before booking."
        };
      });
      await ensureSupportOrderProviderConfigs();
      await audit(req, user, "outdoor_recommendations_requested", "outdoor_place", null, {
        activity,
        keyword,
        radiusMeters,
        results: recommendations.length,
        approvedMatches: recommendations.filter(item => item.vettingStatus === "approved_partner").length
      }, "info");
      return {
        provider: "google_places_outdoor",
        location,
        activity,
        keyword,
        radiusMeters,
        recommendationCount: recommendations.length,
        recommendations,
        allTrails: {
          status: "partner_api_required",
          note: "AllTrails is kept credential-gated until partner/API access is approved and configured."
        }
      };
    }

    if (req.method === "POST" && url.pathname === "/api/rides/fulfillment-options") {
      requireRole(user, ["senior", "business", "trusted_person"]);
      await ensureRideProviderConfigs();
      const pickup = parseRoutePoint(payload.pickup || {}, "pickup");
      const dropoff = parseRoutePoint(payload.dropoff || {}, "dropoff");
      const route = await estimateRoute(pickup, dropoff);
      const service = payload.serviceId
        ? (await query(
          `SELECT s.*, b.name AS provider_name
           FROM services s
           JOIN businesses b ON b.id = s.business_id
           WHERE s.id = $1`,
          [payload.serviceId]
        )).rows[0] || {}
        : { name: "Ride", category: "Transportation" };
      const options = buildFulfillmentOptions(route, service);
      await audit(req, user, "ride_fulfillment_options_requested", "ride", null, { routeProvider: route.provider, options: options.map(option => ({ mode: option.mode, available: option.available, lifecycleStatus: option.lifecycleStatus })) });
      return { pickup, dropoff, route, options, recommendedMode: options.find(option => option.recommended && option.available)?.mode || "local_partner" };
    }

    if (req.method === "POST" && url.pathname === "/api/rides/pricing-quote") {
      requireRole(user, ["senior", "trusted_person", "business"]);
      const pickup = payload.pickup ? parseRoutePoint(payload.pickup || {}, "pickup") : null;
      const dropoff = payload.dropoff ? parseRoutePoint(payload.dropoff || {}, "dropoff") : null;
      const route = payload.route || (pickup && dropoff ? await estimateRoute(pickup, dropoff) : null);
      if (!route && !payload.providerBillCents) {
        const error = new Error("Route or providerBillCents is required for ride pricing.");
        error.status = 400;
        throw error;
      }
      const pricing = calculateRidePricing({
        providerBillCents: payload.providerBillCents || null,
        route,
        provider: payload.provider || payload.fulfillmentMode || "ride_provider",
        source: payload.providerBillCents ? "provider_bill" : "route_estimate"
      });
      await audit(req, user, "ride_pricing_quote_requested", "ride_pricing_quote", null, { provider: pricing.provider, providerBillCents: pricing.providerBillCents, platformMarginCents: pricing.platformMarginCents, taxCents: pricing.taxCents, totalChargeCents: pricing.totalChargeCents }, "info");
      return { pickup, dropoff, route, pricing };
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/order-providers") {
      requireRole(user, ["superadmin"]);
      const providers = await ensureSupportOrderProviderConfigs();
      await audit(req, user, "support_order_provider_configs_viewed", "support_order_provider_config", null, { providers: providers.length }, "info");
      return { providers };
    }

    if (req.method === "POST" && url.pathname === "/api/orders/pricing-quote") {
      requireRole(user, ["senior", "trusted_person", "business"]);
      const category = allowedSupportCategory(payload.category);
      const provider = String(required(payload.provider, "provider")).trim().toLowerCase();
      const providerBillCents = Math.max(1, Math.ceil(Number(required(payload.providerBillCents, "providerBillCents"))));
      const configs = await ensureSupportOrderProviderConfigs();
      const providerConfig = configs.find(item => item.category === category && item.provider === provider) || configs.find(item => item.category === "all" && item.provider === provider) || null;
      const pricing = calculateSupportOrderPricing({ category, provider, providerBillCents, source: "provider_bill" });
      await audit(req, user, "support_order_pricing_quote_requested", "support_order_quote", null, { category, provider, providerBillCents, totalChargeCents: pricing.totalChargeCents, providerStatus: providerConfig?.status || "unknown" }, "info");
      return { category, provider, providerConfig, pricing };
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const category = allowedSupportCategory(payload.category);
      const provider = String(required(payload.provider, "provider")).trim().toLowerCase();
      const providerBillCents = Math.max(1, Math.ceil(Number(required(payload.providerBillCents, "providerBillCents"))));
      const delivery = payload.delivery ? parseRoutePoint(payload.delivery, "delivery") : null;
      const configs = await ensureSupportOrderProviderConfigs();
      const providerConfig = configs.find(item => item.category === category && item.provider === provider) || configs.find(item => item.category === "all" && item.provider === provider) || null;
      const pricing = calculateSupportOrderPricing({ category, provider, providerBillCents, source: "provider_bill" });
      const fulfillmentMode = payload.fulfillmentMode || provider;
      const lifecycleStatus = providerConfig?.status === "enabled" ? "payment_required" : "credential_required";
      const order = (await query(
        `INSERT INTO support_orders (
          resident_id, category, provider, fulfillment_mode, lifecycle_status, label,
          delivery_label, delivery_lat, delivery_lng,
          provider_bill_cents, tax_cents, refund_reserve_cents, platform_margin_cents, total_charge_cents,
          payment_responsibility, payment_status, payer_user_id, order_metadata, pricing_metadata
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'senior','payment_required',$15,$16,$17)
         RETURNING *`,
        [
          resident.id,
          category,
          provider,
          fulfillmentMode,
          lifecycleStatus,
          payload.label || `${category} order`,
          delivery?.label || null,
          delivery?.lat || null,
          delivery?.lng || null,
          pricing.providerBillCents,
          pricing.taxCents,
          pricing.refundReserveCents,
          pricing.platformMarginCents,
          pricing.totalChargeCents,
          payload.payerUserId || user.id,
          JSON.stringify({ providerConfig, items: payload.items || [], partnerApiCredentialRequired: providerConfig?.status !== "enabled" }),
          JSON.stringify(pricing)
        ]
      )).rows[0];
      await audit(req, user, "support_order_created", "support_order", order.id, { category, provider, lifecycleStatus, totalChargeCents: pricing.totalChargeCents }, "info");
      return { order, providerConfig, pricing };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/rides/bookings/") && url.pathname.endsWith("/payment-intent")) {
      requireRole(user, ["senior"]);
      const id = url.pathname.split("/")[4];
      const booking = (await query(
        `SELECT b.*, r.user_id AS resident_user_id
         FROM bookings b
         JOIN residents r ON r.id = b.resident_id
         WHERE b.id = $1`,
        [id]
      )).rows[0];
      if (!booking || booking.resident_user_id !== user.id) {
        const error = new Error("Ride booking not found");
        error.status = 404;
        throw error;
      }
      if (!booking.total_charge_cents || booking.payment_status === "paid") {
        const error = new Error(booking.payment_status === "paid" ? "Ride booking is already paid" : "Ride booking does not have a chargeable total");
        error.status = 400;
        throw error;
      }
      const paymentIntent = await createStripePaymentIntent({
        amountCents: booking.total_charge_cents,
        description: `TheSeniorguru ride payment: ${booking.label}`,
        receiptEmail: user.email,
        metadata: { kind: "ride_booking", entityId: booking.id, residentId: booking.resident_id, provider: booking.fulfillment_provider || booking.fulfillment_mode || "ride" }
      });
      const updated = (await query(
        `UPDATE bookings
         SET payment_status = 'payment_intent_created',
             payment_metadata = payment_metadata || $1::jsonb,
             updated_at = now()
         WHERE id = $2 RETURNING *`,
        [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripeClientSecret: paymentIntent.client_secret, stripePaymentStatus: paymentIntent.status }), booking.id]
      )).rows[0];
      await query(
        `UPDATE leads
         SET payment_status = 'payment_intent_created',
             payment_metadata = payment_metadata || $1::jsonb,
             updated_at = now()
         WHERE id = $2`,
        [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripePaymentStatus: paymentIntent.status }), booking.lead_id]
      );
      await audit(req, user, "ride_payment_intent_created", "booking", booking.id, { stripePaymentIntentId: paymentIntent.id, amount: paymentIntent.amount }, "info");
      return { booking: updated, paymentIntent: { id: paymentIntent.id, clientSecret: paymentIntent.client_secret, status: paymentIntent.status, amount: paymentIntent.amount, currency: paymentIntent.currency } };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/orders/") && url.pathname.endsWith("/payment-intent")) {
      requireRole(user, ["senior"]);
      const id = url.pathname.split("/")[3];
      const order = (await query(
        `SELECT so.*, r.user_id AS resident_user_id
         FROM support_orders so
         JOIN residents r ON r.id = so.resident_id
         WHERE so.id = $1`,
        [id]
      )).rows[0];
      if (!order || order.resident_user_id !== user.id) {
        const error = new Error("Support order not found");
        error.status = 404;
        throw error;
      }
      if (!order.total_charge_cents || order.payment_status === "paid") {
        const error = new Error(order.payment_status === "paid" ? "Support order is already paid" : "Support order does not have a chargeable total");
        error.status = 400;
        throw error;
      }
      const paymentIntent = await createStripePaymentIntent({
        amountCents: order.total_charge_cents,
        description: `TheSeniorguru ${order.category} payment: ${order.label}`,
        receiptEmail: user.email,
        metadata: { kind: "support_order", entityId: order.id, residentId: order.resident_id, category: order.category, provider: order.provider }
      });
      const updated = (await query(
        `UPDATE support_orders
         SET payment_status = 'payment_intent_created',
             payment_metadata = payment_metadata || $1::jsonb,
             updated_at = now()
         WHERE id = $2 RETURNING *`,
        [JSON.stringify({ stripePaymentIntentId: paymentIntent.id, stripeClientSecret: paymentIntent.client_secret, stripePaymentStatus: paymentIntent.status }), order.id]
      )).rows[0];
      await audit(req, user, "support_order_payment_intent_created", "support_order", order.id, { stripePaymentIntentId: paymentIntent.id, amount: paymentIntent.amount }, "info");
      return { order: updated, paymentIntent: { id: paymentIntent.id, clientSecret: paymentIntent.client_secret, status: paymentIntent.status, amount: paymentIntent.amount, currency: paymentIntent.currency } };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/orders/") && url.pathname.endsWith("/dispatch")) {
      requireRole(user, ["senior"]);
      const id = url.pathname.split("/")[3];
      const order = (await query(
        `SELECT so.*, r.user_id AS resident_user_id
         FROM support_orders so
         JOIN residents r ON r.id = so.resident_id
         WHERE so.id = $1`,
        [id]
      )).rows[0];
      if (!order || order.resident_user_id !== user.id) {
        const error = new Error("Support order not found");
        error.status = 404;
        throw error;
      }
      if (order.payment_status !== "paid") {
        const error = new Error("Payment must be completed before dispatch");
        error.status = 402;
        throw error;
      }
      const configs = await ensureSupportOrderProviderConfigs();
      const providerConfig = configs.find(item => item.category === order.category && item.provider === order.provider) || configs.find(item => item.category === "all" && item.provider === order.provider) || null;
      if (providerConfig?.status !== "enabled") {
        const error = new Error("Provider credentials are required before dispatch");
        error.status = 409;
        error.details = { provider: order.provider, credentialStatus: providerConfig?.credential_status || "missing" };
        throw error;
      }
      const lifecycleStatus = ["manual_coordination", "local_partner", "local_pharmacy"].includes(order.provider) ? "manual_coordination_required" : "dispatch_requested";
      const updated = (await query(
        `UPDATE support_orders
         SET lifecycle_status = $1,
             order_metadata = order_metadata || $2::jsonb,
             updated_at = now()
         WHERE id = $3 RETURNING *`,
        [lifecycleStatus, JSON.stringify({ dispatchRequestedAt: new Date().toISOString(), providerConfig }), order.id]
      )).rows[0];
      await audit(req, user, "support_order_dispatch_requested", "support_order", order.id, { provider: order.provider, lifecycleStatus }, "info");
      return { order: updated, providerConfig, dispatch: { status: lifecycleStatus, externalOrderId: updated.external_order_id || null } };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/rides/bookings/") && url.pathname.endsWith("/dispatch")) {
      requireRole(user, ["senior"]);
      const id = url.pathname.split("/")[4];
      const booking = (await query(
        `SELECT b.*, r.user_id AS resident_user_id
         FROM bookings b
         JOIN residents r ON r.id = b.resident_id
         WHERE b.id = $1`,
        [id]
      )).rows[0];
      if (!booking || booking.resident_user_id !== user.id) {
        const error = new Error("Ride booking not found");
        error.status = 404;
        throw error;
      }
      if (booking.payment_status !== "paid") {
        const error = new Error("Payment must be completed before ride dispatch");
        error.status = 402;
        throw error;
      }
      const providers = await ensureRideProviderConfigs();
      const providerConfig = providers.find(item => item.provider === (booking.fulfillment_mode || booking.fulfillment_provider)) || null;
      if (providerConfig?.status !== "enabled") {
        const error = new Error("Ride provider credentials are required before dispatch");
        error.status = 409;
        error.details = { provider: booking.fulfillment_mode || booking.fulfillment_provider, credentialStatus: providerConfig?.credential_status || "missing" };
        throw error;
      }
      const lifecycleStatus = ["local_partner", "manual_coordination"].includes(booking.fulfillment_mode) ? "manual_coordination_required" : "dispatch_requested";
      const updated = (await query(
        `UPDATE bookings
         SET lifecycle_status = $1,
             fulfillment_metadata = fulfillment_metadata || $2::jsonb,
             updated_at = now()
         WHERE id = $3 RETURNING *`,
        [lifecycleStatus, JSON.stringify({ dispatchRequestedAt: new Date().toISOString(), providerConfig }), booking.id]
      )).rows[0];
      await query(
        `UPDATE leads
         SET lifecycle_status = $1,
             fulfillment_metadata = fulfillment_metadata || $2::jsonb,
             updated_at = now()
         WHERE id = $3`,
        [lifecycleStatus, JSON.stringify({ dispatchRequestedAt: new Date().toISOString(), providerConfig }), booking.lead_id]
      );
      await audit(req, user, "ride_dispatch_requested", "booking", booking.id, { provider: booking.fulfillment_mode || booking.fulfillment_provider, lifecycleStatus }, "info");
      return { booking: updated, providerConfig, dispatch: { status: lifecycleStatus, externalTripId: updated.external_trip_id || null } };
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/rides/bookings/") && url.pathname.endsWith("/status")) {
      requireRole(user, ["senior", "trusted_person", "business"]);
      const id = url.pathname.split("/")[4];
      const booking = (await query(
        `SELECT b.*, r.user_id AS resident_user_id
         FROM bookings b
         JOIN residents r ON r.id = b.resident_id
         WHERE b.id = $1`,
        [id]
      )).rows[0];
      if (!booking || (user.role === "senior" && booking.resident_user_id !== user.id)) {
        const error = new Error("Ride booking not found");
        error.status = 404;
        throw error;
      }
      const metadata = booking.fulfillment_metadata || {};
      const route = {
        pickup: booking.pickup_label ? { label: booking.pickup_label, lat: booking.pickup_lat, lng: booking.pickup_lng } : null,
        dropoff: booking.dropoff_label ? { label: booking.dropoff_label, lat: booking.dropoff_lat, lng: booking.dropoff_lng } : null,
        distanceMeters: booking.distance_meters || null,
        durationSeconds: booking.duration_seconds || null,
        provider: booking.route_provider || null
      };
      const timeline = metadata.timeline || [
        { label: "Ride request created", status: "complete", at: booking.created_at },
        { label: "Payment required before dispatch", status: booking.payment_status === "paid" ? "complete" : "current", at: null },
        { label: "Provider dispatch", status: booking.lifecycle_status === "dispatch_requested" ? "current" : "waiting", at: null },
        { label: "Driver assigned", status: booking.external_trip_id ? "complete" : "waiting", at: null },
        { label: "Pickup, ride, drop-off", status: "waiting", at: null }
      ];
      await audit(req, user, "ride_status_viewed", "booking", booking.id, { lifecycleStatus: booking.lifecycle_status, paymentStatus: booking.payment_status }, "info");
      return {
        booking,
        route,
        rideIntake: metadata.rideIntake || {},
        communications: metadata.communications || [],
        timeline,
        tracking: {
          provider: booking.fulfillment_mode || booking.fulfillment_provider,
          lifecycleStatus: booking.lifecycle_status,
          paymentStatus: booking.payment_status,
          externalTripId: booking.external_trip_id || null,
          realtimeTrackingAvailable: Boolean(booking.external_trip_id),
          driver: metadata.driver || null
        }
      };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/rides/bookings/") && url.pathname.endsWith("/messages")) {
      requireRole(user, ["senior", "trusted_person", "business"]);
      const id = url.pathname.split("/")[4];
      const booking = (await query(
        `SELECT b.*, r.user_id AS resident_user_id
         FROM bookings b
         JOIN residents r ON r.id = b.resident_id
         WHERE b.id = $1`,
        [id]
      )).rows[0];
      if (!booking || (user.role === "senior" && booking.resident_user_id !== user.id)) {
        const error = new Error("Ride booking not found");
        error.status = 404;
        throw error;
      }
      const metadata = booking.fulfillment_metadata || {};
      const message = {
        id: crypto.randomUUID(),
        from: user.role,
        channel: payload.channel || "text",
        body: String(required(payload.body, "body")).trim(),
        createdAt: new Date().toISOString(),
        providerDeliveryStatus: booking.external_trip_id ? "queued_for_provider" : "stored_until_provider_dispatch"
      };
      const communications = [message, ...(metadata.communications || [])].slice(0, 30);
      const updatedMetadata = { ...metadata, communications };
      const updated = (await query(
        `UPDATE bookings
         SET fulfillment_metadata = $1::jsonb,
             updated_at = now()
         WHERE id = $2 RETURNING *`,
        [JSON.stringify(updatedMetadata), booking.id]
      )).rows[0];
      await audit(req, user, "ride_message_added", "booking", booking.id, { channel: message.channel, providerDeliveryStatus: message.providerDeliveryStatus }, "info");
      return { booking: updated, message, communications };
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/ride-providers") {
      requireRole(user, ["superadmin"]);
      const providers = await ensureRideProviderConfigs();
      await audit(req, user, "ride_provider_configs_viewed", "ride_provider_config", null, { providers: providers.length }, "info");
      return { providers };
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/launch-readiness") {
      requireRole(user, ["superadmin"]);
      const readiness = await evaluateLaunchReadiness();
      await audit(req, user, "launch_readiness_viewed", "launch_readiness", null, { launchable: readiness.launchable, blockers: readiness.blockers.length, warnings: readiness.warnings.length }, readiness.launchable ? "info" : "warning");
      return readiness;
    }

    if (req.method === "POST" && url.pathname === "/api/superadmin/ride-providers") {
      requireRole(user, ["superadmin"]);
      const provider = String(required(payload.provider, "provider")).trim();
      const allowedProviders = ["uber_health", "lyft_healthcare", "local_partner", "manual_coordination"];
      if (!allowedProviders.includes(provider)) {
        const error = new Error("Unsupported ride provider");
        error.status = 400;
        throw error;
      }
      const status = ["enabled", "disabled", "credential_required"].includes(payload.status) ? payload.status : "credential_required";
      const updated = (await query(
        `INSERT INTO ride_provider_configs (provider, display_name, status, credential_status, supported_regions, notes, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (provider) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             status = EXCLUDED.status,
             credential_status = EXCLUDED.credential_status,
             supported_regions = EXCLUDED.supported_regions,
             notes = EXCLUDED.notes,
             metadata = ride_provider_configs.metadata || EXCLUDED.metadata,
             updated_at = now()
         RETURNING *`,
        [
          provider,
          payload.displayName || provider,
          status,
          payload.credentialStatus || (status === "enabled" ? "configured" : "missing"),
          Array.isArray(payload.supportedRegions) ? payload.supportedRegions : [],
          payload.notes || null,
          JSON.stringify({ manuallyConfigured: true, lastUpdatedBy: user.id })
        ]
      )).rows[0];
      await audit(req, user, "ride_provider_config_updated", "ride_provider_config", updated.id, { provider, status: updated.status, credentialStatus: updated.credential_status }, "warning");
      return { provider: updated };
    }

    if (req.method === "POST" && url.pathname === "/api/bookings") {
      if (user.role === "senior") {
        const resident = await getResidentForUser(user);
        if (!resident) {
          const error = new Error("Resident profile not found");
          error.status = 404;
          throw error;
        }
        const service = (await query(
          `SELECT s.*, b.status AS business_status
           FROM services s
           JOIN businesses b ON b.id = s.business_id
           WHERE s.id = $1`,
          [required(payload.serviceId, "serviceId")]
        )).rows[0];
        if (!service || service.status !== "approved" || service.business_status !== "approved") {
          const error = new Error("Service is not approved for booking");
          error.status = 403;
          throw error;
        }
        const hasRideLocations = payload.pickup || payload.dropoff;
        const pickup = hasRideLocations ? parseRoutePoint(payload.pickup || {}, "pickup") : null;
        const dropoff = hasRideLocations ? parseRoutePoint(payload.dropoff || {}, "dropoff") : null;
        const route = pickup && dropoff ? await estimateRoute(pickup, dropoff) : null;
        const fulfillmentMode = normalizeFulfillmentMode(payload.fulfillmentMode, service);
        const fulfillmentOptions = route ? buildFulfillmentOptions(route, service) : [];
        const selectedFulfillment = fulfillmentOptions.find(option => option.mode === fulfillmentMode) || { mode: fulfillmentMode, provider: fulfillmentMode, lifecycleStatus: "requested", available: true, reason: "No ride route supplied." };
        const lifecycleStatus = ["uber_health", "lyft_healthcare"].includes(fulfillmentMode) && !selectedFulfillment.available ? "credential_required" : "payment_required";
        const paymentResponsibility = payload.paymentResponsibility || "senior";
        const paymentStatus = payload.paymentStatus || "payment_required";
        const scheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : null;
        const rideIntake = {
          scheduledFor: scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? scheduledFor.toISOString() : null,
          riderName: payload.rideIntake?.riderName || user.display_name,
          riderPhone: payload.rideIntake?.riderPhone || null,
          contactPreference: payload.rideIntake?.contactPreference || "text",
          accessibilityNeeds: payload.rideIntake?.accessibilityNeeds || [],
          mobilityAid: payload.rideIntake?.mobilityAid || "none",
          needsDoorToDoor: Boolean(payload.rideIntake?.needsDoorToDoor),
          caregiverRidingAlong: Boolean(payload.rideIntake?.caregiverRidingAlong),
          assistanceNotes: payload.rideIntake?.assistanceNotes || "",
          pickupInstructions: payload.rideIntake?.pickupInstructions || "",
          dropoffInstructions: payload.rideIntake?.dropoffInstructions || "",
          medicalSensitivityNotes: payload.rideIntake?.medicalSensitivityNotes || "",
          okToShareWithDriver: Boolean(payload.rideIntake?.okToShareWithDriver)
        };
        const fulfillmentMetadata = {
          selectedFulfillment,
          options: fulfillmentOptions,
          rideIntake,
          communications: [],
          timeline: [
            { label: "Ride request created", status: "complete", at: new Date().toISOString() },
            { label: "Payment required before dispatch", status: paymentStatus === "paid" ? "complete" : "current", at: null },
            { label: `${fulfillmentMode.replace(/_/g, " ")} dispatch`, status: lifecycleStatus === "payment_required" ? "waiting" : "current", at: null },
            { label: "Driver assigned", status: "waiting", at: null },
            { label: "Pickup, ride, drop-off", status: "waiting", at: null }
          ]
        };
        const pricing = calculateRidePricing({
          providerBillCents: payload.providerBillCents || null,
          route,
          provider: fulfillmentMode,
          source: payload.providerBillCents ? "provider_bill" : "route_estimate"
        });
        const result = await transaction(async tx => {
          const lead = (await tx(
            `INSERT INTO leads (
              resident_id, service_id, business_id, request_type, requested_time, status,
              pickup_label, pickup_lat, pickup_lng, dropoff_label, dropoff_lat, dropoff_lng,
              distance_meters, duration_seconds, route_provider, route_metadata,
              fulfillment_mode, lifecycle_status, fulfillment_provider, fulfillment_metadata,
              payment_responsibility, payment_status, payer_user_id, payment_metadata,
              provider_bill_cents, tax_cents, refund_reserve_cents, platform_margin_cents, total_charge_cents, pricing_metadata
             )
             VALUES ($1,$2,$3,$4,$5,'matched',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING *`,
            [
              resident.id, service.id, service.business_id, payload.label || service.name, rideIntake.scheduledFor || payload.time || null,
              pickup?.label || null, pickup?.lat || null, pickup?.lng || null,
              dropoff?.label || null, dropoff?.lat || null, dropoff?.lng || null,
              route?.distanceMeters || null, route?.durationSeconds || null, route?.provider || null, JSON.stringify(route?.metadata || {}),
              fulfillmentMode, lifecycleStatus, selectedFulfillment.provider || fulfillmentMode, JSON.stringify(fulfillmentMetadata),
              paymentResponsibility, paymentStatus, payload.payerUserId || user.id, JSON.stringify({ payerRole: payload.payerRole || "senior", requiredBeforeDispatch: true }),
              pricing.providerBillCents, pricing.taxCents, pricing.refundReserveCents, pricing.platformMarginCents, pricing.totalChargeCents, JSON.stringify(pricing)
            ]
          )).rows[0];
          const booking = (await tx(
            `INSERT INTO bookings (
              lead_id, resident_id, business_id, service_id, scheduled_for, label, status,
              pickup_label, pickup_lat, pickup_lng, dropoff_label, dropoff_lat, dropoff_lng,
              distance_meters, duration_seconds, route_provider, route_metadata,
              fulfillment_mode, lifecycle_status, fulfillment_provider, fulfillment_metadata,
              payment_responsibility, payment_status, payer_user_id, payment_metadata,
              provider_bill_cents, tax_cents, refund_reserve_cents, platform_margin_cents, total_charge_cents, pricing_metadata
             )
             VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
            [
              lead.id, resident.id, service.business_id, service.id, rideIntake.scheduledFor, payload.label || service.name,
              pickup?.label || null, pickup?.lat || null, pickup?.lng || null,
              dropoff?.label || null, dropoff?.lat || null, dropoff?.lng || null,
              route?.distanceMeters || null, route?.durationSeconds || null, route?.provider || null, JSON.stringify(route?.metadata || {}),
              fulfillmentMode, lifecycleStatus, selectedFulfillment.provider || fulfillmentMode, JSON.stringify(fulfillmentMetadata),
              paymentResponsibility, paymentStatus, payload.payerUserId || user.id, JSON.stringify({ payerRole: payload.payerRole || "senior", requiredBeforeDispatch: true }),
              pricing.providerBillCents, pricing.taxCents, pricing.refundReserveCents, pricing.platformMarginCents, pricing.totalChargeCents, JSON.stringify(pricing)
            ]
          )).rows[0];
          return { lead, booking };
        });
        await audit(req, user, "resident_booking_requested", "booking", result.booking.id, { leadId: result.lead.id, serviceId: service.id, routeProvider: route?.provider || null, distanceMeters: route?.distanceMeters || null, fulfillmentMode, lifecycleStatus, totalChargeCents: pricing.totalChargeCents });
        const dispatchJob = await enqueueJob("dispatch", "ride_dispatch", {
          bookingId: result.booking.id,
          leadId: result.lead.id,
          residentId: resident.id,
          businessId: service.business_id,
          fulfillmentMode,
          lifecycleStatus,
          paymentStatus,
          scheduledFor: rideIntake.scheduledFor
        }, new Date(), 6);
        return { ok: true, lead: result.lead, booking: result.booking, fulfillment: selectedFulfillment, pricing, dispatchJob };
      }

      if (user.role === "business") {
        const business = await getBusinessForUser(user);
        if (!business || business.status !== "approved") {
          const error = new Error("Business must be approved before accepting leads");
          error.status = 403;
          throw error;
        }
        const lead = payload.leadId
          ? (await query(`SELECT * FROM leads WHERE id = $1 AND business_id = $2`, [payload.leadId, business.id])).rows[0]
          : (await query(`SELECT * FROM leads WHERE service_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT 1`, [required(payload.serviceId, "serviceId"), business.id])).rows[0];
        if (!lead) {
          const error = new Error("Lead not found for this business");
          error.status = 404;
          throw error;
        }
        if (["accepted", "booked", "closed"].includes(lead.status)) {
          const booking = (await query(`SELECT * FROM bookings WHERE lead_id = $1 ORDER BY updated_at DESC LIMIT 1`, [lead.id])).rows[0];
          await audit(req, user, "business_lead_acceptance_idempotent", "lead", lead.id, { bookingId: booking?.id || null, status: lead.status }, "info");
          return { ok: true, idempotent: true, lead, booking };
        }
        const entitlement = await getLeadEntitlement(business.id);
        requireBillingAccess(entitlement, "accepting leads");
        if (entitlement.used >= entitlement.allowed) {
          const error = new Error(`Lead limit reached for the ${entitlement.plan === "free" ? "free" : "$100/month Growth"} package.`);
          error.status = 402;
          throw error;
        }
        const result = await transaction(async tx => {
          const subscriptionColumn = entitlement.plan === "free" ? "used_leads_year" : "used_leads_month";
          await tx(`UPDATE subscriptions SET ${subscriptionColumn} = ${subscriptionColumn} + 1, updated_at = now() WHERE business_id = $1`, [business.id]);
          const updatedLead = (await tx(`UPDATE leads SET status = 'accepted', updated_at = now() WHERE id = $1 RETURNING *`, [lead.id])).rows[0];
          let booking = (await tx(`UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE lead_id = $1 RETURNING *`, [lead.id])).rows[0];
          if (!booking) {
            booking = (await tx(
              `INSERT INTO bookings (lead_id, resident_id, business_id, service_id, label, status)
               VALUES ($1,$2,$3,$4,$5,'confirmed') RETURNING *`,
              [lead.id, lead.resident_id, business.id, lead.service_id, payload.label || lead.request_type]
            )).rows[0];
          }
          return { lead: updatedLead, booking };
        });
        await audit(req, user, "business_lead_accepted", "lead", result.lead.id, { bookingId: result.booking.id, plan: entitlement.plan });
        return { ok: true, lead: result.lead, booking: result.booking };
      }

      const error = new Error("Insufficient permissions");
      error.status = 403;
      throw error;
    }

    const healthConnectMatch = url.pathname.match(/^\/api\/health\/connect\/([^/]+)$/);
    if (req.method === "POST" && healthConnectMatch) {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const source = normalizeProviderId(healthConnectMatch[1]);
      const hasCredential = Boolean(payload.accessToken || payload.refreshToken || payload.oauthCode);
      const requiresOAuth = sourceRequiresOAuth(source);
      const status = requiresOAuth && !hasCredential ? "pending_oauth" : "active";
      const credentialRef = hasCredential ? hashToken(String(payload.accessToken || payload.refreshToken || payload.oauthCode)) : null;
      const scopes = Array.isArray(payload.scopes) ? payload.scopes.map(String) : ["steps", "sleep", "heartRate", "oxygenSaturation", "respiratoryRate", "hrv", "calories"];
      const result = await query(
        `INSERT INTO health_sources (user_id, resident_id, source, display_name, status, scopes, credential_ref, metadata, connected_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $5 = 'active' THEN now() ELSE NULL END,now())
         ON CONFLICT (user_id, source) DO UPDATE SET resident_id = EXCLUDED.resident_id, display_name = EXCLUDED.display_name, status = EXCLUDED.status, scopes = EXCLUDED.scopes, credential_ref = COALESCE(EXCLUDED.credential_ref, health_sources.credential_ref), metadata = health_sources.metadata || EXCLUDED.metadata, connected_at = COALESCE(health_sources.connected_at, EXCLUDED.connected_at), updated_at = now()
         RETURNING *`,
        [user.id, resident.id, source, payload.displayName || healthSourceDisplayName(source), status, scopes, credentialRef, JSON.stringify({ requiresOAuth, native: !requiresOAuth, device: payload.device || null })]
      );
      await query(
        `INSERT INTO health_consents (resident_id, granted, source, data_types, updated_at)
         VALUES ($1,true,$2,$3,now())
         ON CONFLICT (resident_id) DO UPDATE SET granted = true, source = EXCLUDED.source, data_types = EXCLUDED.data_types, updated_at = now()`,
        [resident.id, source, scopes]
      );
      await audit(req, user, "health_source_connected", "health_source", result.rows[0].id, { source, status, scopes }, status === "active" ? "info" : "warning");
      return { healthSource: result.rows[0], oauthRequired: requiresOAuth && !hasCredential };
    }

    const healthSyncMatch = url.pathname.match(/^\/api\/health\/sync\/([^/]+)$/);
    if (req.method === "POST" && healthSyncMatch) {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const source = normalizeProviderId(healthSyncMatch[1]);
      const healthSource = (await query(`SELECT * FROM health_sources WHERE user_id = $1 AND source = $2`, [user.id, source])).rows[0];
      if (!healthSource || healthSource.status !== "active") {
        const error = new Error(`${healthSourceDisplayName(source)} is not connected for health sync`);
        error.status = 403;
        throw error;
      }
      const entries = Array.isArray(payload.dailyMetrics) ? payload.dailyMetrics : Array.isArray(payload.readings) ? payload.readings : [payload];
      const saved = [];
      for (const entry of entries) {
        saved.push(await persistHealthMetric(req, user, resident, normalizeHealthMetrics({ ...entry, source })));
      }
      await query(`UPDATE health_sources SET last_sync_at = now(), updated_at = now() WHERE id = $1`, [healthSource.id]);
      return { synced: saved.length, results: saved };
    }

    const manualMetricMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/manual-metric$/);
    if (req.method === "POST" && manualMetricMatch) {
      const resident = await healthResidentAccess(user, manualMetricMatch[1], "summary");
      if (user.role !== "senior" && user.role !== "superadmin") {
        const error = new Error("Only the senior or superadmin can enter manual health metrics");
        error.status = 403;
        throw error;
      }
      const result = await persistHealthMetric(req, user, resident, normalizeHealthMetrics({ ...payload, source: payload.source || "manual" }));
      return result;
    }

    const summaryMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/summary$/);
    if (req.method === "GET" && summaryMatch) {
      const resident = await healthResidentAccess(user, summaryMatch[1], "summary");
      const score = (await query(`SELECT * FROM health_scores WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 1`, [resident.id])).rows[0] || null;
      const metric = (await query(`SELECT * FROM health_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 1`, [resident.id])).rows[0] || null;
      const alerts = (await query(`SELECT * FROM health_alerts WHERE senior_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 5`, [resident.id])).rows;
      const sources = (await query(`SELECT id, source, display_name, status, scopes, connected_at, last_sync_at FROM health_sources WHERE resident_id = $1 ORDER BY updated_at DESC`, [resident.id])).rows;
      return { residentId: resident.id, metric, score, alerts, sources };
    }

    const trendsMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/trends$/);
    if (req.method === "GET" && trendsMatch) {
      const resident = await healthResidentAccess(user, trendsMatch[1], "trends");
      const days = healthRangeDays(url.searchParams.get("range"));
      const metrics = (await query(
        `SELECT * FROM health_daily_metrics WHERE senior_id = $1 AND metric_date >= current_date - $2::int ORDER BY metric_date ASC`,
        [resident.id, days]
      )).rows;
      const scores = (await query(
        `SELECT * FROM health_scores WHERE senior_id = $1 AND metric_date >= current_date - $2::int ORDER BY metric_date ASC`,
        [resident.id, days]
      )).rows;
      return { range: `${days}d`, metrics, scores };
    }

    const scoresMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/scores$/);
    if (req.method === "GET" && scoresMatch) {
      const resident = await healthResidentAccess(user, scoresMatch[1], "trends");
      const scores = (await query(`SELECT * FROM health_scores WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 30`, [resident.id])).rows;
      return { scores };
    }

    const alertsMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/alerts$/);
    if (req.method === "GET" && alertsMatch) {
      const resident = await healthResidentAccess(user, alertsMatch[1], "alerts");
      const status = url.searchParams.get("status") || "open";
      const alerts = (await query(`SELECT * FROM health_alerts WHERE senior_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 50`, [resident.id, status])).rows;
      return { alerts };
    }

    const careActionsMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/care-actions$/);
    if (req.method === "GET" && careActionsMatch) {
      const resident = await healthResidentAccess(user, careActionsMatch[1], "alerts");
      const status = url.searchParams.get("status") || "open";
      const actions = (await query(
        `SELECT ca.*, ha.alert_type, ha.confirmation_status, ha.confidence
         FROM health_care_actions ca
         LEFT JOIN health_alerts ha ON ha.id = ca.alert_id
         WHERE ca.senior_id = $1 AND ca.status = $2
         ORDER BY ca.created_at DESC LIMIT 50`,
        [resident.id, status]
      )).rows;
      return { actions };
    }

    const liveEventsMatch = url.pathname.match(/^\/api\/health\/senior\/([^/]+)\/live-events$/);
    if (req.method === "GET" && liveEventsMatch) {
      const resident = await healthResidentAccess(user, liveEventsMatch[1], "alerts");
      const since = url.searchParams.get("since");
      const events = since
        ? (await query(`SELECT * FROM health_realtime_events WHERE senior_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 100`, [resident.id, since])).rows
        : (await query(`SELECT * FROM health_realtime_events WHERE senior_id = $1 ORDER BY created_at DESC LIMIT 100`, [resident.id])).rows;
      return { events, serverTime: new Date().toISOString(), transport: "polling-live-feed" };
    }

    const actionAckMatch = url.pathname.match(/^\/api\/health\/care-actions\/([^/]+)\/acknowledge$/);
    if (req.method === "PATCH" && actionAckMatch) {
      const action = (await query(`SELECT * FROM health_care_actions WHERE id = $1`, [actionAckMatch[1]])).rows[0];
      if (!action) {
        const error = new Error("Care action not found");
        error.status = 404;
        throw error;
      }
      await healthResidentAccess(user, action.senior_id, "alerts");
      const updated = (await query(
        `UPDATE health_care_actions SET status = 'acknowledged', acknowledged_by = $2, acknowledged_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
        [action.id, user.id]
      )).rows[0];
      const event = await createRealtimeHealthEvent(action.senior_id, "care_action_acknowledged", action.urgency, "Care action acknowledged", `${user.display_name} acknowledged: ${action.title}`, "health_care_actions", action.id, { actionId: action.id, acknowledgedBy: user.id });
      await audit(req, user, "health_care_action_acknowledged", "health_care_action", action.id, { eventId: event.id }, auditSeverity(action.urgency));
      return { action: updated, event };
    }

    const actionResolveMatch = url.pathname.match(/^\/api\/health\/care-actions\/([^/]+)\/resolve$/);
    if (req.method === "PATCH" && actionResolveMatch) {
      const action = (await query(`SELECT * FROM health_care_actions WHERE id = $1`, [actionResolveMatch[1]])).rows[0];
      if (!action) {
        const error = new Error("Care action not found");
        error.status = 404;
        throw error;
      }
      await healthResidentAccess(user, action.senior_id, "alerts");
      const updated = (await query(
        `UPDATE health_care_actions SET status = 'resolved', resolved_by = $2, resolved_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
        [action.id, user.id]
      )).rows[0];
      const event = await createRealtimeHealthEvent(action.senior_id, "care_action_resolved", action.urgency, "Care action resolved", payload.note || `${user.display_name} resolved: ${action.title}`, "health_care_actions", action.id, { actionId: action.id, resolvedBy: user.id, note: payload.note || null });
      await audit(req, user, "health_care_action_resolved", "health_care_action", action.id, { eventId: event.id, note: payload.note || null }, auditSeverity(action.urgency));
      return { action: updated, event };
    }

    const resolveAlertMatch = url.pathname.match(/^\/api\/health\/alerts\/([^/]+)\/resolve$/);
    if (req.method === "PATCH" && resolveAlertMatch) {
      const alert = (await query(`SELECT * FROM health_alerts WHERE id = $1`, [resolveAlertMatch[1]])).rows[0];
      if (!alert) {
        const error = new Error("Health alert not found");
        error.status = 404;
        throw error;
      }
      await healthResidentAccess(user, alert.senior_id, "alerts");
      const result = await query(
        `UPDATE health_alerts SET status = 'resolved', resolved_at = now(), resolved_by = $2, metadata = metadata || $3::jsonb WHERE id = $1 RETURNING *`,
        [alert.id, user.id, JSON.stringify({ resolutionNote: payload.note || null })]
      );
      await audit(req, user, "health_alert_resolved", "health_alert", alert.id, { note: payload.note || null });
      return { alert: result.rows[0] };
    }

    const familySummaryMatch = url.pathname.match(/^\/api\/health\/family\/([^/]+)\/summary$/);
    if (req.method === "GET" && familySummaryMatch) {
      const resident = await healthResidentAccess(user, familySummaryMatch[1], "summary");
      const score = (await query(`SELECT * FROM health_scores WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 1`, [resident.id])).rows[0] || null;
      const alerts = (await query(`SELECT id, alert_type, severity, title, body, created_at FROM health_alerts WHERE senior_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 5`, [resident.id])).rows;
      const metric = (await query(`SELECT metric_date, steps, sleep_minutes, resting_heart_rate, oxygen_saturation, medication_adherence_percent, mood_score FROM health_daily_metrics WHERE senior_id = $1 ORDER BY metric_date DESC LIMIT 1`, [resident.id])).rows[0] || null;
      return { residentId: resident.id, familyView: true, score, metric, alerts };
    }

    if (req.method === "POST" && url.pathname === "/api/health/permissions") {
      requireRole(user, ["senior", "superadmin"]);
      const seniorId = payload.seniorId || "self";
      const resident = await healthResidentAccess(user, seniorId, "summary");
      const granteeUserId = required(payload.granteeUserId, "granteeUserId");
      const visibility = Array.isArray(payload.visibility) ? payload.visibility.map(String) : ["summary", "alerts", "trends"];
      const result = await query(
        `INSERT INTO health_sharing_permissions (senior_id, grantee_user_id, visibility, can_view_trends, can_view_alerts, can_view_medication_adherence, can_view_location_context, status, created_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,now())
         ON CONFLICT (senior_id, grantee_user_id) DO UPDATE SET visibility = EXCLUDED.visibility, can_view_trends = EXCLUDED.can_view_trends, can_view_alerts = EXCLUDED.can_view_alerts, can_view_medication_adherence = EXCLUDED.can_view_medication_adherence, can_view_location_context = EXCLUDED.can_view_location_context, status = 'active', updated_at = now()
         RETURNING *`,
        [resident.id, granteeUserId, visibility, payload.canViewTrends !== false, payload.canViewAlerts !== false, payload.canViewMedicationAdherence !== false, payload.canViewLocationContext === true, user.id]
      );
      await audit(req, user, "health_permission_saved", "health_sharing_permission", result.rows[0].id, { granteeUserId, visibility });
      return { permission: result.rows[0] };
    }

    if (req.method === 'PATCH' && url.pathname === '/api/health/consent') {
      requireRole(user, ['senior']);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error('Resident profile not found');
        error.status = 404;
        throw error;
      }
      const allowedTypes = ['heartRate', 'oxygenSaturation', 'respiratoryRate', 'hrv', 'sleep', 'calories', 'steps'];
      const dataTypes = Array.isArray(payload.dataTypes) ? payload.dataTypes.filter(type => allowedTypes.includes(type)) : [];
      const result = await query(
        `INSERT INTO health_consents (resident_id, granted, source, data_types, updated_at)
         VALUES ($1,$2,$3,$4,now())
         ON CONFLICT (resident_id) DO UPDATE SET granted = EXCLUDED.granted, source = EXCLUDED.source, data_types = EXCLUDED.data_types, updated_at = now()
         RETURNING *`,
        [resident.id, payload.granted === true, payload.source || 'mobile-healthkit-health-connect-sync', dataTypes]
      );
      await audit(req, user, payload.granted === true ? 'health_consent_granted' : 'health_consent_revoked', 'health_consent', result.rows[0].id, { source: result.rows[0].source, dataTypes }, 'info');
      return { healthConsent: result.rows[0] };
    }

    if (req.method === 'POST' && url.pathname === '/api/health/vitals') {
      requireRole(user, ['senior']);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error('Resident profile not found');
        error.status = 404;
        throw error;
      }
      const consent = (await query(`SELECT * FROM health_consents WHERE resident_id = $1`, [resident.id])).rows[0];
      const readings = Array.isArray(payload.readings) ? payload.readings : [payload];
      const requestedTypes = [...new Set(readings.flatMap(healthReadingDataTypes))];
      const missingTypes = requestedTypes.filter(type => !(consent?.data_types || []).includes(type));
      if (!consent?.granted) {
        const error = new Error('Health data sync requires resident consent');
        error.status = 403;
        throw error;
      }
      if (missingTypes.length) {
        const error = new Error(`Missing health consent for: ${missingTypes.join(', ')}`);
        error.status = 403;
        throw error;
      }
      if (payload.source && consent.source && payload.source !== consent.source) {
        const error = new Error(`Health data source mismatch. Expected ${consent.source}`);
        error.status = 403;
        throw error;
      }
      const inserted = [];
      for (const reading of readings) {
        inserted.push((await query(
          `INSERT INTO health_vitals (resident_id, source, heart_rate, oxygen_saturation, respiratory_rate, hrv, sleep_minutes, calories_today, steps_today, captured_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [resident.id, payload.source || consent.source, reading.heartRate ?? null, reading.oxygenSaturation ?? null, reading.respiratoryRate ?? null, reading.hrv ?? null, reading.sleepMinutes ?? null, reading.caloriesToday ?? null, reading.stepsToday ?? null, reading.capturedAt || new Date().toISOString()]
        )).rows[0]);
      }
      const recent = (await query(`SELECT * FROM health_vitals WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 24`, [resident.id])).rows;
      const latestSummary = evaluateHealthVitals(inserted);
      if (latestSummary.riskLevel === 'high') {
        await createSafetyEvent(req, user, resident.id, 'health-vitals-risk', 'high', `${user.display_name} has elevated health risk signals: ${latestSummary.riskReasons.join(', ')}. Trusted circle notification triggered.`, { source: payload.source });
      }
      await enqueueJob("telemetry", "telemetry_ingest", {
        source: "health_vitals",
        residentId: resident.id,
        readingIds: inserted.map(reading => reading.id),
        riskLevel: latestSummary.riskLevel
      });
      await audit(req, user, 'health_vitals_synced', 'health_vitals', inserted[0]?.id || null, { readings: inserted.length, risk: latestSummary.riskLevel, reasons: latestSummary.riskReasons }, auditSeverity(latestSummary.riskLevel));
      return { healthVitals: { readings: recent, summary: evaluateHealthVitals(recent), latestSummary } };
    }

    if (req.method === 'POST' && url.pathname === '/api/wearables/telemetry') {
      requireRole(user, ['senior']);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error('Resident profile not found');
        error.status = 404;
        throw error;
      }
      const devices = Array.isArray(payload.devices) ? payload.devices : [];
      for (const device of devices) {
        await query(
          `INSERT INTO wearable_devices (id, resident_id, device_type, name, status, battery_percent, signal, last_seen_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
           ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, battery_percent = EXCLUDED.battery_percent, signal = EXCLUDED.signal, last_seen_at = EXCLUDED.last_seen_at, updated_at = now()`,
          [String(device.id), resident.id, device.type || 'unknown', device.name || 'Wearable device', device.status || 'connected', device.batteryPercent ?? null, device.signal || null, device.lastSeenAt || new Date().toISOString()]
        );
        await query(
          `INSERT INTO wearable_telemetry (resident_id, source, device_id, fall_confidence, sos_pressed, proximity_zone, proximity_distance_meters, proximity_safe)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [resident.id, payload.source || 'mobile-wearable-sync', String(device.id), device.fallConfidence || 0, Boolean(device.sosPressed), payload.proximity?.currentZone || null, payload.proximity?.distanceMeters || null, payload.proximity?.safe ?? null]
        );
      }
      const storedDevices = (await query(`SELECT * FROM wearable_devices WHERE resident_id = $1 ORDER BY updated_at DESC`, [resident.id])).rows;
      const summary = evaluateWearables(devices, payload.proximity || {});
      if (summary.riskLevel === 'high') {
        await createSafetyEvent(req, user, resident.id, summary.sosPressed ? 'wearable-sos-pressed' : 'wearable-fall-detected', 'critical', `${user.display_name} has a wearable safety alert: ${summary.riskReasons.join(', ')}. Trusted circle notification triggered.`, { source: payload.source });
      }
      await audit(req, user, 'wearable_telemetry_synced', 'wearable_telemetry', null, { devices: devices.length, risk: summary.riskLevel, reasons: summary.riskReasons }, auditSeverity(summary.riskLevel));
      return { wearables: { devices: storedDevices, latestSummary: summary } };
    }

    if (req.method === 'POST' && url.pathname === '/api/safety/voice-sos') {
      requireRole(user, ['senior']);
      const resident = await getResidentForUser(user);
      const detected = classifyVoiceSosCommand(payload.command || payload.phrase);
      if (!detected) {
        const error = new Error('Voice command is not configured as an SOS command');
        error.status = 400;
        throw error;
      }
      if (payload.confirmed !== true) {
        const error = new Error('Voice SOS requires confirmation before escalation');
        error.status = 409;
        throw error;
      }
      const event = await createSafetyEvent(req, user, resident.id, detected.type, detected.severity, `${user.display_name} triggered Voice SOS: "${detected.label}". Route: ${detected.route}.`, { source: payload.source || 'mobile-voice-command', route: detected.route });
      await audit(req, user, 'voice_sos_command_confirmed', 'voice_sos', event.id, { command: detected.label, route: detected.route }, auditSeverity(detected.severity));
      return { sosEvent: { ...event, command: detected.label, route: detected.route, emergencyNumber: detected.emergencyNumber, nativeDialStatus: detected.emergencyNumber ? 'pending-native-confirmation' : 'not-required' } };
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/sos-events/') && url.pathname.endsWith('/ack')) {
      requireRole(user, ['trusted_person', 'superadmin']);
      const id = url.pathname.split('/')[3];
      await authorizeSafetyEventAccess(user, id);
      const event = (await query(`UPDATE safety_events SET status = 'acknowledged', resolved_at = now() WHERE id = $1 RETURNING *`, [id])).rows[0];
      if (!event) {
        const error = new Error('SOS event not found');
        error.status = 404;
        throw error;
      }
      await audit(req, user, 'sos_event_acknowledged', 'safety_event', event.id, { eventType: event.event_type }, 'info');
      return { event };
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/sos-events/') && url.pathname.endsWith('/escalate')) {
      requireRole(user, ['trusted_person', 'superadmin']);
      const id = url.pathname.split('/')[3];
      await authorizeSafetyEventAccess(user, id);
      const event = (await query(`UPDATE safety_events SET status = 'escalated', severity = 'critical' WHERE id = $1 RETURNING *`, [id])).rows[0];
      if (!event) {
        const error = new Error('SOS event not found');
        error.status = 404;
        throw error;
      }
      await enqueueNotifications(event.resident_id, { ...event, severity: 'critical', body: `${user.display_name} escalated ${event.event_type}. Route: ${payload.route || 'call-emergency-and-circle'}.` }, event.notified_user_ids || []);
      await audit(req, user, 'sos_event_escalated', 'safety_event', event.id, { route: payload.route || 'call-emergency-and-circle' }, 'critical');
      return { event };
    }

    if (req.method === 'GET' && url.pathname === '/api/notifications') {
      const personId = url.searchParams.get('personId');
      const targetUserId = user.role === "superadmin" && personId ? personId : user.id;
      const rows = user.role === "superadmin" && !personId
        ? (await query(
          `SELECT n.*, row_to_json(nda.*) AS latest_attempt
           FROM notifications n
           LEFT JOIN LATERAL (
             SELECT provider, channel, status, provider_message_id, error, attempted_at
             FROM notification_delivery_attempts
             WHERE notification_id = n.id
             ORDER BY attempted_at DESC
             LIMIT 1
           ) nda ON true
           ORDER BY n.created_at DESC LIMIT 100`
        )).rows
        : (await query(
          `SELECT n.*, row_to_json(nda.*) AS latest_attempt
           FROM notifications n
           LEFT JOIN LATERAL (
             SELECT provider, channel, status, provider_message_id, error, attempted_at
             FROM notification_delivery_attempts
             WHERE notification_id = n.id
             ORDER BY attempted_at DESC
             LIMIT 1
           ) nda ON true
           WHERE n.user_id = $1
           ORDER BY n.created_at DESC LIMIT 100`,
          [targetUserId]
        )).rows;
      return { notifications: rows };
    }

    if (req.method === 'POST' && url.pathname.startsWith('/api/notifications/') && url.pathname.endsWith('/mark-delivered')) {
      const id = url.pathname.split('/')[3];
      const result = await query(
        `UPDATE notifications SET status = 'delivered', provider = COALESCE(provider, 'mobile-user-action'), delivered_at = now()
         WHERE id = $1 AND (user_id = $2 OR $3 = 'superadmin')
         RETURNING *`,
        [id, user.id, user.role]
      );
      if (!result.rows[0]) {
        const error = new Error("Notification not found");
        error.status = 404;
        throw error;
      }
      await query(
        `INSERT INTO notification_delivery_attempts (notification_id, provider, channel, status, provider_message_id)
         VALUES ($1, 'mobile-user-action', $2, 'delivered', $3)`,
        [id, result.rows[0].channel, `mobile-user-action_${id}_${Date.now()}`]
      );
      await audit(req, user, "notification_marked_delivered", "notification", id, {}, "info");
      return { notification: result.rows[0] };
    }

    if (req.method === 'POST' && url.pathname === '/api/notifications/process') {
      requireRole(user, ['superadmin']);
      const limit = Math.max(1, Number(payload.limit || 10));
      const failChannels = new Set(Array.isArray(payload.failChannels) ? payload.failChannels.map(channel => String(channel).toLowerCase()) : []);
      const queued = (await query(
        `SELECT * FROM notifications
         WHERE status IN ('queued', 'failed') AND (next_retry_at IS NULL OR next_retry_at <= now())
         ORDER BY created_at ASC LIMIT $1`,
        [limit]
      )).rows;
      const delivered = [];
      const failed = [];
      for (const notification of queued) {
        const provider = notification.channel === 'call' ? (process.env.CALL_PROVIDER || 'twilio-voice-simulator') : notification.channel === 'sms' ? (process.env.SMS_PROVIDER || 'twilio-sms-simulator') : (process.env.PUSH_PROVIDER || 'expo-push-simulator');
        const providerMessageId = `${provider}_${notification.id}_${Date.now()}`;
        if (failChannels.has(String(notification.channel).toLowerCase())) {
          const errorMessage = `${provider} simulated delivery failure for ${notification.channel}`;
          const updated = (await query(
            `UPDATE notifications
             SET status = 'failed',
                 provider = $1,
                 retry_count = retry_count + 1,
                 next_retry_at = now() + interval '5 minutes',
                 last_error = $2
             WHERE id = $3 RETURNING *`,
            [provider, errorMessage, notification.id]
          )).rows[0];
          await query(
            `INSERT INTO notification_delivery_attempts (notification_id, provider, channel, status, provider_message_id, error)
             VALUES ($1,$2,$3,'failed',$4,$5)`,
            [notification.id, provider, notification.channel, providerMessageId, errorMessage]
          );
          failed.push(updated);
          continue;
        }
        const updated = (await query(`UPDATE notifications SET status = 'delivered', provider = $1, provider_message_id = $2, sent_at = now(), delivered_at = now(), last_error = null WHERE id = $3 RETURNING *`, [provider, providerMessageId, notification.id])).rows[0];
        await query(
          `INSERT INTO notification_delivery_attempts (notification_id, provider, channel, status, provider_message_id)
           VALUES ($1,$2,$3,'delivered',$4)`,
          [notification.id, provider, notification.channel, providerMessageId]
        );
        delivered.push(updated);
      }
      const remainingQueued = Number((await query(`SELECT count(*) FROM notifications WHERE status IN ('queued', 'failed') AND (next_retry_at IS NULL OR next_retry_at <= now())`)).rows[0].count);
      await audit(req, user, 'notification_queue_processed', 'notification_queue', null, { delivered: delivered.length, failed: failed.length, remainingQueued }, failed.length ? 'warning' : 'info');
      return { delivered, failed, remainingQueued };
    }

    if (req.method === "POST" && url.pathname === "/api/safety/safe-zones") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const name = String(payload.name || "").trim();
      const lat = Number(payload.lat ?? payload.centerLat);
      const lng = Number(payload.lng ?? payload.centerLng);
      const radiusMeters = Math.max(25, Math.min(5000, Number(payload.radiusMeters || 150)));
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        const error = new Error("Safe zone name, latitude, and longitude are required");
        error.status = 400;
        throw error;
      }
      const safeZone = (await query(
        `INSERT INTO resident_safe_zones (resident_id, name, center_lat, center_lng, radius_meters, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [resident.id, name, lat, lng, radiusMeters, user.id]
      )).rows[0];
      await query(
        `INSERT INTO safe_zones (senior_id, resident_safe_zone_id, name, type, latitude, longitude, radius_meters)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [resident.id, safeZone.id, name, String(payload.type || "OTHER").toUpperCase(), lat, lng, radiusMeters]
      );
      await audit(req, user, "resident_safe_zone_created", "resident_safe_zone", safeZone.id, { residentId: resident.id, name, radiusMeters }, "info");
      return { safeZone };
    }

    if (req.method === "POST" && url.pathname === "/api/context/observations") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const environmentPayload = payload.environment || {};
      const mobilityPayload = payload.mobility || {};
      const socialPayload = payload.social || {};
      const locationPayload = payload.location || {};
      let environmentObservation = null;
      let mobilitySnapshot = null;
      let socialSnapshot = null;
      let locationPoint = null;
      const guidanceItems = [];

      if (Object.keys(environmentPayload).length) {
        environmentObservation = (await query(
          `INSERT INTO environment_observations (
             resident_id, observed_at, provider, weather_condition, temperature_f, feels_like_f,
             precipitation_probability_percent, snow_probability_percent, wind_mph, uv_index,
             aqi, aqi_category, pollen_tree_level, pollen_grass_level, pollen_weed_level,
             ozone_level, smoke_risk, wildfire_risk, heat_risk, ice_risk, storm_risk, metadata
           ) VALUES ($1,COALESCE($2::timestamptz, now()),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
           RETURNING *`,
          [
            resident.id,
            environmentPayload.observedAt || null,
            environmentPayload.provider || "mobile_context",
            environmentPayload.condition || environmentPayload.weatherCondition || null,
            environmentPayload.temperatureF ?? null,
            environmentPayload.feelsLikeF ?? null,
            environmentPayload.precipitationProbabilityPercent ?? null,
            environmentPayload.snowProbabilityPercent ?? null,
            environmentPayload.windMph ?? null,
            environmentPayload.uvIndex ?? null,
            environmentPayload.aqi ?? null,
            environmentPayload.aqiCategory || null,
            environmentPayload.pollenTreeLevel || environmentPayload.pollenLevel || null,
            environmentPayload.pollenGrassLevel || null,
            environmentPayload.pollenWeedLevel || null,
            environmentPayload.ozoneLevel || null,
            environmentPayload.smokeRisk || null,
            environmentPayload.wildfireRisk || null,
            environmentPayload.heatRisk || null,
            environmentPayload.iceRisk || null,
            environmentPayload.stormRisk || null,
            JSON.stringify(environmentPayload.metadata || {})
          ]
        )).rows[0];
        const pollenLevel = String(environmentPayload.pollenLevel || environmentPayload.pollenTreeLevel || "").toLowerCase();
        if (pollenLevel === "high") {
          guidanceItems.push({
            domain: "environment",
            severity: "watch",
            title: "High pollen today",
            body: "Limit outdoor activity this afternoon if allergies flare.",
            action: "Take allergy medication if prescribed."
          });
        }
        if (Number(environmentPayload.snowProbabilityPercent || 0) >= 40) {
          guidanceItems.push({
            domain: "transportation",
            severity: "watch",
            title: "Snow may affect travel",
            body: "Leave earlier for appointments if roads worsen.",
            action: "Review ride pickup time."
          });
        }
        if (String(environmentPayload.heatRisk || "").toLowerCase() === "high") {
          guidanceItems.push({
            domain: "health",
            severity: "watch",
            title: "Heat advisory today",
            body: "Drink extra water and avoid long outdoor activity.",
            action: "Add hydration reminders."
          });
        }
        const pollenScore = String(environmentPayload.pollenLevel || environmentPayload.pollenTreeLevel || "").toLowerCase() === "high" ? 85 : numericValue(environmentPayload.pollenLevel, 0);
        await query(
          `INSERT INTO environmental_daily_metrics (
             senior_id, metric_date, aqi, pollen_level, uv_index, temperature_high, temperature_low,
             storm_risk, snow_risk, wildfire_risk, heat_risk, smoke_risk, humidity_percent, provider, metadata
           ) VALUES ($1,COALESCE($2::date, current_date),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (senior_id, metric_date) DO UPDATE SET
             aqi = COALESCE(EXCLUDED.aqi, environmental_daily_metrics.aqi),
             pollen_level = COALESCE(EXCLUDED.pollen_level, environmental_daily_metrics.pollen_level),
             uv_index = COALESCE(EXCLUDED.uv_index, environmental_daily_metrics.uv_index),
             temperature_high = COALESCE(EXCLUDED.temperature_high, environmental_daily_metrics.temperature_high),
             temperature_low = COALESCE(EXCLUDED.temperature_low, environmental_daily_metrics.temperature_low),
             storm_risk = COALESCE(EXCLUDED.storm_risk, environmental_daily_metrics.storm_risk),
             snow_risk = COALESCE(EXCLUDED.snow_risk, environmental_daily_metrics.snow_risk),
             wildfire_risk = COALESCE(EXCLUDED.wildfire_risk, environmental_daily_metrics.wildfire_risk),
             heat_risk = COALESCE(EXCLUDED.heat_risk, environmental_daily_metrics.heat_risk),
             smoke_risk = COALESCE(EXCLUDED.smoke_risk, environmental_daily_metrics.smoke_risk),
             humidity_percent = COALESCE(EXCLUDED.humidity_percent, environmental_daily_metrics.humidity_percent),
             provider = EXCLUDED.provider,
             metadata = environmental_daily_metrics.metadata || EXCLUDED.metadata,
             updated_at = now()`,
          [
            resident.id,
            environmentPayload.metricDate || null,
            environmentPayload.aqi ?? null,
            pollenScore || null,
            environmentPayload.uvIndex ?? null,
            environmentPayload.temperatureHigh ?? environmentPayload.temperatureF ?? null,
            environmentPayload.temperatureLow ?? environmentPayload.temperatureF ?? null,
            numericValue(environmentPayload.stormRisk, String(environmentPayload.stormRisk || "").toLowerCase() === "medium" ? 60 : 0) || null,
            environmentPayload.snowRisk ?? environmentPayload.snowProbabilityPercent ?? null,
            environmentPayload.wildfireRisk ?? null,
            numericValue(environmentPayload.heatRisk, String(environmentPayload.heatRisk || "").toLowerCase() === "high" ? 85 : 0) || null,
            numericValue(environmentPayload.smokeRisk, 0) || null,
            environmentPayload.humidityPercent ?? null,
            environmentPayload.provider || "mobile_context",
            JSON.stringify({ environmentObservationId: environmentObservation.id })
          ]
        );
      }

      if (Object.keys(mobilityPayload).length) {
        const stepsDeltaPercent = mobilityPayload.stepsDeltaPercent ?? mobilityPayload.steps_delta_percent ?? null;
        const weatherAdjusted = Boolean(mobilityPayload.weatherAdjusted || mobilityPayload.weather_adjusted);
        const mobilityStatus = Number(stepsDeltaPercent || 0) <= -35 && !weatherAdjusted ? "watch" : "normal";
        mobilitySnapshot = (await query(
          `INSERT INTO mobility_context_snapshots (
             resident_id, snapshot_date, steps_today, steps_baseline, steps_delta_percent,
             walking_speed_mps, distance_meters, community_visits, outside_home_minutes,
             weather_adjusted, status, reasons, metadata
           ) VALUES ($1,COALESCE($2::date, current_date),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (resident_id, snapshot_date) DO UPDATE SET
             steps_today = EXCLUDED.steps_today,
             steps_baseline = EXCLUDED.steps_baseline,
             steps_delta_percent = EXCLUDED.steps_delta_percent,
             walking_speed_mps = EXCLUDED.walking_speed_mps,
             distance_meters = EXCLUDED.distance_meters,
             community_visits = EXCLUDED.community_visits,
             outside_home_minutes = EXCLUDED.outside_home_minutes,
             weather_adjusted = EXCLUDED.weather_adjusted,
             status = EXCLUDED.status,
             reasons = EXCLUDED.reasons,
             metadata = EXCLUDED.metadata
           RETURNING *`,
          [
            resident.id,
            mobilityPayload.snapshotDate || null,
            mobilityPayload.stepsToday ?? null,
            mobilityPayload.stepsBaseline ?? null,
            stepsDeltaPercent,
            mobilityPayload.walkingSpeedMps ?? null,
            mobilityPayload.distanceMeters ?? null,
            mobilityPayload.communityVisits ?? null,
            mobilityPayload.outsideHomeMinutes ?? null,
            weatherAdjusted,
            mobilityStatus,
            mobilityPayload.reasons || [],
            JSON.stringify(mobilityPayload.metadata || {})
          ]
        )).rows[0];
        if (mobilityStatus === "watch") {
          guidanceItems.push({
            domain: "mobility",
            severity: "watch",
            title: "Possible wellness decline",
            body: "Activity is lower than usual without a weather explanation.",
            action: "Set watch status."
          });
        }
        await query(
          `INSERT INTO location_daily_metrics (
             senior_id, metric_date, distance_traveled_miles, safe_zone_visits, out_of_zone_minutes,
             home_time_minutes, community_time_minutes, doctor_visits, pharmacy_visits,
             no_movement_minutes, unusual_outside_safe_zone, metadata
           ) VALUES ($1,COALESCE($2::date, current_date),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (senior_id, metric_date) DO UPDATE SET
             distance_traveled_miles = COALESCE(EXCLUDED.distance_traveled_miles, location_daily_metrics.distance_traveled_miles),
             safe_zone_visits = GREATEST(location_daily_metrics.safe_zone_visits, EXCLUDED.safe_zone_visits),
             out_of_zone_minutes = GREATEST(location_daily_metrics.out_of_zone_minutes, EXCLUDED.out_of_zone_minutes),
             home_time_minutes = COALESCE(EXCLUDED.home_time_minutes, location_daily_metrics.home_time_minutes),
             community_time_minutes = COALESCE(EXCLUDED.community_time_minutes, location_daily_metrics.community_time_minutes),
             doctor_visits = GREATEST(location_daily_metrics.doctor_visits, EXCLUDED.doctor_visits),
             pharmacy_visits = GREATEST(location_daily_metrics.pharmacy_visits, EXCLUDED.pharmacy_visits),
             no_movement_minutes = GREATEST(location_daily_metrics.no_movement_minutes, EXCLUDED.no_movement_minutes),
             unusual_outside_safe_zone = location_daily_metrics.unusual_outside_safe_zone OR EXCLUDED.unusual_outside_safe_zone,
             metadata = location_daily_metrics.metadata || EXCLUDED.metadata,
             updated_at = now()`,
          [
            resident.id,
            mobilityPayload.snapshotDate || null,
            mobilityPayload.distanceMiles ?? (mobilityPayload.distanceMeters ? Number(mobilityPayload.distanceMeters) / 1609.344 : null),
            mobilityPayload.safeZoneVisits || 0,
            mobilityPayload.outOfZoneMinutes || 0,
            mobilityPayload.homeTimeMinutes ?? null,
            mobilityPayload.communityTimeMinutes ?? null,
            mobilityPayload.doctorVisits || 0,
            mobilityPayload.pharmacyVisits || 0,
            mobilityPayload.noMovementMinutes || 0,
            Boolean(mobilityPayload.unusualOutsideSafeZone),
            JSON.stringify({ mobilitySnapshotId: mobilitySnapshot.id })
          ]
        );
      }

      if (Object.keys(socialPayload).length) {
        const days = Number(socialPayload.daysWithoutFamilyContact ?? socialPayload.days_since_family_contact ?? 0);
        socialSnapshot = (await query(
          `INSERT INTO social_contact_snapshots (
             resident_id, snapshot_date, last_family_contact_at, days_since_family_contact,
             trusted_circle_touch_count, community_interaction_count, isolation_risk, metadata
           ) VALUES ($1,COALESCE($2::date, current_date),$3,$4,$5,$6,$7,$8)
           ON CONFLICT (resident_id, snapshot_date) DO UPDATE SET
             last_family_contact_at = EXCLUDED.last_family_contact_at,
             days_since_family_contact = EXCLUDED.days_since_family_contact,
             trusted_circle_touch_count = EXCLUDED.trusted_circle_touch_count,
             community_interaction_count = EXCLUDED.community_interaction_count,
             isolation_risk = EXCLUDED.isolation_risk,
             metadata = EXCLUDED.metadata
           RETURNING *`,
          [
            resident.id,
            socialPayload.snapshotDate || null,
            socialPayload.lastFamilyContactAt || null,
            days || null,
            socialPayload.trustedCircleTouchCount || 0,
            socialPayload.communityInteractionCount || 0,
            days >= 4 ? "watch" : "low",
            JSON.stringify(socialPayload.metadata || {})
          ]
        )).rows[0];
        await query(
          `INSERT INTO social_daily_metrics (
             senior_id, metric_date, messages_sent, messages_received, calls_completed,
             family_interactions, events_attended, guru_interactions,
             days_without_family_contact, days_without_social_interaction, metadata
           ) VALUES ($1,COALESCE($2::date, current_date),$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (senior_id, metric_date) DO UPDATE SET
             messages_sent = GREATEST(social_daily_metrics.messages_sent, EXCLUDED.messages_sent),
             messages_received = GREATEST(social_daily_metrics.messages_received, EXCLUDED.messages_received),
             calls_completed = GREATEST(social_daily_metrics.calls_completed, EXCLUDED.calls_completed),
             family_interactions = GREATEST(social_daily_metrics.family_interactions, EXCLUDED.family_interactions),
             events_attended = GREATEST(social_daily_metrics.events_attended, EXCLUDED.events_attended),
             guru_interactions = GREATEST(social_daily_metrics.guru_interactions, EXCLUDED.guru_interactions),
             days_without_family_contact = COALESCE(EXCLUDED.days_without_family_contact, social_daily_metrics.days_without_family_contact),
             days_without_social_interaction = COALESCE(EXCLUDED.days_without_social_interaction, social_daily_metrics.days_without_social_interaction),
             metadata = social_daily_metrics.metadata || EXCLUDED.metadata,
             updated_at = now()`,
          [
            resident.id,
            socialPayload.snapshotDate || null,
            socialPayload.messagesSent || 0,
            socialPayload.messagesReceived || 0,
            socialPayload.callsCompleted || 0,
            socialPayload.familyInteractions || 0,
            socialPayload.eventsAttended || 0,
            socialPayload.guruInteractions || 0,
            days || null,
            socialPayload.daysWithoutSocialInteraction ?? days ?? null,
            JSON.stringify({ socialSnapshotId: socialSnapshot.id })
          ]
        );
      }

      if (Object.keys(locationPayload).length) {
        locationPoint = (await query(
          `INSERT INTO resident_location_timeline (
             resident_id, lat, lng, location_label, movement_status, safe_zone_status, observed_at, source, metadata
           ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz, now()),$8,$9)
           RETURNING *`,
          [
            resident.id,
            locationPayload.lat ?? null,
            locationPayload.lng ?? null,
            locationPayload.label || locationPayload.locationLabel || null,
            locationPayload.movementStatus || null,
            locationPayload.safeZoneStatus || null,
            locationPayload.observedAt || null,
            locationPayload.source || "mobile_context",
            JSON.stringify(locationPayload.metadata || {})
          ]
        )).rows[0];
        if (String(locationPayload.safeZoneStatus || "").toLowerCase() === "outside") {
          await query(
            `INSERT INTO location_daily_metrics (senior_id, metric_date, out_of_zone_minutes, unusual_outside_safe_zone, metadata)
             VALUES ($1,current_date,$2,true,$3)
             ON CONFLICT (senior_id, metric_date) DO UPDATE SET
               out_of_zone_minutes = GREATEST(location_daily_metrics.out_of_zone_minutes, EXCLUDED.out_of_zone_minutes),
               unusual_outside_safe_zone = true,
               metadata = location_daily_metrics.metadata || EXCLUDED.metadata,
               updated_at = now()`,
            [resident.id, locationPayload.outOfZoneMinutes || 45, JSON.stringify({ locationPointId: locationPoint.id })]
          );
        }
      }

      if (!guidanceItems.length) {
        guidanceItems.push({
          domain: "health",
          severity: "info",
          title: "Context updated",
          body: "Guru has refreshed today's status.",
          action: "Continue monitoring."
        });
      }
      for (const item of guidanceItems) {
        await query(
          `INSERT INTO guru_context_signals (resident_id, domain, signal_key, severity, title, body, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [resident.id, item.domain, item.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), item.severity, item.title, item.body, JSON.stringify({ action: item.action || "" })]
        );
      }
      const dailyStatus = guidanceItems.some(item => item.severity === "high" || item.severity === "emergency")
        ? "needs_check_in"
        : (guidanceItems.some(item => item.severity === "watch") ? "watch" : "stable");
      const dailyGuidance = (await query(
        `INSERT INTO guru_daily_guidance (
           resident_id, guidance_date, daily_status, health_risk, environmental_risk,
           mobility_risk, isolation_risk, medication_risk, safety_risk, guidance_items, summary, calculated_from
         ) VALUES ($1,current_date,$2,$3,$4,$5,$6,'low','low',$7,$8,$9)
         ON CONFLICT (resident_id, guidance_date) DO UPDATE SET
           daily_status = EXCLUDED.daily_status,
           health_risk = EXCLUDED.health_risk,
           environmental_risk = EXCLUDED.environmental_risk,
           mobility_risk = EXCLUDED.mobility_risk,
           isolation_risk = EXCLUDED.isolation_risk,
           guidance_items = EXCLUDED.guidance_items,
           summary = EXCLUDED.summary,
           calculated_from = EXCLUDED.calculated_from,
           updated_at = now()
         RETURNING *`,
        [
          resident.id,
          dailyStatus,
          guidanceItems.some(item => item.domain === "health" && item.severity === "watch") ? "watch" : "low",
          guidanceItems.some(item => item.domain === "environment" || item.domain === "transportation") ? "watch" : "low",
          guidanceItems.some(item => item.domain === "mobility") ? "watch" : "low",
          socialSnapshot?.isolation_risk || "low",
          JSON.stringify(guidanceItems),
          guidanceItems[0]?.title || "Context updated",
          JSON.stringify({ environmentObservationId: environmentObservation?.id, mobilitySnapshotId: mobilitySnapshot?.id, socialSnapshotId: socialSnapshot?.id, locationPointId: locationPoint?.id })
        ]
      )).rows[0];
      await audit(req, user, "resident_context_observation_recorded", "resident_context", resident.id, { guidanceItems: guidanceItems.length, dailyStatus }, dailyStatus === "stable" ? "info" : "warning");
      return { environmentObservation, mobilitySnapshot, socialSnapshot, locationPoint, dailyGuidance };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/risk-recalculate") {
      requireRole(user, ["senior", "superadmin"]);
      const resident = user.role === "senior"
        ? await getResidentForUser(user)
        : (await query(`SELECT * FROM residents WHERE id = $1`, [required(payload.seniorId, "seniorId")])).rows[0];
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      return calculateAndPersistGuruRisk(req, user, resident);
    }

    if (req.method === "GET" && url.pathname === "/api/guru/daily-status") {
      requireRole(user, ["senior", "trusted_person", "superadmin"]);
      const resident = user.role === "senior"
        ? await getResidentForUser(user)
        : await healthResidentAccess(user, url.searchParams.get("seniorId"), "summary");
      const existing = (await query(`SELECT * FROM guru_risk_scores WHERE senior_id = $1 ORDER BY score_date DESC, updated_at DESC LIMIT 1`, [resident.id])).rows[0];
      const result = existing ? { riskScore: existing, recommendations: existing.recommendations || [], explanation: existing.explanation || {} } : await calculateAndPersistGuruRisk(req, user, resident);
      const riskScore = result.riskScore;
      return {
        status: riskScore.final_status,
        confidence: Math.max(50, Math.min(96, 100 - Math.round(Math.max(
          riskScore.health_risk_score,
          riskScore.mobility_risk_score,
          riskScore.medication_risk_score,
          riskScore.social_risk_score,
          riskScore.environmental_risk_score,
          riskScore.safety_risk_score
        ) / 4))),
        summary: result.recommendations[0]?.why || "Guru reviewed health, location, environment, mobility, social, medication, and safety signals.",
        recommendations: result.recommendations,
        riskScore
      };
    }

    const guruSummaryMatch = url.pathname.match(/^\/api\/guru\/(health|social|environment|mobility|safety)-summary$/);
    if (req.method === "GET" && guruSummaryMatch) {
      requireRole(user, ["senior", "trusted_person", "superadmin"]);
      const resident = user.role === "senior"
        ? await getResidentForUser(user)
        : await healthResidentAccess(user, url.searchParams.get("seniorId"), guruSummaryMatch[1] === "health" ? "summary" : "alerts");
      const context = await latestGuruIntelligenceContext(resident);
      const latest = context.latestScore || (await calculateAndPersistGuruRisk(req, user, resident)).riskScore;
      const recommendations = (latest.recommendations || []).filter(item => {
        if (guruSummaryMatch[1] === "environment") return ["environment", "transportation"].includes(item.domain);
        if (guruSummaryMatch[1] === "safety") return ["safety", "transportation"].includes(item.domain);
        return item.domain === guruSummaryMatch[1];
      });
      const domain = guruSummaryMatch[1];
      const summaries = {
        health: context.health
          ? `Sleep ${context.health.sleep_minutes || "unknown"} minutes, resting HR ${context.health.resting_heart_rate || context.health.heart_rate_avg || "unknown"}, oxygen ${context.health.oxygen_saturation || "unknown"}.`
          : "No health metric was recorded for today yet.",
        social: context.social
          ? `${context.social.family_interactions || 0} family interactions, ${context.social.events_attended || 0} events, ${context.social.days_without_family_contact ?? "unknown"} days without family contact.`
          : "No social metric was recorded for today yet.",
        environment: context.environment
          ? `AQI ${context.environment.aqi ?? "unknown"}, pollen ${context.environment.pollen_level ?? "unknown"}, snow risk ${context.environment.snow_risk ?? "unknown"}.`
          : "No environmental metric was recorded for today yet.",
        mobility: context.mobility || context.location
          ? `Steps are ${context.mobility?.steps_today ?? "unknown"} with ${context.location?.out_of_zone_minutes || 0} minutes outside safe zones.`
          : "No mobility or location metric was recorded for today yet.",
        safety: context.safetyEvents.length
          ? `${context.safetyEvents.length} active safety event(s) need review.`
          : "No active safety event is open."
      };
      const riskField = {
        health: "health_risk_score",
        social: "social_risk_score",
        environment: "environmental_risk_score",
        mobility: "mobility_risk_score",
        safety: "safety_risk_score"
      }[domain];
      return {
        domain,
        status: latest.final_status,
        riskScore: latest[riskField],
        summary: summaries[domain],
        recommendations: recommendations.length ? recommendations : [{
          domain,
          severity: "info",
          title: `${domain[0].toUpperCase()}${domain.slice(1)} stable`,
          body: "No urgent action is recommended from this signal right now.",
          why: "Current score is below the watch threshold."
        }]
      };
    }

    if (req.method === "POST" && url.pathname === "/api/safety/phone-analytics") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident || !resident.live_tracking_enabled) {
        const error = new Error("Live tracking is not enabled for this resident");
        error.status = 403;
        throw error;
      }
      const safeZoneEvaluation = await evaluateResidentSafeZone(resident.id, payload.location || {}, payload.safeZoneStatus || null);
      const telemetry = (await query(
        `INSERT INTO safety_telemetry (
          resident_id, lat, lng, accuracy_meters, location_label, movement_status, steps_last_hour,
          still_minutes, last_known_speed_mph, phone_battery, fall_confidence, impact_detected, safe_zone_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          resident.id,
          payload.location?.lat || null,
          payload.location?.lng || null,
          payload.location?.accuracyMeters || null,
          payload.location?.label || null,
          payload.movementStatus || null,
          payload.stepsLastHour || null,
          payload.stillMinutes || null,
          payload.lastKnownSpeedMph || null,
          payload.phoneBattery || null,
          payload.fallConfidence || 0,
          Boolean(payload.impactDetected),
          safeZoneEvaluation.status
        ]
      )).rows[0];
      const events = [];
      const risk = healthRiskContext(resident.health_profile);
      if (payload.impactDetected && Number(payload.fallConfidence || 0) >= risk.fallThreshold) {
        events.push(["fall-detected", "critical", `Likely fall detected with ${Math.round(Number(payload.fallConfidence) * 100)}% confidence. Health profile notes: ${risk.fallContext || "fall-risk support should be reviewed"}.`]);
      }
      if (safeZoneEvaluation.status === "outside") {
        const distanceText = safeZoneEvaluation.distanceMeters !== null ? ` Nearest zone is ${safeZoneEvaluation.distanceMeters}m away.` : "";
        const zoneText = safeZoneEvaluation.zone?.name ? ` (${safeZoneEvaluation.zone.name})` : "";
        events.push(["safe-zone-exit", risk.wanderingSensitive ? "critical" : "high", `Resident appears outside the approved safe zone${zoneText}.${distanceText}${risk.wanderingSensitive ? ` Memory profile guidance: ${risk.memoryContext || "use calm redirection and notify trusted circle"}.` : ""}`]);
      }
      if (Number(payload.stillMinutes || 0) >= risk.stillnessThreshold) {
        events.push(["unusual-stillness", "high", `Phone analytics show ${payload.stillMinutes} minutes of unusual stillness. Mobility profile threshold is ${risk.stillnessThreshold} minutes.`]);
      }
      const createdEvents = [];
      for (const [eventType, severity, body] of events) {
        const notified = (await query(
          `SELECT trusted_user_id FROM trusted_connections
           WHERE resident_id = $1 AND status = 'approved' AND ('sos' = ANY(permissions) OR 'safety' = ANY(permissions))`,
          [resident.id]
        )).rows.map(row => row.trusted_user_id);
        const event = (await query(
          `INSERT INTO safety_events (resident_id, telemetry_id, event_type, severity, body, notified_user_ids)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [resident.id, telemetry.id, eventType, severity, body, notified]
        )).rows[0];
        createdEvents.push(event);
        for (const userId of notified) {
          await query(
            `INSERT INTO notifications (user_id, event_id, channel, title, body)
             VALUES ($1, $2, 'push', 'TheSeniorguru safety alert', $3)`,
            [userId, event.id, body]
          );
        }
      }
      await enqueueJob("telemetry", "telemetry_ingest", {
        source: "safety_phone_analytics",
        residentId: resident.id,
        telemetryId: telemetry.id,
        eventIds: createdEvents.map(event => event.id),
        safeZoneStatus: safeZoneEvaluation.status
      });
      await audit(req, user, "safety_telemetry_ingested", "resident", resident.id, { telemetryId: telemetry.id, eventCount: createdEvents.length, safeZone: safeZoneEvaluation }, createdEvents.length ? "critical" : "info");
      return { telemetry, safeZone: safeZoneEvaluation, events: createdEvents };
    }



    if (req.method === "GET" && url.pathname === "/api/guru/daily-journey") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const medications = (await query(`SELECT * FROM medications WHERE resident_id = $1 ORDER BY time_label NULLS LAST, created_at DESC LIMIT 12`, [resident?.id || null])).rows;
      const journey = {
        resident: resident?.name || user.display_name,
        sections: [
          { period: "Morning", priority: "medication", title: medications[0]?.name || "Morning medication", subtitle: medications[0]?.time_label || "8:00 AM", action: "confirm_medication" },
          { period: "Afternoon", priority: "support", title: "Ask Guru for help", subtitle: "Ride, food, cleaning, diapers, medication, or companionship", action: "open_guru" },
          { period: "Evening", priority: "connection", title: "Family check-in", subtitle: "Call trusted circle", action: "open_circle" },
          { period: "Today", priority: "safety", title: "Safety check", subtitle: "SOS, wearable, and safe-zone monitoring", action: "open_safety" }
        ],
        generatedAt: new Date().toISOString()
      };
      await query(
        `INSERT INTO guru_daily_plans (resident_id, plan, generated_by) VALUES ($1,$2,'guru')
         ON CONFLICT (resident_id, plan_date) DO UPDATE SET plan = EXCLUDED.plan, created_at = now()
         RETURNING *`,
        [resident?.id || null, JSON.stringify(journey)]
      );
      await audit(req, user, "guru_daily_journey_generated", "resident", resident?.id || null, {}, "info");
      return journey;
    }

    if (req.method === "POST" && url.pathname === "/api/guru/orchestrate") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const message = String(payload.message || "").trim();
      if (!message) {
        const error = new Error("Message is required");
        error.status = 400;
        throw error;
      }
      const memories = (await query(`SELECT * FROM guru_memories WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 20`, [resident?.id || null])).rows;
      const medications = (await query(`SELECT * FROM medications WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 20`, [resident?.id || null])).rows;
      const resolvedIntent = resolveGuruIntent(message, { medications, memories });
      let ai = { provider: "local", configured: false, text: null };
      try {
        ai = await callOpenAI({
          system: buildSeniorGuruSystemPrompt({ resident, medications, memories }),
          messages: [{ role: "user", content: message }]
        });
      } catch (error) {
        ai = { provider: "local", configured: false, text: null, error: error.message };
      }
      let task = null;
      if (resolvedIntent.intent === "task") {
        task = (await query(
          `INSERT INTO guru_tasks (resident_id, title, status, source, metadata) VALUES ($1,$2,'open','guru_orchestrator',$3) RETURNING *`,
          [resident?.id || null, resolvedIntent.taskTitle, JSON.stringify({ screen: payload.screen || null })]
        )).rows[0];
      }
      const event = (await query(
        `INSERT INTO guru_ai_sessions (resident_id, intent, user_message, assistant_reply, provider, model, safety_level, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [resident?.id || null, resolvedIntent.intent, message, ai.text || resolvedIntent.reply, ai.provider, process.env.OPENAI_MODEL || null, resolvedIntent.intent === "safety" ? "elevated" : "normal", JSON.stringify({ navigateTo: resolvedIntent.navigateTo, screen: payload.screen || null })]
      )).rows[0];
      await audit(req, user, "guru_orchestrated", "resident", resident?.id || null, { intent: resolvedIntent.intent, provider: ai.provider }, resolvedIntent.intent === "safety" ? "security" : "info");
      return { reply: event.assistant_reply, intent: resolvedIntent.intent, navigateTo: resolvedIntent.navigateTo, task, event, aiConfigured: ai.configured };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/voice-session") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const session = (await query(
        `INSERT INTO guru_voice_sessions (resident_id, status, provider, expires_at, metadata) VALUES ($1,$2,'openai_realtime', now() + interval '5 minutes', $3) RETURNING *`,
        [resident?.id || null, process.env.OPENAI_API_KEY ? "server_ready" : "needs_openai_key", JSON.stringify({ source: payload.source || "mobile" })]
      )).rows[0];
      await audit(req, user, "guru_voice_session_created", "resident", resident?.id || null, { status: session.status }, "info");
      return { session };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/chat") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const message = String(payload.message || "").trim();
      const resolvedIntent = resolveGuruIntent(message);
      let intent = resolvedIntent.intent;
      let navigateTo = resolvedIntent.navigateTo;
      let reply = resolvedIntent.reply;
      let task = null;
      if (intent === "task") {
        task = (await query(
          `INSERT INTO guru_tasks (resident_id, title, status, source, metadata) VALUES ($1,$2,'open','guru',$3) RETURNING *`,
          [resident?.id || null, resolvedIntent.taskTitle, JSON.stringify({ screen: payload.screen || null })]
        )).rows[0];
      }

      const event = (await query(
        `INSERT INTO guru_conversations (resident_id, message, reply, intent, navigate_to, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [resident?.id || null, message, reply, intent, navigateTo, JSON.stringify({ screen: payload.screen || null })]
      )).rows[0];
      await audit(req, user, "guru_chat", "resident", resident?.id || null, { intent, navigateTo }, "info");
      return { reply, intent, navigateTo, task, event };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/tasks") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const title = String(payload.title || "").trim();
      if (!title) {
        const error = new Error("Task title is required");
        error.status = 400;
        throw error;
      }
      const task = (await query(
        `INSERT INTO guru_tasks (resident_id, title, status, source, metadata) VALUES ($1,$2,'open',$3,$4) RETURNING *`,
        [resident?.id || null, title, payload.source || "mobile", JSON.stringify(payload.metadata || {})]
      )).rows[0];
      await audit(req, user, "guru_task_created", "resident", resident?.id || null, { taskId: task.id }, "info");
      return { task };
    }

    if (req.method === "POST" && url.pathname === "/api/posts") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const body = String(payload.body || "").trim();
      if (!body) {
        const error = new Error("Post body is required");
        error.status = 400;
        throw error;
      }
      const post = (await query(
        `INSERT INTO community_posts (resident_id, author_user_id, body, audience, status, metadata)
         VALUES ($1,$2,$3,$4,'published',$5) RETURNING *`,
        [resident?.id || null, user.id, body, payload.audience || "community", JSON.stringify(payload.metadata || {})]
      )).rows[0];
      await audit(req, user, "community_post_created", "community_post", post.id, { audience: post.audience }, "info");
      return { ok: true, post };
    }

    if (req.method === "POST" && url.pathname === "/api/events/join") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident) {
        const error = new Error("Resident profile not found");
        error.status = 404;
        throw error;
      }
      const eventId = String(payload.id || "").trim();
      if (!eventId) {
        const error = new Error("Event id is required");
        error.status = 400;
        throw error;
      }
      const rsvp = (await query(
        `INSERT INTO community_event_rsvps (event_id, resident_id, user_id, status, metadata, updated_at)
         VALUES ($1,$2,$3,'interested',$4,now())
         ON CONFLICT (event_id, user_id) DO UPDATE SET status = 'interested', metadata = EXCLUDED.metadata, updated_at = now()
         RETURNING *`,
        [eventId, resident.id, user.id, JSON.stringify({ name: payload.name || eventId, source: "mobile" })]
      )).rows[0];
      const job = await enqueueJob("notifications", "notification_delivery", {
        source: "community_event_rsvp",
        eventId,
        rsvpId: rsvp.id,
        residentId: resident.id,
        userId: user.id
      });
      await audit(req, user, "community_event_rsvp_saved", "community_event_rsvp", rsvp.id, { eventId }, "info");
      return { ok: true, rsvp, job };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/scan-intents") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const type = String(payload.type || "product");
      const label = String(payload.label || `${type} scan`);
      const intent = (await query(
        `INSERT INTO guru_scan_intents (resident_id, scan_type, label, status, vision_result) VALUES ($1,$2,$3,'created',$4) RETURNING *`,
        [resident?.id || null, type, label, JSON.stringify({ source: payload.source || "mobile" })]
      )).rows[0];
      await audit(req, user, "guru_scan_intent_created", "resident", resident?.id || null, { scanIntentId: intent.id, type }, "info");
      return { intent };
    }


    if (req.method === "GET" && url.pathname === "/api/guru/scans") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const scans = await query(`SELECT * FROM guru_scans WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 50`, [resident?.id || null]);
      return { scans: scans.rows };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/scans") {
      requireRole(user, ["senior"]);
      const resident = (await query(`SELECT * FROM residents WHERE user_id = $1 LIMIT 1`, [user.id])).rows[0];
      const type = String(payload.type || "product");
      const label = String(payload.label || `${type} scan`);
      const title = type === "medicine" ? "Medicine scan prepared" : type === "document" ? "Document scan prepared" : type === "qr" ? "QR scan prepared" : type === "ar" ? "AR helper scene prepared" : "Product scan prepared";
      const warnings = type === "medicine" ? ["Confirm medication details with the label, pharmacy, or clinician before taking or changing any dose."] : type === "qr" ? ["Only open links you trust. Guru should warn before opening unknown QR destinations."] : [];
      const recommendedActions = type === "medicine"
        ? ["Extract medication label", "Add to medication list", "Request refill help", "Ask trusted circle to verify label"]
        : type === "document"
          ? ["Summarize document", "Create reminder", "Send to trusted circle", "Call listed phone number"]
          : type === "ar"
            ? ["Identify object", "Show next step", "Read label aloud", "Ask family for help"]
            : ["Identify product", "Check allergens", "Find reorder option", "Add to essentials list"];
      const summary = type === "medicine"
        ? "Guru captured the medication image and prepared a senior-safe review flow for name, dose, refill, pharmacy, and warning checks."
        : type === "document"
          ? "Guru saved the document image and prepared OCR-style extraction for dates, phone numbers, appointment details, bills, and action items."
          : type === "qr"
            ? "Guru captured the QR image and is ready to resolve event links, menu links, appointment pages, or product support links."
            : type === "ar"
              ? "Guru captured the scene and prepared step-by-step object guidance for medication cabinets, appliances, labels, and household tasks."
              : "Guru captured the product image and prepared a product lookup flow for label reading, allergies, expiry, reorder options, and safer alternatives.";
      const analysis = {
        id: `analysis_${Date.now()}`,
        type,
        title,
        summary,
        confidence: payload.uri ? 0.76 : 0.54,
        warnings,
        recommendedActions,
        extracted: {
          imageUri: payload.uri || null,
          fileName: payload.fileName || null,
          width: payload.width || null,
          height: payload.height || null,
          source: payload.source || "mobile"
        }
      };
      const category = type === "medicine" ? "Medicine Delivery" : type === "document" ? "Community Support" : type === "product" ? "Essentials" : "Transportation";
      const matchRows = await query(
        `SELECT s.id, s.name, s.category, s.price_label, b.name AS provider
         FROM services s JOIN businesses b ON b.id = s.business_id
         WHERE s.status = 'approved' AND (s.category = $1 OR $1 = 'Community Support')
         ORDER BY s.updated_at DESC LIMIT 3`,
        [category]
      );
      const matches = matchRows.rows.map((service, index) => ({ ...service, score: 90 - index * 4, reason: service.category === category ? "Matched to scan category" : "Useful support option based on scan" }));
      const scan = (await query(
        `INSERT INTO guru_scans (resident_id, scan_type, label, source, image_uri, file_name, width, height, analysis, matches, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'analyzed') RETURNING *`,
        [resident?.id || null, type, label, payload.source || "mobile", payload.uri || null, payload.fileName || null, payload.width || null, payload.height || null, JSON.stringify(analysis), JSON.stringify(matches)]
      )).rows[0];
      await query(
        `INSERT INTO guru_conversations (resident_id, message, reply, intent, navigate_to, metadata) VALUES ($1,$2,$3,'scan',NULL,$4)`,
        [resident?.id || null, `${label} captured`, `${analysis.title}: ${analysis.summary}`, JSON.stringify({ scanId: scan.id, type })]
      );
      await audit(req, user, "guru_scan_analyzed", "resident", resident?.id || null, { scanId: scan.id, type, matchCount: matches.length }, "info");
      return { scan, analysis, matches };
    }

    if (req.method === "POST" && url.pathname === "/api/guru/scan-matches") {
      requireRole(user, ["senior"]);
      const type = String(payload.type || "product");
      const category = type === "medicine" ? "Medicine Delivery" : type === "product" ? "Essentials" : "Transportation";
      const rows = await query(
        `SELECT s.id, s.name, s.category, s.price_label, b.name AS provider
         FROM services s JOIN businesses b ON b.id = s.business_id
         WHERE s.status = 'approved' AND s.category = $1
         ORDER BY s.updated_at DESC LIMIT 5`,
        [category]
      );
      return { type, matches: rows.rows };
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/approvals") {
      requireRole(user, ["superadmin"]);
      const businesses = await query(`SELECT * FROM businesses WHERE status = 'pending_review' ORDER BY updated_at DESC`);
      const services = await query(`SELECT * FROM services WHERE status = 'pending_review' ORDER BY updated_at DESC`);
      await audit(req, user, "superadmin_approvals_viewed", "approval_queue", null);
      return { businesses: businesses.rows, services: services.rows };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/superadmin/businesses/")) {
      requireRole(user, ["superadmin"]);
      const id = url.pathname.split("/").at(-2);
      const action = url.pathname.split("/").at(-1);
      const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "suspend" ? "suspended" : null;
      if (!status) {
        const error = new Error("Invalid approval action");
        error.status = 400;
        throw error;
      }
      const business = (await query(`UPDATE businesses SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`, [status, id])).rows[0];
      if (!business) {
        const error = new Error("Business approval record not found");
        error.status = 404;
        throw error;
      }
      if (status === "approved") {
        await ensureDefaultSubscription(id);
      }
      await query(`INSERT INTO business_approvals (business_id, reviewed_by, status, notes) VALUES ($1, $2, $3, $4)`, [id, user.id, status, payload.notes || null]);
      await audit(req, user, `business_${status}`, "business", id, payload, status === "suspended" ? "security" : "info");
      return { ok: true, status, business };
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/superadmin/services/")) {
      requireRole(user, ["superadmin"]);
      const id = url.pathname.split("/").at(-2);
      const action = url.pathname.split("/").at(-1);
      const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
      if (!status) {
        const error = new Error("Invalid service approval action");
        error.status = 400;
        throw error;
      }
      const existing = (await query(
        `SELECT s.*, b.status AS business_status
         FROM services s
         JOIN businesses b ON b.id = s.business_id
         WHERE s.id = $1`,
        [id]
      )).rows[0];
      if (!existing) {
        const error = new Error("Service approval record not found");
        error.status = 404;
        throw error;
      }
      if (status === "approved" && existing.business_status !== "approved") {
        const error = new Error("Business must be approved before service approval");
        error.status = 403;
        throw error;
      }
      const service = (await query(`UPDATE services SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`, [status, id])).rows[0];
      await audit(req, user, `service_${status}`, "service", id, payload);
      return { ok: true, status, service };
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/audit-logs") {
      requireRole(user, ["superadmin"]);
      const logs = await query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200`);
      return { logs: logs.rows };
    }

    const error = new Error("Not found");
    error.status = 404;
    throw error;
  }

  return { route };
}

module.exports = { createProductionApi, hashToken };
