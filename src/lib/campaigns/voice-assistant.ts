import { recordAuditEvent } from "@/lib/audit-events";
import { checkProviderFeature } from "@/lib/billing/entitlements";
import type {
  VoiceAssistantCampaignRecord,
  VoiceAssistantChannelReadiness,
  VoiceAssistantPreviewInput,
  VoiceAssistantPreviewResult,
  VoiceAssistantProvider,
  VoiceAssistantReadiness,
  VoiceAssistantStatus
} from "@/lib/domain/campaigns";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localVoiceCampaigns: VoiceAssistantCampaignRecord[] = [];

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapVoiceCampaign(row: Record<string, unknown>): VoiceAssistantCampaignRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    assistantName: String(row.assistant_name),
    status: row.status as VoiceAssistantStatus,
    deliveryProvider: row.delivery_provider as VoiceAssistantProvider,
    phoneNumber: row.phone_number ? String(row.phone_number) : undefined,
    transferNumber: row.transfer_number ? String(row.transfer_number) : undefined,
    greeting: String(row.greeting),
    missedCallPolicy: row.missed_call_policy as VoiceAssistantPreviewInput["missedCallPolicy"],
    readinessPayload: mapJson(row.readiness_payload),
    createdAt: String(row.created_at)
  };
}

function isVoiceProvider(value?: string): value is VoiceAssistantProvider {
  return value === "manual_export" || value === "internal_notification_queue" || value === "twilio" || value === "retell" || value === "elevenlabs";
}

function normalizeVoiceProvider(value?: string): VoiceAssistantProvider {
  return isVoiceProvider(value) ? value : "manual_export";
}

function redactConfigured(value?: string) {
  return Boolean(value && value.trim().length > 0);
}

function readinessForChannel(provider: VoiceAssistantProvider, blockers: string[], evidence: Record<string, unknown>): VoiceAssistantChannelReadiness {
  return {
    provider,
    status: blockers.length ? "blocked" : "ready",
    blockers,
    evidence
  };
}

function buildChannelReadiness(entitlementAllowed: boolean): VoiceAssistantChannelReadiness[] {
  const entitlementBlockers = entitlementAllowed ? [] : ["AI voice requires an active provider growth subscription entitlement."];
  const twilioConfigured =
    redactConfigured(process.env.TWILIO_ACCOUNT_SID) &&
    redactConfigured(process.env.TWILIO_AUTH_TOKEN) &&
    redactConfigured(process.env.TWILIO_FROM_NUMBER);
  const retellConfigured = redactConfigured(process.env.RETELL_API_KEY);
  const elevenLabsConfigured = redactConfigured(process.env.ELEVENLABS_API_KEY);

  return [
    readinessForChannel("manual_export", entitlementBlockers, { requiresExternalCredential: false }),
    readinessForChannel("internal_notification_queue", entitlementBlockers, {
      requiresExternalCredential: false,
      queueTarget: "audit_events:voice_assistant_internal_queue"
    }),
    readinessForChannel(
      "twilio",
      [
        ...entitlementBlockers,
        ...(twilioConfigured ? [] : ["Twilio account SID, auth token, and from-number are not configured."])
      ],
      {
        accountSidConfigured: redactConfigured(process.env.TWILIO_ACCOUNT_SID),
        authTokenConfigured: redactConfigured(process.env.TWILIO_AUTH_TOKEN),
        fromNumberConfigured: redactConfigured(process.env.TWILIO_FROM_NUMBER)
      }
    ),
    readinessForChannel(
      "retell",
      [...entitlementBlockers, ...(retellConfigured ? [] : ["Retell API key is not configured for voice assistant handoff."])],
      { apiKeyConfigured: retellConfigured }
    ),
    readinessForChannel(
      "elevenlabs",
      [
        ...entitlementBlockers,
        ...(elevenLabsConfigured ? [] : ["ElevenLabs API key is not configured for voice generation."]),
        "Telephony bridge is not configured for ElevenLabs voice-only output."
      ],
      { apiKeyConfigured: elevenLabsConfigured, telephonyBridgeConfigured: false }
    )
  ];
}

export async function getVoiceAssistantReadiness(providerId?: string): Promise<VoiceAssistantReadiness> {
  const provider = providerId ? await getProviderById(providerId) : null;
  const entitlement = providerId
    ? await checkProviderFeature(providerId, "ai_voice")
    : { featureKey: "ai_voice", allowed: false, reason: "missing_provider" as const };
  const channels = buildChannelReadiness(entitlement.allowed);
  const blockers = channels.flatMap((channel) => channel.blockers.map((blocker) => `${channel.provider}: ${blocker}`));

  return {
    providerId,
    providerName: provider?.name,
    generatedAt: new Date().toISOString(),
    entitlement: {
      featureKey: "ai_voice",
      allowed: entitlement.allowed,
      reason: entitlement.reason
    },
    channels,
    recommendedProvider: channels.find((channel) => channel.status === "ready")?.provider ?? "manual_export",
    blockers,
    nextActions: [
      ...(provider ? [] : ["Select a provider before configuring AI voice handling."]),
      ...(!entitlement.allowed ? ["Activate an AI voice entitlement before live voice handling."] : []),
      "Use manual export or internal queue preview until owner-approved voice credentials are installed.",
      "Confirm call recording consent language, transfer routing, and after-hours escalation before live telephony."
    ]
  };
}

function buildVoiceAssistantPayload(input: {
  providerName?: string;
  normalized: Required<Pick<VoiceAssistantPreviewInput, "providerId" | "assistantName" | "greeting" | "missedCallPolicy">> &
    Pick<VoiceAssistantPreviewInput, "phoneNumber" | "transferNumber">;
  deliveryProvider: VoiceAssistantProvider;
  dryRun: boolean;
  status: VoiceAssistantStatus;
  blockers: string[];
}) {
  return {
    providerId: input.normalized.providerId,
    providerName: input.providerName,
    assistantName: input.normalized.assistantName,
    phoneNumber: input.normalized.phoneNumber,
    transferNumber: input.normalized.transferNumber,
    greeting: input.normalized.greeting,
    missedCallPolicy: input.normalized.missedCallPolicy,
    deliveryProvider: input.deliveryProvider,
    deliveryMode: input.dryRun ? "preview" : input.deliveryProvider,
    status: input.status,
    blockers: input.blockers,
    queueTarget: input.deliveryProvider === "internal_notification_queue" ? "audit_events:voice_assistant_internal_queue" : undefined,
    compliance: {
      callRecordingConsentRequired: true,
      hipaaPhiWarning: "Do not collect medical details or emergency instructions in the AI voice assistant.",
      transferDisclosureRequired: true
    }
  };
}

async function persistVoiceCampaign(record: Omit<VoiceAssistantCampaignRecord, "id" | "createdAt">): Promise<VoiceAssistantCampaignRecord> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const campaign = {
      ...record,
      id: `voice-campaign-${Date.now()}`,
      createdAt: now
    };
    localVoiceCampaigns.unshift(campaign);
    return campaign;
  }

  const { data, error } = await supabase
    .from("voice_campaigns")
    .insert({
      provider_id: record.providerId,
      assistant_name: record.assistantName,
      status: record.status,
      delivery_provider: record.deliveryProvider,
      phone_number: record.phoneNumber,
      transfer_number: record.transferNumber,
      greeting: record.greeting,
      missed_call_policy: record.missedCallPolicy,
      readiness_payload: record.readinessPayload
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Voice assistant campaign creation failed: ${error.message}`);
  }

  return mapVoiceCampaign(data);
}

export async function createVoiceAssistantPreview(input: VoiceAssistantPreviewInput): Promise<VoiceAssistantPreviewResult> {
  if (!input.providerId) {
    throw new Error("providerId is required");
  }

  const provider = await getProviderById(input.providerId);
  if (!provider) {
    throw new Error("Provider not found");
  }

  const deliveryProvider = normalizeVoiceProvider(input.deliveryProvider);
  const dryRun = input.dryRun ?? true;
  const readiness = await getVoiceAssistantReadiness(input.providerId);
  const channel = readiness.channels.find((item) => item.provider === deliveryProvider);
  const normalized = {
    providerId: input.providerId,
    assistantName: input.assistantName ?? `${provider.name} voice assistant`,
    phoneNumber: input.phoneNumber,
    transferNumber: input.transferNumber,
    greeting: input.greeting ?? `Thank you for calling ${provider.name}. I can help capture your question and route urgent requests to the team.`,
    missedCallPolicy: input.missedCallPolicy ?? "capture_callback"
  };

  const policy = await runPolicyCheck({
    subjectType: "voice_assistant",
    subjectId: isUuid(input.providerId) ? input.providerId : undefined,
    actionKey: "configure_ai_voice_assistant",
    input: {
      ...normalized,
      deliveryProvider,
      dryRun
    }
  });
  const policyBlocked = policy.decision === "blocked" || policy.decision === "blocked_non_overridable";
  const hardBlockers = [
    ...(channel?.blockers ?? ["Unsupported voice assistant provider."]),
    ...(policyBlocked ? policy.reasons : [])
  ];
  const blockers = [
    ...hardBlockers,
    ...(deliveryProvider === "manual_export" && !dryRun ? ["Manual export records configuration evidence but does not activate live calls."] : [])
  ];
  const status: VoiceAssistantStatus = hardBlockers.length
    ? dryRun
      ? "preview"
      : "blocked_by_policy"
    : dryRun
      ? "preview"
      : deliveryProvider === "manual_export" || deliveryProvider === "internal_notification_queue"
        ? "queued"
        : "configured";
  const payload = buildVoiceAssistantPayload({
    providerName: provider.name,
    normalized,
    deliveryProvider,
    dryRun,
    status,
    blockers
  });
  const previewCampaign: VoiceAssistantCampaignRecord = {
    id: `voice-preview-${Date.now()}`,
    providerId: normalized.providerId,
    assistantName: normalized.assistantName,
    status,
    deliveryProvider,
    phoneNumber: normalized.phoneNumber,
    transferNumber: normalized.transferNumber,
    greeting: normalized.greeting,
    missedCallPolicy: normalized.missedCallPolicy,
    readinessPayload: payload,
    createdAt: new Date().toISOString()
  };
  const campaign = dryRun
    ? previewCampaign
    : await persistVoiceCampaign({
        providerId: normalized.providerId,
        assistantName: normalized.assistantName,
        status,
        deliveryProvider,
        phoneNumber: normalized.phoneNumber,
        transferNumber: normalized.transferNumber,
        greeting: normalized.greeting,
        missedCallPolicy: normalized.missedCallPolicy,
        readinessPayload: payload
      });

  if (!dryRun) {
    await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "provider" : "system",
      eventType: "voice_assistant.adapter_configured",
      subjectType: "voice_campaign",
      subjectId: campaign.id,
      payload: {
        providerId: input.providerId,
        deliveryProvider,
        status,
        blockers,
        dryRun
      }
    });
  }

  return {
    dryRun,
    status,
    deliveryProvider,
    readiness,
    campaign,
    payload,
    blockers,
    nextActions: [
      ...(blockers.length ? ["Resolve voice assistant blockers before live telephony activation."] : []),
      "Review greeting, missed-call policy, transfer routing, and compliance language before launch.",
      "Record provider approval before publishing phone numbers or connecting external voice providers."
    ]
  };
}
