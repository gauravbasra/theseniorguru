import type {
  CreateProviderOutreachInput,
  ProviderOutreachRecord,
  ProviderOutreachStatus,
  RequeueProviderOutreachInput,
  RequeueProviderOutreachResult,
  SendProviderOutreachInput
} from "@/lib/domain/outreach";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedOutreach: ProviderOutreachRecord[] = [];

function findSeedOutreach(outreachId: string) {
  return seedOutreach.find((item) => item.id === outreachId);
}

function defaultSubject(providerName: string) {
  return `Confirm your free Senior Guru listing for ${providerName}`;
}

function defaultBody(providerName: string) {
  return [
    `We found a public listing for ${providerName} and want to keep it accurate for families.`,
    "Claiming is free. You can update services, contact details, events, and community resources without referral fees."
  ].join("\n\n");
}

function mapProviderOutreach(row: Record<string, unknown>): ProviderOutreachRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    sequenceKey: String(row.sequence_key),
    status: row.status as ProviderOutreachRecord["status"],
    channel: row.channel as ProviderOutreachRecord["channel"],
    recipient: row.recipient ? String(row.recipient) : undefined,
    subject: row.subject ? String(row.subject) : undefined,
    body: row.body ? String(row.body) : undefined,
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listProviderOutreach(status = "queued"): Promise<ProviderOutreachRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return status === "all" ? seedOutreach : seedOutreach.filter((item) => item.status === status);
  }

  let query = supabase.from("provider_outreach_sequences").select("*").order("created_at", { ascending: false }).limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Provider outreach query failed: ${error.message}`);
  }

  return (data ?? []).map(mapProviderOutreach);
}

export async function getProviderOutreach(outreachId: string): Promise<ProviderOutreachRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return findSeedOutreach(outreachId) ?? null;
  }

  const { data, error } = await supabase
    .from("provider_outreach_sequences")
    .select("*")
    .eq("id", outreachId)
    .maybeSingle();

  if (error) {
    throw new Error(`Provider outreach lookup failed: ${error.message}`);
  }

  return data ? mapProviderOutreach(data) : null;
}

export async function createProviderOutreach(input: CreateProviderOutreachInput): Promise<ProviderOutreachRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const subject = input.subject ?? defaultSubject(provider.name);
  const body = input.body ?? defaultBody(provider.name);
  const channel = input.channel ?? "email";

  const policy = await runPolicyCheck({
    subjectType: "provider_outreach",
    subjectId: input.providerId,
    actionKey: "create_provider_claim_outreach",
    input: {
      providerId: input.providerId,
      channel,
      recipient: input.recipient,
      subject,
      body
    }
  });

  const status = policy.decision.startsWith("blocked") ? "blocked" : "queued";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const outreach: ProviderOutreachRecord = {
      id: `pending-outreach-${Date.now()}`,
      providerId: input.providerId,
      sequenceKey: input.sequenceKey ?? "claim_invite_v1",
      status,
      channel,
      recipient: input.recipient,
      subject,
      body,
      scheduledFor: input.scheduledFor,
      createdAt: new Date().toISOString()
    };

    seedOutreach.unshift(outreach);
    return outreach;
  }

  const { data, error } = await supabase
    .from("provider_outreach_sequences")
    .insert({
      provider_id: input.providerId,
      sequence_key: input.sequenceKey ?? "claim_invite_v1",
      status,
      channel,
      recipient: input.recipient,
      subject,
      body,
      scheduled_for: input.scheduledFor
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider outreach creation failed: ${error.message}`);
  }

  return mapProviderOutreach(data);
}

export async function requeueProviderOutreach(
  input: RequeueProviderOutreachInput
): Promise<RequeueProviderOutreachResult> {
  const outreach = await getProviderOutreach(input.outreachId);

  if (!outreach) {
    throw new Error("Provider outreach not found");
  }

  const retryableStatuses: ProviderOutreachStatus[] = ["blocked", "bounced"];

  if (!retryableStatuses.includes(outreach.status)) {
    throw new Error("Only blocked or bounced provider outreach can be requeued");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_outreach",
    subjectId: input.outreachId,
    actionKey: "requeue_provider_claim_outreach",
    input: {
      outreachId: input.outreachId,
      providerId: outreach.providerId,
      previousStatus: outreach.status,
      channel: outreach.channel,
      recipient: outreach.recipient,
      reason: input.reason,
      actorId: input.actorId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider outreach requeue blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const previousStatus = outreach.status;

  if (!supabase) {
    outreach.status = "queued";
    outreach.sentAt = undefined;
    return { outreach, previousStatus, status: "queued" };
  }

  const { data, error } = await supabase
    .from("provider_outreach_sequences")
    .update({ status: "queued", sent_at: null })
    .eq("id", input.outreachId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider outreach requeue failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_outreach.requeued",
    subject_type: "provider_outreach",
    subject_id: input.outreachId,
    payload: {
      providerId: outreach.providerId,
      previousStatus,
      reason: input.reason,
      policyDecision: policy.decision
    }
  });

  return { outreach: mapProviderOutreach(data), previousStatus, status: "queued" };
}

export async function sendProviderOutreach(input: SendProviderOutreachInput): Promise<ProviderOutreachRecord> {
  const policy = await runPolicyCheck({
    subjectType: "provider_outreach",
    subjectId: input.outreachId,
    actionKey: "send_provider_claim_outreach",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider outreach blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const existing = seedOutreach.find((item) => item.id === input.outreachId);
    const outreach: ProviderOutreachRecord = {
      id: input.outreachId,
      providerId: existing?.providerId ?? "fallback-provider",
      sequenceKey: existing?.sequenceKey ?? "claim_invite_v1",
      status: "sent",
      channel: existing?.channel ?? "manual",
      recipient: existing?.recipient,
      subject: existing?.subject,
      body: existing?.body,
      sentAt: now,
      createdAt: existing?.createdAt ?? now
    };

    if (existing) {
      Object.assign(existing, outreach);
    } else {
      seedOutreach.unshift(outreach);
    }

    return outreach;
  }

  const { data, error } = await supabase
    .from("provider_outreach_sequences")
    .update({ status: "sent", sent_at: now })
    .eq("id", input.outreachId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider outreach send update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_outreach.sent",
    subject_type: "provider_outreach",
    subject_id: input.outreachId,
    payload: {
      providerId: data.provider_id,
      deliveryProvider: input.deliveryProvider ?? "pending",
      deliveryId: input.deliveryId,
      policyDecision: policy.decision
    }
  });

  return mapProviderOutreach(data);
}
