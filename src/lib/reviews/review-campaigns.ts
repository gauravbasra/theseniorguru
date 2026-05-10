import type {
  ReviewRequestCampaignInput,
  ReviewRequestCampaignRecord,
  ReviewRequestRecord
} from "@/lib/domain/reviews";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedReviewCampaigns: ReviewRequestCampaignRecord[] = [];
const seedReviewRequests: ReviewRequestRecord[] = [];

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapReviewCampaign(row: Record<string, unknown>): ReviewRequestCampaignRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    name: String(row.name),
    message: row.message ? String(row.message) : undefined,
    channel: String(row.channel),
    status: row.status as ReviewRequestCampaignRecord["status"],
    totalRecipients: Number(row.total_recipients ?? 0),
    queuedRequests: Number(row.queued_requests ?? 0),
    blockedRequests: Number(row.blocked_requests ?? 0),
    policyDecision: String(row.policy_decision ?? "approved"),
    createdAt: String(row.created_at)
  };
}

function mapReviewRequest(row: Record<string, unknown>): ReviewRequestRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
    recipientName: row.recipient_name ? String(row.recipient_name) : undefined,
    recipientEmail: row.recipient_email ? String(row.recipient_email) : undefined,
    channel: String(row.channel),
    status: row.status as ReviewRequestRecord["status"],
    consentPayload: mapJson(row.consent_payload),
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function hasConsent(consentPayload: Record<string, unknown>) {
  return Boolean(consentPayload.consentSource && consentPayload.consentAt);
}

export async function listReviewRequestCampaigns(providerId?: string): Promise<ReviewRequestCampaignRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return providerId
      ? seedReviewCampaigns.filter((campaign) => campaign.providerId === providerId)
      : seedReviewCampaigns;
  }

  let query = supabase.from("review_request_campaigns").select("*").order("created_at", { ascending: false });

  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Review request campaign query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewCampaign);
}

export async function listReviewRequests(providerId?: string): Promise<ReviewRequestRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return providerId ? seedReviewRequests.filter((request) => request.providerId === providerId) : seedReviewRequests;
  }

  let query = supabase.from("review_requests").select("*").order("created_at", { ascending: false });

  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Review request query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewRequest);
}

export async function createReviewRequestCampaign(
  input: ReviewRequestCampaignInput
): Promise<{ campaign: ReviewRequestCampaignRecord; requests: ReviewRequestRecord[] }> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  if (!input.recipients.length) {
    throw new Error("At least one review request recipient is required");
  }

  const missingConsent = input.recipients.filter((recipient) => !hasConsent(recipient.consentPayload));

  if (missingConsent.length) {
    throw new Error("Every review request recipient requires consentSource and consentAt");
  }

  const policy = await runPolicyCheck({
    subjectType: "review_request_campaign",
    subjectId: input.providerId,
    actionKey: "create_review_request_campaign",
    input: {
      providerName: provider.name,
      name: input.name,
      message: input.message,
      channel: input.channel ?? "email",
      recipientCount: input.recipients.length
    }
  });

  const blocked = policy.decision === "blocked" || policy.decision === "blocked_non_overridable";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const campaign: ReviewRequestCampaignRecord = {
      id: `review-campaign-${Date.now()}`,
      providerId: input.providerId,
      name: input.name,
      message: input.message,
      channel: input.channel ?? "email",
      status: blocked ? "blocked_by_policy" : "queued",
      totalRecipients: input.recipients.length,
      queuedRequests: blocked ? 0 : input.recipients.length,
      blockedRequests: blocked ? input.recipients.length : 0,
      policyDecision: policy.decision,
      createdAt: now
    };
    const requests = input.recipients.map((recipient, index) => ({
      id: `review-request-${Date.now()}-${index}`,
      providerId: input.providerId,
      campaignId: campaign.id,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      channel: input.channel ?? "email",
      status: blocked ? ("blocked_by_policy" as const) : ("queued" as const),
      consentPayload: recipient.consentPayload,
      createdAt: now
    }));
    seedReviewCampaigns.unshift(campaign);
    seedReviewRequests.unshift(...requests);
    return { campaign, requests };
  }

  const { data: campaignData, error: campaignError } = await supabase
    .from("review_request_campaigns")
    .insert({
      provider_id: input.providerId,
      name: input.name,
      message: input.message,
      channel: input.channel ?? "email",
      status: blocked ? "blocked_by_policy" : "queued",
      total_recipients: input.recipients.length,
      queued_requests: blocked ? 0 : input.recipients.length,
      blocked_requests: blocked ? input.recipients.length : 0,
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (campaignError) {
    throw new Error(`Review request campaign creation failed: ${campaignError.message}`);
  }

  const campaign = mapReviewCampaign(campaignData);
  const rows = input.recipients.map((recipient) => ({
    provider_id: input.providerId,
    campaign_id: campaign.id,
    recipient_name: recipient.name,
    recipient_email: recipient.email,
    channel: input.channel ?? "email",
    status: blocked ? "blocked_by_policy" : "queued",
    consent_payload: recipient.consentPayload
  }));
  const { data: requestData, error: requestError } = await supabase.from("review_requests").insert(rows).select("*");

  if (requestError) {
    throw new Error(`Review request creation failed: ${requestError.message}`);
  }

  return { campaign, requests: (requestData ?? []).map(mapReviewRequest) };
}
