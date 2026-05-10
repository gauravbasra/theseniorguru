import type {
  FamilyInquiryInput,
  FamilyInquiryRecord,
  FreeListingRequestInput,
  FreeListingRequestRecord,
  OperatorDemoRequestInput,
  OperatorDemoRequestRecord
} from "@/lib/domain/leads";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function hasContact(input: { requesterEmail?: string; requesterPhone?: string; contactEmail?: string; contactPhone?: string }) {
  return Boolean(input.requesterEmail || input.requesterPhone || input.contactEmail || input.contactPhone);
}

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}`;
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
    return {
      id: nowId("family-inquiry"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
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

  return familyFromRow(data);
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
    return {
      id: nowId("operator-demo"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
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

  return demoFromRow(data);
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
    return {
      id: nowId("free-listing"),
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
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

  return freeListingFromRow(data);
}
