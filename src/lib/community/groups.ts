import type {
  CommunityDigestDeliveryProvider,
  CommunityDigestDeliveryRecord,
  CommunityDigestRunResult,
  CommunityInvitationRecord,
  CommunityGroupRecord,
  CommunityMembershipRecord,
  CommunityTopicSubscriptionRecord,
  CreateCommunityInvitationInput,
  CreateCommunityGroupInput,
  JoinCommunityGroupInput,
  RunCommunityDigestInput,
  SendCommunityInvitationInput,
  SendCommunityInvitationResult,
  UpsertCommunityTopicSubscriptionInput
} from "@/lib/domain/community";
import { recordAuditEvent } from "@/lib/audit-events";
import { filterAppFeedForDigest, getAppFeed } from "@/lib/community/feed";
import { listAppDevices } from "@/lib/mobile/devices";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedGroups: CommunityGroupRecord[] = [
  {
    id: "seed-denver-caregivers",
    name: "Denver Senior Care Circle",
    slug: "denver-senior-care-circle",
    city: "Denver",
    state: "CO",
    description: "A local community for families comparing assisted living, memory care, home care, and senior support services.",
    memberCount: 0,
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];
const seedMemberships: CommunityMembershipRecord[] = [];
const seedInvitations: CommunityInvitationRecord[] = [];
const seedTopicSubscriptions: CommunityTopicSubscriptionRecord[] = [];
const seedDigestDeliveries: CommunityDigestDeliveryRecord[] = [];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function mapGroup(row: Record<string, unknown>, memberCount = 0): CommunityGroupRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    description: row.description ? String(row.description) : undefined,
    memberCount,
    createdAt: String(row.created_at)
  };
}

function mapMembership(row: Record<string, unknown>): CommunityMembershipRecord {
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    userKey: String(row.user_key),
    displayName: row.display_name ? String(row.display_name) : undefined,
    email: row.email ? String(row.email) : undefined,
    role: row.role as CommunityMembershipRecord["role"],
    status: row.status as CommunityMembershipRecord["status"],
    createdAt: String(row.created_at)
  };
}

function mapInvitation(row: Record<string, unknown>): CommunityInvitationRecord {
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    inviterUserKey: String(row.inviter_user_key),
    recipientEmail: String(row.recipient_email),
    recipientName: row.recipient_name ? String(row.recipient_name) : undefined,
    role: row.role as CommunityInvitationRecord["role"],
    status: row.status as CommunityInvitationRecord["status"],
    deliveryChannel: row.delivery_channel as CommunityInvitationRecord["deliveryChannel"],
    deliveryProvider: row.delivery_provider
      ? (String(row.delivery_provider) as CommunityInvitationRecord["deliveryProvider"])
      : undefined,
    deliveryId: row.delivery_id ? String(row.delivery_id) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapTopicSubscription(row: Record<string, unknown>): CommunityTopicSubscriptionRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    topicKey: String(row.topic_key),
    topicLabel: row.topic_label ? String(row.topic_label) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    status: row.status as CommunityTopicSubscriptionRecord["status"],
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function topicScopeKey(input: { city?: string; state?: string }) {
  return [input.city?.trim().toLowerCase() || "*", input.state?.trim().toUpperCase() || "*"].join(":");
}

function parseDigestDeliveryProvider(value?: CommunityDigestDeliveryProvider): CommunityDigestDeliveryProvider {
  return value === "internal_notification_queue" ? value : "manual_export";
}

function mapDigestDelivery(row: Record<string, unknown>): CommunityDigestDeliveryRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    topicKey: row.topic_key ? String(row.topic_key) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    deliveryProvider: row.delivery_provider as CommunityDigestDeliveryProvider,
    deliveryStatus: row.delivery_status as CommunityDigestDeliveryRecord["deliveryStatus"],
    feedItemCount: Number(row.feed_item_count ?? 0),
    recipientDeviceCount: Number(row.recipient_device_count ?? 0),
    deliveryPayload:
      row.delivery_payload && typeof row.delivery_payload === "object"
        ? (row.delivery_payload as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at)
  };
}

export async function listCommunityGroups(filters: { city?: string; state?: string } = {}): Promise<CommunityGroupRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedGroups
      .filter((group) => !filters.city || group.city?.toLowerCase() === filters.city.toLowerCase())
      .filter((group) => !filters.state || group.state?.toLowerCase() === filters.state.toLowerCase())
      .map((group) => ({
        ...group,
        memberCount: seedMemberships.filter((membership) => membership.communityId === group.id && membership.status === "active").length
      }));
  }

  let query = supabase.from("communities").select("*").order("created_at", { ascending: false }).limit(100);

  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.state) query = query.ilike("state", filters.state);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Community group query failed: ${error.message}`);
  }

  const counts = await Promise.all(
    (data ?? []).map(async (community) => {
      const { count } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", community.id)
        .eq("status", "active");
      return [String(community.id), count ?? 0] as const;
    })
  );
  const countMap = new Map(counts);

  return (data ?? []).map((row) => mapGroup(row, countMap.get(String(row.id)) ?? 0));
}

export async function createCommunityGroup(input: CreateCommunityGroupInput): Promise<CommunityGroupRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_group",
    actionKey: "create_community_group",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Community group creation blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const slug = input.slug ?? slugify([input.city, input.state, input.name].filter(Boolean).join(" "));

  if (!supabase) {
    const group: CommunityGroupRecord = {
      id: `community-group-${Date.now()}`,
      name: input.name,
      slug,
      city: input.city,
      state: input.state,
      description: input.description,
      memberCount: 0,
      createdAt: now
    };
    seedGroups.unshift(group);
    return group;
  }

  const { data, error } = await supabase
    .from("communities")
    .insert({
      name: input.name,
      slug,
      city: input.city,
      state: input.state,
      description: input.description
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community group creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "community_group.created",
    subject_type: "community_group",
    subject_id: data.id,
    payload: { policyDecision: policy.decision, slug }
  });

  return mapGroup(data);
}

export async function listCommunityGroupMembers(communityId: string): Promise<CommunityMembershipRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedMemberships.filter((membership) => membership.communityId === communityId);
  }

  const { data, error } = await supabase
    .from("community_memberships")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Community membership query failed: ${error.message}`);
  }

  return (data ?? []).map(mapMembership);
}

export async function joinCommunityGroup(input: JoinCommunityGroupInput): Promise<CommunityMembershipRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_membership",
    subjectId: input.communityId,
    actionKey: "join_community_group",
    input
  });
  const status = policy.decision.startsWith("blocked")
    ? "blocked"
    : policy.decision === "approved"
      ? "active"
      : "pending";
  const role = input.role ?? "family";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const membership: CommunityMembershipRecord = {
      id: `community-membership-${Date.now()}`,
      communityId: input.communityId,
      userKey: input.userKey,
      displayName: input.displayName,
      email: input.email,
      role,
      status,
      createdAt: now
    };
    seedMemberships.unshift(membership);
    return membership;
  }

  const { data, error } = await supabase
    .from("community_memberships")
    .upsert({
      community_id: input.communityId,
      user_key: input.userKey,
      display_name: input.displayName,
      email: input.email,
      role,
      status
    }, { onConflict: "community_id,user_key" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community membership upsert failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "community_membership.upserted",
    subject_type: "community_group",
    subject_id: input.communityId,
    payload: {
      userKey: input.userKey,
      role,
      status,
      policyDecision: policy.decision
    }
  });

  return mapMembership(data);
}

export async function listCommunityInvitations(communityId: string): Promise<CommunityInvitationRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedInvitations.filter((invitation) => invitation.communityId === communityId);
  }

  const { data, error } = await supabase
    .from("community_invitations")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Community invitation query failed: ${error.message}`);
  }

  return (data ?? []).map(mapInvitation);
}

export async function createCommunityInvitation(
  input: CreateCommunityInvitationInput
): Promise<CommunityInvitationRecord> {
  const role = input.role ?? "family";
  const deliveryChannel = input.deliveryChannel ?? "email";
  const policy = await runPolicyCheck({
    subjectType: "community_invitation",
    subjectId: input.communityId,
    actionKey: "create_community_invitation",
    input: {
      ...input,
      role,
      deliveryChannel
    }
  });
  const status: CommunityInvitationRecord["status"] = policy.decision.startsWith("blocked") ? "blocked" : "queued";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const invitation: CommunityInvitationRecord = {
      id: `community-invitation-${Date.now()}`,
      communityId: input.communityId,
      inviterUserKey: input.inviterUserKey,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      role,
      status,
      deliveryChannel,
      deliveryProvider: "pending",
      createdAt: now
    };
    seedInvitations.unshift(invitation);
    return invitation;
  }

  const { data, error } = await supabase
    .from("community_invitations")
    .insert({
      community_id: input.communityId,
      inviter_user_key: input.inviterUserKey,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
      role,
      status,
      delivery_channel: deliveryChannel,
      delivery_provider: "pending",
      delivery_payload: { policyDecision: policy.decision }
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community invitation creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId ?? input.inviterUserKey,
    actor_type: input.actorId ? "admin" : "user",
    event_type: "community_invitation.created",
    subject_type: "community_group",
    subject_id: input.communityId,
    payload: {
      invitationId: data.id,
      recipientEmail: input.recipientEmail,
      role,
      status,
      policyDecision: policy.decision
    }
  });

  return mapInvitation(data);
}

export async function sendCommunityInvitation(
  input: SendCommunityInvitationInput
): Promise<SendCommunityInvitationResult> {
  const supabase = getSupabaseAdminClient();
  const dryRun = input.dryRun !== false;
  const now = new Date().toISOString();

  if (!supabase) {
    const invitation = seedInvitations.find((item) => item.id === input.invitationId);

    if (!invitation) {
      throw new Error("Community invitation not found");
    }

    const previousStatus = invitation.status;
    const policy = await runPolicyCheck({
      subjectType: "community_invitation",
      subjectId: input.invitationId,
      actionKey: "send_community_invitation",
      input: {
        ...input,
        recipientEmail: invitation.recipientEmail,
        communityId: invitation.communityId
      }
    });

    const nextStatus: CommunityInvitationRecord["status"] = policy.decision.startsWith("blocked") ? "blocked" : "sent";
    const previewInvitation: CommunityInvitationRecord = {
      ...invitation,
      status: nextStatus,
      deliveryChannel: input.deliveryChannel ?? invitation.deliveryChannel,
      deliveryProvider: input.deliveryProvider ?? (nextStatus === "sent" ? "manual" : "pending"),
      deliveryId: input.deliveryId,
      sentAt: nextStatus === "sent" ? now : invitation.sentAt
    };

    if (!dryRun) {
      Object.assign(invitation, previewInvitation);
    }

    const auditEvent = await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "admin" : "system",
      eventType: dryRun ? "community_invitation.delivery_previewed" : "community_invitation.delivery_processed",
      subjectType: "community_invitation",
      subjectId: input.invitationId,
      payload: {
        communityId: invitation.communityId,
        deliveryChannel: previewInvitation.deliveryChannel,
        deliveryProvider: previewInvitation.deliveryProvider,
        dryRun,
        previousStatus,
        nextStatus,
        policyDecision: policy.decision
      }
    });

    return {
      invitation: dryRun ? previewInvitation : invitation,
      dryRun,
      policyDecision: policy.decision,
      previousStatus,
      nextStatus,
      auditEventId: auditEvent.id
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("community_invitations")
    .select("*")
    .eq("id", input.invitationId)
    .single();

  if (lookupError) {
    throw new Error(`Community invitation lookup failed: ${lookupError.message}`);
  }

  const previousStatus = existing.status as CommunityInvitationRecord["status"];
  const policy = await runPolicyCheck({
    subjectType: "community_invitation",
    subjectId: input.invitationId,
    actionKey: "send_community_invitation",
    input: {
      ...input,
      recipientEmail: existing.recipient_email,
      communityId: existing.community_id
    }
  });
  const status: CommunityInvitationRecord["status"] = policy.decision.startsWith("blocked") ? "blocked" : "sent";
  let invitation: CommunityInvitationRecord = {
    ...mapInvitation(existing),
    status,
    deliveryChannel: input.deliveryChannel ?? existing.delivery_channel,
    deliveryProvider: input.deliveryProvider ?? (status === "sent" ? "manual" : "pending"),
    deliveryId: input.deliveryId,
    sentAt: status === "sent" ? now : existing.sent_at
  };

  if (!dryRun) {
    const { data, error } = await supabase
      .from("community_invitations")
      .update({
        status,
        delivery_channel: input.deliveryChannel ?? existing.delivery_channel,
        delivery_provider: input.deliveryProvider ?? (status === "sent" ? "manual" : "pending"),
        delivery_id: input.deliveryId,
        delivery_payload: {
          policyDecision: policy.decision,
          messageTemplate: "community_group_invitation"
        },
        sent_at: status === "sent" ? now : existing.sent_at,
        updated_at: now
      })
      .eq("id", input.invitationId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Community invitation delivery update failed: ${error.message}`);
    }

    invitation = mapInvitation(data);
  }

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "admin" : "system",
    eventType: dryRun ? "community_invitation.delivery_previewed" : "community_invitation.delivery_processed",
    subjectType: "community_invitation",
    subjectId: input.invitationId,
    payload: {
      communityId: existing.community_id,
      deliveryChannel: invitation.deliveryChannel,
      deliveryProvider: invitation.deliveryProvider,
      dryRun,
      previousStatus,
      nextStatus: status,
      policyDecision: policy.decision
    }
  });

  return {
    invitation,
    dryRun,
    policyDecision: policy.decision,
    previousStatus,
    nextStatus: status,
    auditEventId: auditEvent.id
  };
}

export async function listCommunityTopicSubscriptions(filters: {
  userKey?: string;
  city?: string;
  state?: string;
  status?: CommunityTopicSubscriptionRecord["status"];
} = {}): Promise<CommunityTopicSubscriptionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedTopicSubscriptions
      .filter((subscription) => !filters.userKey || subscription.userKey === filters.userKey)
      .filter((subscription) => !filters.city || subscription.city?.toLowerCase() === filters.city.toLowerCase())
      .filter((subscription) => !filters.state || subscription.state?.toLowerCase() === filters.state.toLowerCase())
      .filter((subscription) => !filters.status || subscription.status === filters.status);
  }

  let query = supabase
    .from("community_topic_subscriptions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (filters.userKey) query = query.eq("user_key", filters.userKey);
  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.state) query = query.ilike("state", filters.state);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Community topic subscription query failed: ${error.message}`);
  }

  return (data ?? []).map(mapTopicSubscription);
}

export async function upsertCommunityTopicSubscription(
  input: UpsertCommunityTopicSubscriptionInput
): Promise<CommunityTopicSubscriptionRecord> {
  const status = input.status ?? "active";
  const scopeKey = topicScopeKey(input);
  const policy = await runPolicyCheck({
    subjectType: "community_topic_subscription",
    subjectId: input.userKey,
    actionKey: "upsert_community_topic_subscription",
    input: {
      ...input,
      status,
      scopeKey
    }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Community topic subscription blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const existing = seedTopicSubscriptions.find(
      (subscription) =>
        subscription.userKey === input.userKey &&
        subscription.topicKey === input.topicKey &&
        topicScopeKey(subscription) === scopeKey
    );

    if (existing) {
      existing.topicLabel = input.topicLabel ?? existing.topicLabel;
      existing.city = input.city ?? existing.city;
      existing.state = input.state ?? existing.state;
      existing.status = status;
      existing.updatedAt = now;
      return existing;
    }

    const subscription: CommunityTopicSubscriptionRecord = {
      id: `community-topic-subscription-${Date.now()}`,
      userKey: input.userKey,
      topicKey: input.topicKey,
      topicLabel: input.topicLabel,
      city: input.city,
      state: input.state,
      status,
      createdAt: now,
      updatedAt: now
    };
    seedTopicSubscriptions.unshift(subscription);
    return subscription;
  }

  const { data, error } = await supabase
    .from("community_topic_subscriptions")
    .upsert(
      {
        user_key: input.userKey,
        topic_key: input.topicKey,
        topic_label: input.topicLabel,
        city: input.city,
        state: input.state,
        scope_key: scopeKey,
        status,
        updated_at: now
      },
      { onConflict: "user_key,topic_key,scope_key" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community topic subscription upsert failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId ?? input.userKey,
    actor_type: input.actorId ? "admin" : "user",
    event_type: "community_topic_subscription.upserted",
    subject_type: "community_topic_subscription",
    subject_id: data.id,
    payload: {
      topicKey: input.topicKey,
      city: input.city,
      state: input.state,
      status,
      policyDecision: policy.decision
    }
  });

  return mapTopicSubscription(data);
}

export async function runCommunityDigestDelivery(
  input: RunCommunityDigestInput = {}
): Promise<CommunityDigestRunResult> {
  const dryRun = input.dryRun ?? true;
  const deliveryProvider = parseDigestDeliveryProvider(input.deliveryProvider);
  const policy = await runPolicyCheck({
    subjectType: "community_digest_delivery",
    actionKey: "run_community_digest_delivery",
    input: {
      city: input.city,
      state: input.state,
      topicKey: input.topicKey,
      userKey: input.userKey,
      dryRun,
      deliveryProvider
    }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Community digest delivery blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const subscriptions = await listCommunityTopicSubscriptions({
    userKey: input.userKey,
    city: input.city,
    state: input.state,
    status: "active"
  });
  const scopedSubscriptions = subscriptions.filter((subscription) => !input.topicKey || subscription.topicKey === input.topicKey);
  const feedItems = filterAppFeedForDigest(await getAppFeed(), {
    city: input.city,
    state: input.state,
    topicKey: input.topicKey
  });
  const now = new Date().toISOString();
  const deliveries: CommunityDigestDeliveryRecord[] = [];

  for (const subscription of scopedSubscriptions) {
    const devices = await listAppDevices(subscription.userKey);
    const deliveryStatus: CommunityDigestDeliveryRecord["deliveryStatus"] =
      dryRun ? "preview" : deliveryProvider === "internal_notification_queue" && feedItems.length ? "queued" : "skipped";
    const deliveryPayload = {
      policyDecision: policy.decision,
      topicLabel: subscription.topicLabel,
      digestWindow: "daily",
      feedItems: feedItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        href: item.href,
        city: item.city,
        state: item.state,
        sponsored: item.sponsored,
        disclosureLabel: item.disclosureLabel
      })),
      deviceTargets: devices.map((device) => ({
        id: device.id,
        platform: device.platform,
        tokenProvider: device.tokenProvider
      })),
      queueTarget: deliveryProvider === "internal_notification_queue" ? "audit_events:community_digest_delivery_queue" : undefined
    };

    const draft: CommunityDigestDeliveryRecord = {
      id: `community-digest-${Date.now()}-${deliveries.length}`,
      userKey: subscription.userKey,
      topicKey: subscription.topicKey,
      city: subscription.city,
      state: subscription.state,
      deliveryProvider,
      deliveryStatus,
      feedItemCount: feedItems.length,
      recipientDeviceCount: devices.length,
      deliveryPayload,
      createdAt: now
    };

    if (supabase && !dryRun) {
      const { data, error } = await supabase
        .from("community_digest_deliveries")
        .insert({
          user_key: draft.userKey,
          topic_key: draft.topicKey,
          city: draft.city,
          state: draft.state,
          delivery_provider: draft.deliveryProvider,
          delivery_status: draft.deliveryStatus,
          feed_item_count: draft.feedItemCount,
          recipient_device_count: draft.recipientDeviceCount,
          delivery_payload: draft.deliveryPayload
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(`Community digest delivery job creation failed: ${error.message}`);
      }

      deliveries.push(mapDigestDelivery(data));
    } else {
      seedDigestDeliveries.unshift(draft);
      deliveries.push(draft);
    }
  }

  if (!dryRun) {
    await recordAuditEvent({
      actorType: input.actorId ? "admin" : "system",
      actorId: input.actorId,
      eventType: "community_digest.delivery_run",
      subjectType: "community_digest_delivery",
      payload: {
        deliveryProvider,
        filters: {
          city: input.city,
          state: input.state,
          topicKey: input.topicKey,
          userKey: input.userKey
        },
        activeSubscriptions: scopedSubscriptions.length,
        queuedDeliveries: deliveries.filter((delivery) => delivery.deliveryStatus === "queued").length,
        skippedDeliveries: deliveries.filter((delivery) => delivery.deliveryStatus === "skipped").length,
        feedItemCount: feedItems.length,
        policyDecision: policy.decision
      }
    });
  }

  const queuedDeliveries = deliveries.filter((delivery) => delivery.deliveryStatus === "queued").length;
  const skippedDeliveries = deliveries.filter((delivery) => delivery.deliveryStatus === "skipped").length;

  return {
    generatedAt: now,
    dryRun,
    deliveryProvider,
    source: supabase ? "supabase" : "local_fallback",
    filters: {
      city: input.city,
      state: input.state,
      topicKey: input.topicKey,
      userKey: input.userKey
    },
    totals: {
      activeSubscriptions: scopedSubscriptions.length,
      recipientUsers: new Set(scopedSubscriptions.map((subscription) => subscription.userKey)).size,
      feedItems: feedItems.length,
      queuedDeliveries,
      skippedDeliveries
    },
    deliveries,
    nextActions: [
      ...(dryRun ? ["Review digest preview payloads before queueing delivery jobs."] : []),
      ...(!dryRun && queuedDeliveries
        ? ["Internal notification queue accepted community digest jobs with audit evidence."]
        : []),
      ...(!dryRun && skippedDeliveries ? ["Skipped digest jobs need feed content or an internal queue provider selection."] : []),
      ...(!scopedSubscriptions.length ? ["No active topic subscriptions matched the digest filters."] : [])
    ]
  };
}
