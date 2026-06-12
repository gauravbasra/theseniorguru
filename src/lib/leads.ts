import type {
  FamilyInquiryInput,
  FamilyInquiryRecord,
  FreeListingRequestInput,
  FreeListingRequestRecord,
  LeadQueueItem,
  LeadQueueSummary,
  OperatorDemoRequestInput,
  OperatorDemoRequestRecord
} from "@/lib/domain/leads";
import { runPolicyCheck } from "@/lib/policy";
import { sendLeadNotificationEmail } from "@/lib/server/lead-notifications";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function hasContact(input: { requesterEmail?: string; requesterPhone?: string; contactEmail?: string; contactPhone?: string }) {
  return Boolean(input.requesterEmail || input.requesterPhone || input.contactEmail || input.contactPhone);
}

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function notifyNewLead(subject: string, fields: Record<string, string | undefined>) {
  const lines = Object.entries(fields)
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);

  const text = lines.join("\n");
  const html = `<ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>`;

  return sendLeadNotificationEmail({ subject, html, text }).catch((error) => {
    console.error("Failed to send lead notification email", error);
  });
}

const localLeadStore = {
  familyInquiries: [] as FamilyInquiryRecord[],
  operatorDemoRequests: [] as OperatorDemoRequestRecord[],
  freeListingRequests: [] as FreeListingRequestRecord[]
};

function pushNewest<T extends { id: string }>(items: T[], item: T) {
  items.unshift(item);
  items.splice(25);
  return item;
}

function familyFromRow(row: Record<string, unknown>): FamilyInquiryRecord {
  return {
    id: String(row.id),
    requesterName: String(row.requester_name),
    requesterEmail: row.requester_email ? String(row.requester_email) : undefined,
    requesterPhone: row.requester_phone ? String(row.requester_phone) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    careType: row.care_type ? String(row.care_type) : undefined,
    timeline: row.timeline ? String(row.timeline) : undefined,
    budget: row.budget ? String(row.budget) : undefined,
    message: row.message ? String(row.message) : undefined,
    consentToContact: Boolean(row.consent_to_contact),
    status: row.status as FamilyInquiryRecord["status"],
    policyDecision: String(row.policy_decision ?? "approved"),
    createdAt: String(row.created_at)
  };
}

function demoFromRow(row: Record<string, unknown>): OperatorDemoRequestRecord {
  return {
    id: String(row.id),
    contactName: String(row.contact_name),
    contactEmail: row.contact_email ? String(row.contact_email) : undefined,
    contactPhone: row.contact_phone ? String(row.contact_phone) : undefined,
    organizationName: String(row.organization_name),
    role: row.role ? String(row.role) : undefined,
    communityCount: row.community_count ? String(row.community_count) : undefined,
    occupancyChallenge: row.occupancy_challenge ? String(row.occupancy_challenge) : undefined,
    requestedProduct: row.requested_product as OperatorDemoRequestRecord["requestedProduct"],
    consentToContact: Boolean(row.consent_to_contact),
    status: row.status as OperatorDemoRequestRecord["status"],
    policyDecision: String(row.policy_decision ?? "approved"),
    createdAt: String(row.created_at)
  };
}

function freeListingFromRow(row: Record<string, unknown>): FreeListingRequestRecord {
  return {
    id: String(row.id),
    communityName: String(row.community_name),
    contactName: String(row.contact_name),
    contactEmail: row.contact_email ? String(row.contact_email) : undefined,
    contactPhone: row.contact_phone ? String(row.contact_phone) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
    careTypes: Array.isArray(row.care_types) ? row.care_types.map(String) : [],
    message: row.message ? String(row.message) : undefined,
    consentToContact: Boolean(row.consent_to_contact),
    status: row.status as FreeListingRequestRecord["status"],
    policyDecision: String(row.policy_decision ?? "approved"),
    createdAt: String(row.created_at)
  };
}

function toQueueItems({
  familyInquiries,
  operatorDemoRequests,
  freeListingRequests
}: {
  familyInquiries: FamilyInquiryRecord[];
  operatorDemoRequests: OperatorDemoRequestRecord[];
  freeListingRequests: FreeListingRequestRecord[];
}): LeadQueueItem[] {
  return [
    ...familyInquiries.map((item) => ({
      ...item,
      leadType: "family_inquiry" as const,
      displayName: item.requesterName,
      sourceLabel: [item.careType, item.city, item.state].filter(Boolean).join(" · ") || "Family inquiry"
    })),
    ...operatorDemoRequests.map((item) => ({
      ...item,
      leadType: "operator_demo" as const,
      displayName: item.organizationName,
      sourceLabel: [item.requestedProduct?.replaceAll("_", " "), item.communityCount].filter(Boolean).join(" · ") || "Operator demo"
    })),
    ...freeListingRequests.map((item) => ({
      ...item,
      leadType: "free_listing" as const,
      displayName: item.communityName,
      sourceLabel: [item.city, item.state, item.careTypes?.join(", ")].filter(Boolean).join(" · ") || "Free listing"
    }))
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function queueSummary(source: LeadQueueSummary["source"], items: LeadQueueItem[]): LeadQueueSummary {
  return {
    generatedAt: new Date().toISOString(),
    source,
    total: items.length,
    byType: {
      family_inquiry: items.filter((item) => item.leadType === "family_inquiry").length,
      operator_demo: items.filter((item) => item.leadType === "operator_demo").length,
      free_listing: items.filter((item) => item.leadType === "free_listing").length
    },
    items
  };
}

export async function submitFamilyInquiry(input: FamilyInquiryInput): Promise<FamilyInquiryRecord> {
  if (!hasContact(input)) {
    return {
      id: nowId("family-inquiry-contact-needed"),
      ...input,
      status: "needs_contact_info",
      policyDecision: "approved",
      createdAt: new Date().toISOString()
    };
  }

  const policy = await runPolicyCheck({
    subjectType: "family_inquiry",
    actionKey: "submit_family_inquiry",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    return {
      id: nowId("family-inquiry-blocked"),
      ...input,
      status: "blocked_by_policy",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const record = pushNewest(localLeadStore.familyInquiries, {
      id: nowId("family-inquiry"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    });
    await notifyNewLead("New family inquiry", {
      Name: record.requesterName,
      Email: record.requesterEmail,
      Phone: record.requesterPhone,
      City: record.city,
      State: record.state,
      "Care type": record.careType,
      Timeline: record.timeline,
      Budget: record.budget,
      Message: record.message
    });
    return record;
  }

  const { data, error } = await supabase
    .from("family_inquiries")
    .insert({
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      requester_phone: input.requesterPhone,
      city: input.city,
      state: input.state,
      care_type: input.careType,
      timeline: input.timeline,
      budget: input.budget,
      message: input.message,
      consent_to_contact: input.consentToContact,
      status: "submitted",
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Family inquiry submission failed: ${error.message}`);
  }

  const record = familyFromRow(data);
  await notifyNewLead("New family inquiry", {
    Name: record.requesterName,
    Email: record.requesterEmail,
    Phone: record.requesterPhone,
    City: record.city,
    State: record.state,
    "Care type": record.careType,
    Timeline: record.timeline,
    Budget: record.budget,
    Message: record.message
  });
  return record;
}

export async function submitOperatorDemoRequest(
  input: OperatorDemoRequestInput
): Promise<OperatorDemoRequestRecord> {
  if (!hasContact(input)) {
    return {
      id: nowId("operator-demo-contact-needed"),
      ...input,
      status: "needs_contact_info",
      policyDecision: "approved",
      createdAt: new Date().toISOString()
    };
  }

  const policy = await runPolicyCheck({
    subjectType: "operator_demo_request",
    actionKey: "submit_operator_demo_request",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    return {
      id: nowId("operator-demo-blocked"),
      ...input,
      status: "blocked_by_policy",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const record = pushNewest(localLeadStore.operatorDemoRequests, {
      id: nowId("operator-demo"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    });
    await notifyNewLead("New operator demo request", {
      Organization: record.organizationName,
      Contact: record.contactName,
      Email: record.contactEmail,
      Phone: record.contactPhone,
      Role: record.role,
      "Community count": record.communityCount,
      "Occupancy challenge": record.occupancyChallenge,
      "Requested product": record.requestedProduct
    });
    return record;
  }

  const { data, error } = await supabase
    .from("operator_demo_requests")
    .insert({
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      organization_name: input.organizationName,
      role: input.role,
      community_count: input.communityCount,
      occupancy_challenge: input.occupancyChallenge,
      requested_product: input.requestedProduct,
      consent_to_contact: input.consentToContact,
      status: "submitted",
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Operator demo request failed: ${error.message}`);
  }

  const record = demoFromRow(data);
  await notifyNewLead("New operator demo request", {
    Organization: record.organizationName,
    Contact: record.contactName,
    Email: record.contactEmail,
    Phone: record.contactPhone,
    Role: record.role,
    "Community count": record.communityCount,
    "Occupancy challenge": record.occupancyChallenge,
    "Requested product": record.requestedProduct
  });
  return record;
}

export async function submitFreeListingRequest(input: FreeListingRequestInput): Promise<FreeListingRequestRecord> {
  if (!hasContact(input)) {
    return {
      id: nowId("free-listing-contact-needed"),
      ...input,
      status: "needs_contact_info",
      policyDecision: "approved",
      createdAt: new Date().toISOString()
    };
  }

  const policy = await runPolicyCheck({
    subjectType: "free_listing_request",
    actionKey: "submit_free_listing_request",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    return {
      id: nowId("free-listing-blocked"),
      ...input,
      status: "blocked_by_policy",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const record = pushNewest(localLeadStore.freeListingRequests, {
      id: nowId("free-listing"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    });
    await notifyNewLead("New free listing request", {
      "Community name": record.communityName,
      Contact: record.contactName,
      Email: record.contactEmail,
      Phone: record.contactPhone,
      City: record.city,
      State: record.state,
      Website: record.websiteUrl,
      "Care types": record.careTypes?.join(", "),
      Message: record.message
    });
    return record;
  }

  const { data, error } = await supabase
    .from("free_listing_requests")
    .insert({
      community_name: input.communityName,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      city: input.city,
      state: input.state,
      website_url: input.websiteUrl,
      care_types: input.careTypes ?? [],
      message: input.message,
      consent_to_contact: input.consentToContact,
      status: "submitted",
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Free listing request failed: ${error.message}`);
  }

  const record = freeListingFromRow(data);
  await notifyNewLead("New free listing request", {
    "Community name": record.communityName,
    Contact: record.contactName,
    Email: record.contactEmail,
    Phone: record.contactPhone,
    City: record.city,
    State: record.state,
    Website: record.websiteUrl,
    "Care types": record.careTypes?.join(", "),
    Message: record.message
  });
  return record;
}

export async function listLeadQueue(): Promise<LeadQueueSummary> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return queueSummary("local_fallback", toQueueItems(localLeadStore));
  }

  const [family, demos, freeListings] = await Promise.all([
    supabase.from("family_inquiries").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("operator_demo_requests").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("free_listing_requests").select("*").order("created_at", { ascending: false }).limit(50)
  ]);

  const error = family.error ?? demos.error ?? freeListings.error;
  if (error) {
    throw new Error(`Lead queue query failed: ${error.message}`);
  }

  return queueSummary(
    "supabase",
    toQueueItems({
      familyInquiries: (family.data ?? []).map(familyFromRow),
      operatorDemoRequests: (demos.data ?? []).map(demoFromRow),
      freeListingRequests: (freeListings.data ?? []).map(freeListingFromRow)
    })
  );
}

export async function updateLeadStatus(input: {
  leadType: LeadQueueItem["leadType"];
  id: string;
  status: "submitted" | "needs_contact_info" | "blocked_by_policy";
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const bucket =
      input.leadType === "family_inquiry"
        ? localLeadStore.familyInquiries
        : input.leadType === "operator_demo"
          ? localLeadStore.operatorDemoRequests
          : localLeadStore.freeListingRequests;
    const item = bucket.find((lead) => lead.id === input.id);
    if (!item) {
      throw new Error("Lead not found");
    }
    item.status = input.status;
    return item;
  }

  const table =
    input.leadType === "family_inquiry"
      ? "family_inquiries"
      : input.leadType === "operator_demo"
        ? "operator_demo_requests"
        : "free_listing_requests";

  const { data, error } = await supabase.from(table).update({ status: input.status }).eq("id", input.id).select("*").single();

  if (error) {
    throw new Error(`Lead status update failed: ${error.message}`);
  }

  return data;
}
