const crypto = require("crypto");

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

    if (req.method === "POST" && url.pathname === "/api/auth/dev-session") {
      const email = required(payload.email, "email");
      let user = (await query(`SELECT * FROM users WHERE email = $1`, [email])).rows[0];
      if (!user) {
        const bootstrapUsers = {
          "anita@theseniorguru.local": { role: "senior", name: "Anita Sharma" },
          "rohit@careride.local": { role: "business", name: "Rohit Mehta" },
          "rita@theseniorguru.local": { role: "trusted_person", name: "Rita Sharma" },
          "arjun@theseniorguru.local": { role: "trusted_person", name: "Arjun Sharma" },
          "drmehta@theseniorguru.local": { role: "trusted_person", name: "Dr. Mehta" },
          "sunita@theseniorguru.local": { role: "trusted_person", name: "Sunita Patel" },
          "admin@theseniorguru.local": { role: "superadmin", name: "TheSeniorguru Admin" }
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
          `SELECT u.id, u.display_name AS name, u.role, tc.permissions, tc.status
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
        return { user, resident: residentProfile, people, bookings, services: services.map(service => toServiceState(service, { name: service.provider_name })), medications, refillRequests, circleMessages, circleCallRequests, safety: { latestTelemetry: telemetry, safeZones, sosEvents: safetyEvents }, healthConsent, healthVitals: { readings: healthRows, summary: evaluateHealthVitals(healthRows), latestSummary: evaluateHealthVitals(healthRows.slice(0, 1)) }, wearables: { devices: wearableDevices, readings: wearableRows, latestSummary: evaluateWearables(wearableDevices, wearableRows[0] || {}) } };
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
      return { person: { id: user.id, name: user.display_name, role: "Trusted person", permissions, status: "approved" }, connection };
    }

    if (req.method === "GET" && url.pathname === "/api/circle") {
      requireRole(user, ["trusted_person"]);
      const connection = (await query(
        `SELECT tc.*, r.id AS resident_id, r.community, r.mood, r.health_profile, senior.display_name AS resident_name
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
        person: { id: user.id, name: user.display_name, role: "Trusted person", permissions, status: connection.status },
        resident: { id: connection.resident_id, name: connection.resident_name, community: connection.community, mood: connection.mood },
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
      const channel = ["voice", "video"].includes(payload.channel) ? payload.channel : "voice";
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
        return { ok: true, lead: result.lead, booking: result.booking, fulfillment: selectedFulfillment, pricing };
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
      await audit(req, user, "resident_safe_zone_created", "resident_safe_zone", safeZone.id, { residentId: resident.id, name, radiusMeters }, "info");
      return { safeZone };
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
      await audit(req, user, "safety_telemetry_ingested", "resident", resident.id, { telemetryId: telemetry.id, eventCount: createdEvents.length, safeZone: safeZoneEvaluation }, createdEvents.length ? "critical" : "info");
      return { telemetry, safeZone: safeZoneEvaluation, events: createdEvents };
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
