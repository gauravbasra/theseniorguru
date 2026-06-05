const crypto = require("crypto");

const FREE_YEARLY_LEADS = 5;
const PAID_MONTHLY_LEADS = 5;
const PAID_PLAN_PRICE_CENTS = 10000;
const STRIPE_API_VERSION = "2026-02-25.clover";

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
      distance: service?.price_label || "",
      status: lead.status,
      provider: business?.name || "",
      serviceId: lead.service_id
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
      provider: business?.name || ""
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
        return {
          user,
          business: toBusinessState(business, subscription),
          services: services.map(service => toServiceState(service, business)),
          requests: requests.map(lead => toLeadState(lead, services.find(service => service.id === lead.service_id), business)),
          bookings: bookings.map(booking => toBookingState(booking, business)),
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
        return { user, resident: residentProfile, people, bookings, services: services.map(service => toServiceState(service, { name: service.provider_name })), medications, safety: { latestTelemetry: telemetry, sosEvents: safetyEvents }, healthConsent, healthVitals: { readings: healthRows, summary: evaluateHealthVitals(healthRows), latestSummary: evaluateHealthVitals(healthRows.slice(0, 1)) }, wearables: { devices: wearableDevices, readings: wearableRows, latestSummary: evaluateWearables(wearableDevices, wearableRows[0] || {}) } };
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
         SET plan = $1,
             current_period_start = CASE WHEN $1 = 'growth_100' THEN date_trunc('month', now()) ELSE date_trunc('year', now()) END,
             current_period_end = CASE WHEN $1 = 'growth_100' THEN date_trunc('month', now()) + interval '1 month' ELSE date_trunc('year', now()) + interval '1 year' END,
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
      const healthRows = permissions.includes("wellness")
        ? (await query(`SELECT * FROM health_vitals WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 24`, [connection.resident_id])).rows
        : [];
      const wearableDevices = permissions.includes("safety")
        ? (await query(`SELECT * FROM wearable_devices WHERE resident_id = $1 ORDER BY updated_at DESC`, [connection.resident_id])).rows
        : [];
      const notifications = (await query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [user.id])).rows;
      return {
        person: { id: user.id, name: user.display_name, role: "Trusted person", permissions, status: connection.status },
        resident: { id: connection.resident_id, name: connection.resident_name, community: connection.community, mood: connection.mood },
        safety: {
          location: telemetry ? { label: connection.community || "Shared location", accuracyMeters: telemetry.accuracy_meters || 18 } : { label: connection.community || "Shared location", accuracyMeters: 18 },
          safeZones: [{ status: telemetry?.safe_zone_status || "inside" }],
          movement: { status: telemetry?.movement_status || "steady", stillMinutes: telemetry?.still_minutes || 0, phoneBattery: telemetry?.phone_battery || 80 },
          fallDetection: { confidence: Number(telemetry?.fall_confidence || 0), status: Number(telemetry?.fall_confidence || 0) > 0.7 ? "watch" : "clear" },
          sosEvents: safetyEvents
        },
        healthVitals: { readings: healthRows, summary: evaluateHealthVitals(healthRows), latestSummary: evaluateHealthVitals(healthRows.slice(0, 1)) },
        wearables: { devices: wearableDevices, readings: [], latestSummary: evaluateWearables(wearableDevices, {}) },
        notifications,
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
      await audit(req, user, "trusted_person_help_message_sent", "notification", notification.id, { resident: connection.resident_name }, "info");
      return { notification };
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
        const result = await transaction(async tx => {
          const lead = (await tx(
            `INSERT INTO leads (resident_id, service_id, business_id, request_type, requested_time, status)
             VALUES ($1,$2,$3,$4,$5,'matched') RETURNING *`,
            [resident.id, service.id, service.business_id, payload.label || service.name, payload.time || null]
          )).rows[0];
          const booking = (await tx(
            `INSERT INTO bookings (lead_id, resident_id, business_id, service_id, label, status)
             VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
            [lead.id, resident.id, service.business_id, service.id, payload.label || service.name]
          )).rows[0];
          return { lead, booking };
        });
        await audit(req, user, "resident_booking_requested", "booking", result.booking.id, { leadId: result.lead.id, serviceId: service.id });
        return { ok: true, lead: result.lead, booking: result.booking };
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

    if (req.method === "POST" && url.pathname === "/api/safety/phone-analytics") {
      requireRole(user, ["senior"]);
      const resident = await getResidentForUser(user);
      if (!resident || !resident.live_tracking_enabled) {
        const error = new Error("Live tracking is not enabled for this resident");
        error.status = 403;
        throw error;
      }
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
          payload.safeZoneStatus || null
        ]
      )).rows[0];
      const events = [];
      const risk = healthRiskContext(resident.health_profile);
      if (payload.impactDetected && Number(payload.fallConfidence || 0) >= risk.fallThreshold) {
        events.push(["fall-detected", "critical", `Likely fall detected with ${Math.round(Number(payload.fallConfidence) * 100)}% confidence. Health profile notes: ${risk.fallContext || "fall-risk support should be reviewed"}.`]);
      }
      if (payload.safeZoneStatus === "outside") {
        events.push(["safe-zone-exit", risk.wanderingSensitive ? "critical" : "high", `Resident appears outside the approved safe zone.${risk.wanderingSensitive ? ` Memory profile guidance: ${risk.memoryContext || "use calm redirection and notify trusted circle"}.` : ""}`]);
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
      await audit(req, user, "safety_telemetry_ingested", "resident", resident.id, { telemetryId: telemetry.id, eventCount: createdEvents.length }, createdEvents.length ? "critical" : "info");
      return { telemetry, events: createdEvents };
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
