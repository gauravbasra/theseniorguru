import type {
  ReviewRequestCampaignInput,
  ReviewRequestCampaignRecord,
  ReviewRequestRecord,
  SendReviewRequestCampaignInput,
  SendReviewRequestCampaignResult
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

function findSeedCampaign(campaignId: string) {
  return seedReviewCampaigns.find((campaign) => campaign.id === campaignId);
}

function campaignRequests(campaignId: string) {
  return seedReviewRequests.filter((request) => request.campaignId === campaignId);
}

function calculateCampaignStatus(requests: ReviewRequestRecord[]) {
  if (requests.some((request) => request.status === "failed" || request.status === "blocked_by_policy")) {
    return "completed_with_errors" as const;
  }

  if (requests.length && requests.every((request) => request.status === "sent")) {
    return "sent" as const;
  }

  return "queued" as const;
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

async function getReviewRequestCampaign(campaignId: string): Promise<ReviewRequestCampaignRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return findSeedCampaign(campaignId) ?? null;
  }

  const { data, error } = await supabase
    .from("review_request_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) {
    throw new Error(`Review request campaign lookup failed: ${error.message}`);
  }

  return data ? mapReviewCampaign(data) : null;
}

async function listCampaignReviewRequests(campaignId: string): Promise<ReviewRequestRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return campaignRequests(campaignId);
  }

  const { data, error } = await supabase
    .from("review_requests")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Review campaign request query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewRequest);
}

async function updateReviewRequestStatus(input: {
  requestId: string;
  status: ReviewRequestRecord["status"];
  sentAt?: string;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const request = seedReviewRequests.find((item) => item.id === input.requestId);

    if (request) {
      request.status = input.status;
      request.sentAt = input.sentAt;
    }

    return;
  }

  const { error } = await supabase
    .from("review_requests")
    .update({
      status: input.status,
      sent_at: input.sentAt ?? null
    })
    .eq("id", input.requestId);

  if (error) {
    throw new Error(`Review request status update failed: ${error.message}`);
  }
}

async function updateReviewRequestCampaignRollup(input: {
  campaignId: string;
  status: ReviewRequestCampaignRecord["status"];
  requests: ReviewRequestRecord[];
}) {
  const queuedRequests = input.requests.filter((request) => request.status === "queued").length;
  const blockedRequests = input.requests.filter((request) => request.status === "blocked_by_policy").length;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const campaign = findSeedCampaign(input.campaignId);

    if (campaign) {
      campaign.status = input.status;
      campaign.queuedRequests = queuedRequests;
      campaign.blockedRequests = blockedRequests;
    }

    return;
  }

  const { error } = await supabase
    .from("review_request_campaigns")
    .update({
      status: input.status,
      queued_requests: queuedRequests,
      blocked_requests: blockedRequests
    })
    .eq("id", input.campaignId);

  if (error) {
    throw new Error(`Review request campaign rollup update failed: ${error.message}`);
  }
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

export async function sendReviewRequestCampaign(
  input: SendReviewRequestCampaignInput
): Promise<SendReviewRequestCampaignResult> {
  const campaign = await getReviewRequestCampaign(input.campaignId);

  if (!campaign) {
    throw new Error("Review request campaign not found");
  }

  if (campaign.status === "blocked_by_policy") {
    throw new Error("Blocked review request campaigns cannot be sent");
  }

  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const dryRun = input.dryRun ?? false;
  const requests = await listCampaignReviewRequests(input.campaignId);
  const queued = requests.filter((request) => request.status === "queued").slice(0, limit);
  const processedRequests: ReviewRequestRecord[] = [];
  const now = new Date().toISOString();

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const request of queued) {
    const policy = await runPolicyCheck({
      subjectType: "review_request",
      subjectId: request.id,
      actionKey: "send_review_request",
      input: {
        campaignId: input.campaignId,
        providerId: request.providerId,
        recipientEmail: request.recipientEmail,
        channel: request.channel,
        consentPayload: request.consentPayload,
        deliveryProvider: input.deliveryProvider ?? "pending"
      }
    });

    const nextRequest = { ...request };

    if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
      blocked += 1;
      nextRequest.status = "blocked_by_policy";
    } else if (request.channel === "email" && !request.recipientEmail) {
      failed += 1;
      nextRequest.status = "failed";
    } else {
      sent += 1;
      nextRequest.status = "sent";
      nextRequest.sentAt = now;
    }

    processedRequests.push(nextRequest);

    if (!dryRun) {
      await updateReviewRequestStatus({
        requestId: request.id,
        status: nextRequest.status,
        sentAt: nextRequest.sentAt
      });
    }
  }

  const updatedRequests = dryRun ? requests : await listCampaignReviewRequests(input.campaignId);
  const rollupRequests = dryRun
    ? requests.map((request) => processedRequests.find((processed) => processed.id === request.id) ?? request)
    : updatedRequests;
  const status = calculateCampaignStatus(rollupRequests);

  if (!dryRun) {
    await updateReviewRequestCampaignRollup({
      campaignId: input.campaignId,
      status,
      requests: rollupRequests
    });

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      await supabase.from("audit_events").insert({
        actor_id: input.actorId,
        actor_type: input.actorId ? "provider" : "system",
        event_type: "review_request_campaign.sent",
        subject_type: "review_request_campaign",
        subject_id: input.campaignId,
        payload: {
          processed: processedRequests.length,
          sent,
          failed,
          blocked,
          deliveryProvider: input.deliveryProvider ?? "pending"
        }
      });
    }
  }

  return {
    campaignId: input.campaignId,
    status,
    processed: processedRequests.length,
    sent,
    failed,
    blocked,
    dryRun,
    requests: processedRequests
  };
}
