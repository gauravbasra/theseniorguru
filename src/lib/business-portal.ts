import { queryPostgres } from "@/lib/server/postgres";

const defaultBusinessAccountId = "business-demo-priya-cabs";

type BusinessProfileInput = {
  businessType: string;
  legalName: string;
  dbaName?: string;
  ownerName: string;
  phone: string;
  email: string;
  website?: string;
  businessAddress?: string;
};

type BusinessServiceInput = {
  businessProfileId: string;
  category: string;
  serviceName: string;
  description?: string;
  priceMin?: number;
  priceMax?: number;
  priceUnit?: "fixed" | "hourly" | "per_mile" | "per_visit" | "subscription" | "custom";
};

type BusinessPhotoInput = {
  businessProfileId: string;
  serviceId?: string;
  photoType?: "logo" | "owner" | "team" | "vehicle" | "service" | "license" | "gallery";
  title?: string;
  storageUrl: string;
  altText?: string;
};

type BusinessLeadInput = {
  businessProfileId: string;
  requestType: string;
  requestTitle: string;
  requestDetails?: Record<string, unknown>;
  scheduledFor?: string;
  estimatedValueCents?: number;
};

type LeadStatusInput = {
  leadId: string;
  status: "new" | "viewed" | "quoted" | "accepted" | "declined" | "booked" | "in_progress" | "completed" | "cancelled" | "refunded";
  note?: string;
  actorRole?: "business" | "superadmin" | "system" | "resident" | "trusted_circle";
};

export function businessAccountIdFromRequest(request?: Request) {
  return request?.headers.get("x-business-account-id")?.trim() || defaultBusinessAccountId;
}

export async function upsertBusinessProfile(input: BusinessProfileInput, businessAccountId = defaultBusinessAccountId) {
  const result = await queryPostgres(
    `
      insert into business_onboarding_profiles (
        business_account_id, business_type, legal_name, dba_name, owner_name, phone, email, website,
        business_address, verification_status, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',now())
      on conflict (business_account_id) do update set
        business_type = excluded.business_type,
        legal_name = excluded.legal_name,
        dba_name = excluded.dba_name,
        owner_name = excluded.owner_name,
        phone = excluded.phone,
        email = excluded.email,
        website = excluded.website,
        business_address = excluded.business_address,
        updated_at = now()
      returning *
    `,
    [businessAccountId, input.businessType, input.legalName, input.dbaName || null, input.ownerName, input.phone, input.email, input.website || null, input.businessAddress || null]
  );
  const profile = result.rows[0];

  await ensureDefaultPackage(profile.id);
  await enqueueApproval(profile.id, "business_profile", profile.id, "high", { reason: "business_profile_submitted" });
  await logUsage("business.profile.upserted", "business_portal", "business_profile", profile.id, businessAccountId, "business");

  return profile;
}

export async function ensureDefaultPackage(businessProfileId: string) {
  const result = await queryPostgres(
    `
      insert into business_portal_packages (
        business_profile_id, package_code, status, monthly_price_cents, included_leads_per_period, lead_period, updated_at
      )
      values ($1,'free','active',0,5,'year',now())
      on conflict (business_profile_id) do update set updated_at = now()
      returning *
    `,
    [businessProfileId]
  );

  return result.rows[0];
}

export async function createBusinessService(input: BusinessServiceInput, businessAccountId = defaultBusinessAccountId) {
  await assertOwnsBusinessProfile(input.businessProfileId, businessAccountId);

  const current = await listBusinessServices(input.businessProfileId);
  const pkg = await getBusinessPackage(input.businessProfileId);
  if (pkg?.package_code === "free" && current.length >= 1) {
    throw new Error("Free package allows one service. Upgrade to Growth $100/month to add more services.");
  }

  const result = await queryPostgres(
    `
      insert into business_service_catalog (
        business_profile_id, category, service_name, description, price_min, price_max, price_unit, active
      )
      values ($1,$2,$3,$4,$5,$6,$7,true)
      returning *
    `,
    [input.businessProfileId, input.category, input.serviceName, input.description || null, numberOrNull(input.priceMin), numberOrNull(input.priceMax), input.priceUnit || "fixed"]
  );
  const service = result.rows[0];

  await enqueueApproval(input.businessProfileId, "service", service.id, highRiskService(input.category) ? "high" : "normal", { category: input.category });
  await logUsage("business.service.created", "business_portal", "business_service", service.id, businessAccountId, "business");

  return service;
}

export async function createBusinessPhoto(input: BusinessPhotoInput, businessAccountId = defaultBusinessAccountId) {
  await assertOwnsBusinessProfile(input.businessProfileId, businessAccountId);

  const result = await queryPostgres(
    `
      insert into business_photos (
        business_profile_id, service_id, photo_type, title, storage_url, alt_text, approval_status
      )
      values ($1,$2,$3,$4,$5,$6,'pending')
      returning *
    `,
    [input.businessProfileId, input.serviceId || null, input.photoType || "gallery", input.title || null, input.storageUrl, input.altText || null]
  );
  const photo = result.rows[0];

  await enqueueApproval(input.businessProfileId, "photo", photo.id, "normal", { photoType: input.photoType || "gallery" });
  await logUsage("business.photo.created", "business_portal", "business_photo", photo.id, businessAccountId, "business");

  return photo;
}

export async function createBusinessLead(input: BusinessLeadInput) {
  const estimatedValue = numberOrNull(input.estimatedValueCents) ?? 0;
  const result = await queryPostgres(
    `
      insert into business_leads (
        business_profile_id, request_type, request_title, request_details, scheduled_for, estimated_value_cents,
        platform_fee_cents, margin_cents, status
      )
      values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,'new')
      returning *
    `,
    [
      input.businessProfileId,
      input.requestType,
      input.requestTitle,
      JSON.stringify(input.requestDetails || {}),
      input.scheduledFor || null,
      estimatedValue,
      Math.round(estimatedValue * 0.08),
      Math.round(estimatedValue * 0.2)
    ]
  );
  const lead = result.rows[0];

  await appendLeadStatusEvent(lead.id, null, "new", "system", "Lead assigned to business portal.");
  await logUsage("business.lead.created", "business_portal", "business_lead", lead.id, undefined, "system");

  return lead;
}

export async function updateBusinessLeadStatus(input: LeadStatusInput, businessAccountId = defaultBusinessAccountId) {
  const existing = (await queryPostgres(`select * from business_leads where id = $1`, [input.leadId])).rows[0];
  if (!existing) throw new Error("Lead not found");

  const profile = (await queryPostgres(`select business_account_id from business_onboarding_profiles where id = $1`, [existing.business_profile_id])).rows[0];
  if (input.actorRole !== "superadmin" && profile?.business_account_id !== businessAccountId) {
    throw new Error("Business lead does not belong to this account.");
  }

  const result = await queryPostgres(
    `update business_leads set status = $1, updated_at = now() where id = $2 returning *`,
    [input.status, input.leadId]
  );
  const lead = result.rows[0];

  await appendLeadStatusEvent(input.leadId, existing.status, input.status, input.actorRole || "business", input.note);
  await logUsage("business.lead.status_updated", "business_portal", "business_lead", input.leadId, businessAccountId, input.actorRole || "business");

  return lead;
}

export async function getBusinessPortalDashboard(businessAccountId = defaultBusinessAccountId) {
  const profile = await getBusinessProfileByAccount(businessAccountId);

  if (!profile) {
    return {
      businessAccountId,
      profile: null,
      package: null,
      services: [],
      photos: [],
      leads: [],
      approvals: [],
      analytics: emptyBusinessAnalytics()
    };
  }

  const [pkg, services, photos, leads, approvals] = await Promise.all([
    getBusinessPackage(profile.id),
    listBusinessServices(profile.id),
    listBusinessPhotos(profile.id),
    listBusinessLeads(profile.id),
    listBusinessApprovals(profile.id)
  ]);

  return {
    businessAccountId,
    profile,
    package: pkg,
    services,
    photos,
    leads,
    approvals,
    analytics: businessAnalytics({ services, photos, leads, approvals })
  };
}

export async function getSuperadminBusinessPortalOverview() {
  const [profiles, services, leads, approvals, partners, usage] = await Promise.all([
    queryPostgres(`select * from business_onboarding_profiles order by created_at desc limit 100`),
    queryPostgres(`select * from business_service_catalog order by created_at desc limit 100`),
    queryPostgres(`select * from business_leads order by created_at desc limit 100`),
    queryPostgres(`select * from business_approval_queue order by created_at desc limit 100`),
    queryPostgres(`select * from partner_integrations order by routing_priority asc`),
    queryPostgres(`select * from platform_usage_events order by created_at desc limit 100`)
  ]);

  const profileRows = profiles.rows;
  const serviceRows = services.rows;
  const leadRows = leads.rows;
  const approvalRows = approvals.rows;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      businesses: profileRows.length,
      verifiedBusinesses: profileRows.filter((row) => row.verification_status === "verified").length,
      pendingBusinesses: profileRows.filter((row) => row.verification_status === "pending").length,
      services: serviceRows.length,
      activeServices: serviceRows.filter((row) => row.active).length,
      leads: leadRows.length,
      openLeads: leadRows.filter((row) => ["new", "viewed", "quoted", "accepted", "booked", "in_progress"].includes(row.status)).length,
      pendingApprovals: approvalRows.filter((row) => row.status === "pending").length
    },
    profiles: profileRows,
    services: serviceRows,
    leads: leadRows,
    approvals: approvalRows,
    partners: partners.rows,
    usage: usage.rows
  };
}

async function getBusinessProfileByAccount(businessAccountId: string) {
  return (await queryPostgres(`select * from business_onboarding_profiles where business_account_id = $1 limit 1`, [businessAccountId])).rows[0] ?? null;
}

async function assertOwnsBusinessProfile(businessProfileId: string, businessAccountId: string) {
  const profile = (await queryPostgres(`select id, business_account_id from business_onboarding_profiles where id = $1`, [businessProfileId])).rows[0];
  if (!profile) throw new Error("Business profile not found.");
  if (profile.business_account_id !== businessAccountId) throw new Error("Business profile does not belong to this account.");
}

async function getBusinessPackage(businessProfileId: string) {
  return (await queryPostgres(`select * from business_portal_packages where business_profile_id = $1 limit 1`, [businessProfileId])).rows[0] ?? null;
}

async function listBusinessServices(businessProfileId: string) {
  return (await queryPostgres(`select * from business_service_catalog where business_profile_id = $1 order by created_at desc`, [businessProfileId])).rows;
}

async function listBusinessPhotos(businessProfileId: string) {
  return (await queryPostgres(`select * from business_photos where business_profile_id = $1 order by created_at desc`, [businessProfileId])).rows;
}

async function listBusinessLeads(businessProfileId: string) {
  return (await queryPostgres(`select * from business_leads where business_profile_id = $1 order by created_at desc limit 50`, [businessProfileId])).rows;
}

async function listBusinessApprovals(businessProfileId: string) {
  return (await queryPostgres(`select * from business_approval_queue where business_profile_id = $1 order by created_at desc limit 50`, [businessProfileId])).rows;
}

async function enqueueApproval(businessProfileId: string, subjectType: string, subjectId: string, priority: string, metadata: Record<string, unknown>) {
  await queryPostgres(
    `
      insert into business_approval_queue (business_profile_id, subject_type, subject_id, priority, status, metadata)
      values ($1,$2,$3,$4,'pending',$5::jsonb)
    `,
    [businessProfileId, subjectType, subjectId, priority, JSON.stringify(metadata)]
  );
}

async function appendLeadStatusEvent(leadId: string, oldStatus: string | null, newStatus: string, actorRole: string, note?: string) {
  await queryPostgres(
    `
      insert into business_lead_status_events (lead_id, old_status, new_status, actor_role, note)
      values ($1,$2,$3,$4,$5)
    `,
    [leadId, oldStatus, newStatus, actorRole, note || null]
  );
}

async function logUsage(eventName: string, surface: string, entityType?: string, entityId?: string, actorAccountId?: string, actorRole = "system") {
  await queryPostgres(
    `
      insert into platform_usage_events (actor_account_id, actor_role, event_name, surface, entity_type, entity_id)
      values ($1,$2,$3,$4,$5,$6)
    `,
    [actorAccountId || null, actorRole, eventName, surface, entityType || null, entityId || null]
  );
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function highRiskService(category: string) {
  return ["transportation", "rides", "pharmacy", "medication", "home care", "personal care"].includes(category.toLowerCase());
}

function emptyBusinessAnalytics() {
  return {
    serviceCount: 0,
    approvedPhotoCount: 0,
    openLeadCount: 0,
    completedLeadCount: 0,
    estimatedLeadValueCents: 0,
    pendingApprovalCount: 0,
    conversionRate: 0
  };
}

function businessAnalytics(input: { services: any[]; photos: any[]; leads: any[]; approvals: any[] }) {
  const completed = input.leads.filter((lead) => lead.status === "completed").length;
  const open = input.leads.filter((lead) => ["new", "viewed", "quoted", "accepted", "booked", "in_progress"].includes(lead.status)).length;
  const totalValue = input.leads.reduce((sum, lead) => sum + Number(lead.estimated_value_cents ?? 0), 0);

  return {
    serviceCount: input.services.length,
    approvedPhotoCount: input.photos.filter((photo) => photo.approval_status === "approved").length,
    openLeadCount: open,
    completedLeadCount: completed,
    estimatedLeadValueCents: totalValue,
    pendingApprovalCount: input.approvals.filter((approval) => approval.status === "pending").length,
    conversionRate: input.leads.length ? Math.round((completed / input.leads.length) * 100) : 0
  };
}
