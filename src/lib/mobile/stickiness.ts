import type {
  AddCareCircleMemberInput,
  AddComparisonListProviderInput,
  CareCircleMemberRecord,
  CareCircleRecord,
  CareNoteRecord,
  ComparisonListProviderRecord,
  ComparisonListRecord,
  CreateCareCircleInput,
  CreateCareNoteInput,
  CreateComparisonListInput,
  CreateTourPlanInput,
  CareCircleMemberInviteDeliveryResult,
  NotificationPreferencesRecord,
  SavedProviderRecord,
  SaveProviderInput,
  SendCareCircleMemberInviteInput,
  TourPlanRecord,
  UpdateNotificationPreferencesInput
} from "@/lib/domain/mobile";
import { recordAuditEvent } from "@/lib/audit-events";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedSavedProviders: SavedProviderRecord[] = [];
const seedCareCircles: CareCircleRecord[] = [];
const seedCareCircleMembers: CareCircleMemberRecord[] = [];
const seedComparisonLists: ComparisonListRecord[] = [];
const seedComparisonListProviders: ComparisonListProviderRecord[] = [];
const seedCareNotes: CareNoteRecord[] = [];
const seedTourPlans: TourPlanRecord[] = [];
const seedNotificationPreferences = new Map<string, NotificationPreferencesRecord>();

function mapTags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function mapSavedProvider(row: Record<string, unknown>): SavedProviderRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    providerId: String(row.provider_id),
    notes: row.notes ? String(row.notes) : undefined,
    tags: mapTags(row.tags),
    createdAt: String(row.created_at)
  };
}

function mapCareCircle(row: Record<string, unknown>): CareCircleRecord {
  return {
    id: String(row.id),
    ownerUserKey: String(row.owner_user_key),
    name: String(row.name),
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    goals: mapJson(row.goals),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapCareCircleMember(row: Record<string, unknown>): CareCircleMemberRecord {
  return {
    id: String(row.id),
    careCircleId: String(row.care_circle_id),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : undefined,
    role: row.role as CareCircleMemberRecord["role"],
    inviteStatus: row.invite_status as CareCircleMemberRecord["inviteStatus"],
    inviteDeliveryProvider: row.invite_delivery_provider
      ? (String(row.invite_delivery_provider) as CareCircleMemberRecord["inviteDeliveryProvider"])
      : undefined,
    inviteDeliveryStatus: row.invite_delivery_status
      ? (String(row.invite_delivery_status) as CareCircleMemberRecord["inviteDeliveryStatus"])
      : undefined,
    inviteSentAt: row.invite_sent_at ? String(row.invite_sent_at) : undefined,
    inviteDeliveryPayload: mapJson(row.invite_delivery_payload),
    createdAt: String(row.created_at)
  };
}

function mapComparisonList(row: Record<string, unknown>): ComparisonListRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    name: String(row.name),
    providerIds: mapTags(row.provider_ids),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapComparisonListProvider(row: Record<string, unknown>): ComparisonListProviderRecord {
  return {
    id: String(row.id),
    comparisonListId: String(row.comparison_list_id),
    providerId: String(row.provider_id),
    createdAt: String(row.created_at)
  };
}

function mapCareNote(row: Record<string, unknown>): CareNoteRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    careCircleId: row.care_circle_id ? String(row.care_circle_id) : undefined,
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    note: String(row.note),
    visibility: row.visibility === "care_circle" ? "care_circle" : "private",
    tags: mapTags(row.tags),
    createdAt: String(row.created_at)
  };
}

function mapTourPlan(row: Record<string, unknown>): TourPlanRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    providerId: String(row.provider_id),
    careCircleId: row.care_circle_id ? String(row.care_circle_id) : undefined,
    status: row.status as TourPlanRecord["status"],
    preferredDates: mapTags(row.preferred_dates),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapNotificationPreferences(row: Record<string, unknown>): NotificationPreferencesRecord {
  return {
    userKey: String(row.user_key),
    email: Boolean(row.email_enabled),
    sms: Boolean(row.sms_enabled),
    push: Boolean(row.push_enabled),
    quietHours: mapJson(row.quiet_hours) as NotificationPreferencesRecord["quietHours"],
    topics: mapTags(row.topics),
    updatedAt: String(row.updated_at)
  };
}

function defaultNotificationPreferences(userKey: string): NotificationPreferencesRecord {
  return {
    userKey,
    email: true,
    sms: false,
    push: true,
    quietHours: undefined,
    topics: ["saved_providers", "tour_reminders", "community_replies", "local_events"],
    updatedAt: new Date().toISOString()
  };
}

export async function listSavedProviders(userKey: string): Promise<SavedProviderRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedSavedProviders.filter((item) => item.userKey === userKey);
  }

  const { data, error } = await supabase
    .from("saved_providers")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Saved provider query failed: ${error.message}`);
  }

  return (data ?? []).map(mapSavedProvider);
}

export async function saveProvider(input: SaveProviderInput): Promise<SavedProviderRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "saved_provider",
    subjectId: input.providerId,
    actionKey: "save_provider",
    input: {
      userKey: input.userKey,
      providerId: input.providerId,
      notes: input.notes,
      tags: input.tags
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Saved provider blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existing = seedSavedProviders.find((item) => item.userKey === input.userKey && item.providerId === input.providerId);
    const record = {
      id: `pending-saved-provider-${Date.now()}`,
      userKey: input.userKey,
      providerId: input.providerId,
      notes: input.notes,
      tags: input.tags ?? [],
      createdAt: new Date().toISOString()
    };

    if (existing) {
      Object.assign(existing, record, { id: existing.id, createdAt: existing.createdAt });
      return existing;
    }

    seedSavedProviders.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("saved_providers")
    .upsert(
      {
        user_key: input.userKey,
        provider_id: input.providerId,
        notes: input.notes,
        tags: input.tags ?? []
      },
      { onConflict: "user_key,provider_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Saved provider upsert failed: ${error.message}`);
  }

  return mapSavedProvider(data);
}

export async function listCareCircles(userKey: string): Promise<CareCircleRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCareCircles.filter((circle) => circle.ownerUserKey === userKey);
  }

  const { data, error } = await supabase
    .from("care_circles")
    .select("*")
    .eq("owner_user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Care circle query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCareCircle);
}

export async function createCareCircle(input: CreateCareCircleInput): Promise<CareCircleRecord> {
  const policy = await runPolicyCheck({
    subjectType: "care_circle",
    actionKey: "create_care_circle",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care circle blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const record = {
      id: `pending-care-circle-${Date.now()}`,
      ownerUserKey: input.ownerUserKey,
      name: input.name,
      city: input.city,
      state: input.state,
      goals: input.goals ?? {},
      createdAt: now,
      updatedAt: now
    };

    seedCareCircles.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("care_circles")
    .insert({
      owner_user_key: input.ownerUserKey,
      name: input.name,
      city: input.city,
      state: input.state,
      goals: input.goals ?? {}
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care circle creation failed: ${error.message}`);
  }

  return mapCareCircle(data);
}

export async function listCareCircleMembers(careCircleId: string): Promise<CareCircleMemberRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCareCircleMembers.filter((member) => member.careCircleId === careCircleId);
  }

  const { data, error } = await supabase
    .from("care_circle_members")
    .select("*")
    .eq("care_circle_id", careCircleId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Care circle member query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCareCircleMember);
}

export async function addCareCircleMember(input: AddCareCircleMemberInput): Promise<CareCircleMemberRecord> {
  const policy = await runPolicyCheck({
    subjectType: "care_circle_member",
    subjectId: input.careCircleId,
    actionKey: "invite_care_circle_member",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care circle member invite blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const record = {
      id: `pending-care-circle-member-${Date.now()}`,
      careCircleId: input.careCircleId,
      displayName: input.displayName,
      email: input.email,
      role: input.role ?? "family",
      inviteStatus: "pending" as const,
      createdAt: new Date().toISOString()
    };

    seedCareCircleMembers.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("care_circle_members")
    .insert({
      care_circle_id: input.careCircleId,
      display_name: input.displayName,
      email: input.email,
      role: input.role ?? "family"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care circle member invite failed: ${error.message}`);
  }

  return mapCareCircleMember(data);
}

function careCircleInviteActionUrl(member: CareCircleMemberRecord) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/seniors?careCircle=${member.careCircleId}&invite=${member.id}`;
}

function buildCareCircleInvitePayload(member: CareCircleMemberRecord) {
  return {
    subject: "You have been invited to a Senior Guru care circle",
    recipientEmail: member.email,
    memberName: member.displayName,
    role: member.role,
    careCircleId: member.careCircleId,
    actionUrl: careCircleInviteActionUrl(member)
  };
}

async function updateCareCircleMemberInviteDelivery(
  member: CareCircleMemberRecord,
  input: {
    deliveryProvider: CareCircleMemberRecord["inviteDeliveryProvider"];
    deliveryStatus: CareCircleMemberRecord["inviteDeliveryStatus"];
    sentAt?: string;
    payload: Record<string, unknown>;
  }
) {
  const supabase = getSupabaseAdminClient();
  const nextMember = {
    ...member,
    inviteDeliveryProvider: input.deliveryProvider,
    inviteDeliveryStatus: input.deliveryStatus,
    inviteSentAt: input.sentAt,
    inviteDeliveryPayload: input.payload
  };

  if (!supabase) {
    const existing = seedCareCircleMembers.find((item) => item.id === member.id);
    if (existing) {
      Object.assign(existing, nextMember);
    }
    return nextMember;
  }

  const { data, error } = await supabase
    .from("care_circle_members")
    .update({
      invite_delivery_provider: input.deliveryProvider,
      invite_delivery_status: input.deliveryStatus,
      invite_sent_at: input.sentAt,
      invite_delivery_payload: input.payload
    })
    .eq("id", member.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care circle invite delivery update failed: ${error.message}`);
  }

  return mapCareCircleMember(data);
}

export async function sendCareCircleMemberInvite(
  input: SendCareCircleMemberInviteInput
): Promise<CareCircleMemberInviteDeliveryResult> {
  const deliveryProvider = input.deliveryProvider ?? "manual_export";
  const dryRun = input.dryRun ?? true;
  const member = (await listCareCircleMembers(input.careCircleId)).find((item) => item.id === input.memberId);

  if (!member) {
    throw new Error("Care circle member not found");
  }

  const payloadPreview = buildCareCircleInvitePayload(member);
  const policy = await runPolicyCheck({
    subjectType: "care_circle_member",
    subjectId: member.id,
    actionKey: "send_care_circle_member_invite",
    input: {
      careCircleId: input.careCircleId,
      memberId: input.memberId,
      actorUserKey: input.actorUserKey,
      deliveryProvider,
      dryRun,
      recipientEmail: member.email,
      role: member.role
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care circle invite delivery blocked by policy");
  }

  const blockers = [
    ...(!member.email ? ["Member email is required before a care-circle invite can leave manual follow-up."] : [])
  ];
  const status =
    member.inviteStatus !== "pending"
      ? "no_action"
      : blockers.length
        ? "blocked"
        : dryRun
          ? "ready"
          : deliveryProvider === "internal_notification_queue"
            ? "queued"
            : "manual_exported";
  const sentAt = !dryRun && !blockers.length && member.inviteStatus === "pending" ? new Date().toISOString() : undefined;
  const deliveryPayload = {
    ...payloadPreview,
    deliveryProvider,
    status,
    policyDecision: policy.decision
  };
  const nextMember =
    dryRun || status === "blocked" || status === "no_action"
      ? member
      : await updateCareCircleMemberInviteDelivery(member, {
          deliveryProvider,
          deliveryStatus: status,
          sentAt,
          payload: deliveryPayload
        });

  if (!dryRun && status !== "blocked" && status !== "no_action") {
    await recordAuditEvent({
      actorType: "family",
      actorId: input.actorUserKey,
      eventType: "care_circle_member.invite_delivery",
      subjectType: "care_circle_member",
      subjectId: member.id,
      payload: deliveryPayload
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    deliveryProvider,
    status,
    member: nextMember,
    payloadPreview,
    blockers,
    nextActions: [
      ...(status === "ready" ? ["Review the invite preview, then dispatch through manual export or internal notification queue."] : []),
      ...(status === "manual_exported" ? ["Manual care-circle invite evidence was recorded for family follow-up."] : []),
      ...(status === "queued" ? ["Internal notification queue accepted the care-circle invite handoff with audit evidence."] : []),
      ...(status === "blocked" ? blockers : []),
      ...(status === "no_action" ? ["Member invite is no longer pending."] : [])
    ]
  };
}

export async function listComparisonLists(userKey: string): Promise<ComparisonListRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedComparisonLists.filter((list) => list.userKey === userKey);
  }

  const { data, error } = await supabase
    .from("comparison_lists")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Comparison list query failed: ${error.message}`);
  }

  return (data ?? []).map(mapComparisonList);
}

export async function createComparisonList(input: CreateComparisonListInput): Promise<ComparisonListRecord> {
  const providerIds = input.providerIds ?? [];

  await Promise.all(
    providerIds.map(async (providerId) => {
      const provider = await getProviderById(providerId);

      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }
    })
  );

  const policy = await runPolicyCheck({
    subjectType: "comparison_list",
    actionKey: "create_comparison_list",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Comparison list blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const record = {
      id: `pending-comparison-list-${Date.now()}`,
      userKey: input.userKey,
      name: input.name,
      providerIds,
      notes: input.notes,
      createdAt: now,
      updatedAt: now
    };

    seedComparisonLists.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("comparison_lists")
    .insert({
      user_key: input.userKey,
      name: input.name,
      provider_ids: providerIds,
      notes: input.notes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Comparison list creation failed: ${error.message}`);
  }

  return mapComparisonList(data);
}

export async function addComparisonListProvider(
  input: AddComparisonListProviderInput
): Promise<ComparisonListProviderRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "comparison_list_provider",
    subjectId: input.comparisonListId,
    actionKey: "add_comparison_provider",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Comparison provider blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existing = seedComparisonListProviders.find(
      (item) => item.comparisonListId === input.comparisonListId && item.providerId === input.providerId
    );

    if (existing) {
      return existing;
    }

    const record = {
      id: `pending-comparison-list-provider-${Date.now()}`,
      comparisonListId: input.comparisonListId,
      providerId: input.providerId,
      createdAt: new Date().toISOString()
    };

    seedComparisonListProviders.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("comparison_list_providers")
    .upsert(
      {
        comparison_list_id: input.comparisonListId,
        provider_id: input.providerId
      },
      { onConflict: "comparison_list_id,provider_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Comparison provider upsert failed: ${error.message}`);
  }

  return mapComparisonListProvider(data);
}

export async function listCareNotes(userKey: string): Promise<CareNoteRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCareNotes.filter((note) => note.userKey === userKey);
  }

  const { data, error } = await supabase
    .from("care_notes")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Care notes query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCareNote);
}

export async function createCareNote(input: CreateCareNoteInput): Promise<CareNoteRecord> {
  if (input.providerId) {
    const provider = await getProviderById(input.providerId);

    if (!provider) {
      throw new Error("Provider not found");
    }
  }

  const policy = await runPolicyCheck({
    subjectType: "care_note",
    subjectId: input.providerId ?? input.careCircleId,
    actionKey: "create_care_note",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Care note blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const record = {
      id: `pending-care-note-${Date.now()}`,
      userKey: input.userKey,
      careCircleId: input.careCircleId,
      providerId: input.providerId,
      note: input.note,
      visibility: input.visibility ?? "private",
      tags: input.tags ?? [],
      createdAt: now
    };

    seedCareNotes.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("care_notes")
    .insert({
      user_key: input.userKey,
      care_circle_id: input.careCircleId,
      provider_id: input.providerId,
      note: input.note,
      visibility: input.visibility ?? "private",
      tags: input.tags ?? []
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Care note creation failed: ${error.message}`);
  }

  return mapCareNote(data);
}

export async function listTourPlans(userKey: string): Promise<TourPlanRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedTourPlans.filter((plan) => plan.userKey === userKey);
  }

  const { data, error } = await supabase
    .from("tour_plans")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Tour plans query failed: ${error.message}`);
  }

  return (data ?? []).map(mapTourPlan);
}

export async function createTourPlan(input: CreateTourPlanInput): Promise<TourPlanRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "tour_plan",
    subjectId: input.providerId,
    actionKey: "create_tour_plan",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Tour plan blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const record = {
      id: `pending-tour-plan-${Date.now()}`,
      userKey: input.userKey,
      providerId: input.providerId,
      careCircleId: input.careCircleId,
      status: "requested" as const,
      preferredDates: input.preferredDates ?? [],
      notes: input.notes,
      createdAt: now,
      updatedAt: now
    };

    seedTourPlans.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("tour_plans")
    .insert({
      user_key: input.userKey,
      provider_id: input.providerId,
      care_circle_id: input.careCircleId,
      status: "requested",
      preferred_dates: input.preferredDates ?? [],
      notes: input.notes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Tour plan creation failed: ${error.message}`);
  }

  return mapTourPlan(data);
}

export async function getNotificationPreferences(userKey: string): Promise<NotificationPreferencesRecord> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedNotificationPreferences.get(userKey) ?? defaultNotificationPreferences(userKey);
  }

  const { data, error } = await supabase
    .from("app_notification_preferences")
    .select("*")
    .eq("user_key", userKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Notification preferences query failed: ${error.message}`);
  }

  return data ? mapNotificationPreferences(data) : defaultNotificationPreferences(userKey);
}

export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput
): Promise<NotificationPreferencesRecord> {
  const existing = await getNotificationPreferences(input.userKey);
  const next: NotificationPreferencesRecord = {
    ...existing,
    email: input.email ?? existing.email,
    sms: input.sms ?? existing.sms,
    push: input.push ?? existing.push,
    quietHours: input.quietHours ?? existing.quietHours,
    topics: input.topics ?? existing.topics,
    updatedAt: new Date().toISOString()
  };

  const policy = await runPolicyCheck({
    subjectType: "notification_preferences",
    subjectId: input.userKey,
    actionKey: "update_notification_preferences",
    input: next
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Notification preferences blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedNotificationPreferences.set(input.userKey, next);
    return next;
  }

  const { data, error } = await supabase
    .from("app_notification_preferences")
    .upsert(
      {
        user_key: input.userKey,
        email_enabled: next.email,
        sms_enabled: next.sms,
        push_enabled: next.push,
        quiet_hours: next.quietHours ?? {},
        topics: next.topics,
        updated_at: next.updatedAt
      },
      { onConflict: "user_key" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Notification preferences upsert failed: ${error.message}`);
  }

  return mapNotificationPreferences(data);
}
