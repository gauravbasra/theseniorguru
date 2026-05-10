import type {
  ActivateEventPromotionInput,
  CreateEventPromotionInput,
  EventPromotionRecord
} from "@/lib/domain/events";
import { requireProviderFeature } from "@/lib/billing/entitlements";
import { getEventById } from "@/lib/events/events";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedPromotions: EventPromotionRecord[] = [];

function mapEventPromotion(row: Record<string, unknown>): EventPromotionRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    status: row.status as EventPromotionRecord["status"],
    placementKey: String(row.placement_key),
    budgetCents: Number(row.budget_cents ?? 0),
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
    endsAt: row.ends_at ? String(row.ends_at) : undefined,
    disclosureLabel: String(row.disclosure_label ?? "Sponsored"),
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listEventPromotions(eventId: string): Promise<EventPromotionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedPromotions.filter((promotion) => promotion.eventId === eventId);
  }

  const { data, error } = await supabase
    .from("event_promotions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Event promotion query failed: ${error.message}`);
  }

  return (data ?? []).map(mapEventPromotion);
}

export async function createEventPromotion(input: CreateEventPromotionInput): Promise<EventPromotionRecord> {
  const event = await getEventById(input.eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.providerId) {
    await requireProviderFeature(event.providerId, "event_promotions");
  }

  const policy = await runPolicyCheck({
    subjectType: "event_promotion",
    subjectId: input.eventId,
    actionKey: "create_sponsored_event_promotion",
    input: {
      eventTitle: event.title,
      placementKey: input.placementKey ?? "events.featured.local",
      budgetCents: input.budgetCents ?? 0,
      disclosureLabel: input.disclosureLabel ?? "Sponsored"
    }
  });

  const status = policy.decision.startsWith("blocked") ? "blocked" : input.activate ? "active" : "pending_policy";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: `pending-event-promotion-${Date.now()}`,
      eventId: input.eventId,
      status,
      placementKey: input.placementKey ?? "events.featured.local",
      budgetCents: input.budgetCents ?? 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      disclosureLabel: input.disclosureLabel ?? "Sponsored",
      createdAt: now
    };
  }

  const { data, error } = await supabase
    .from("event_promotions")
    .insert({
      event_id: input.eventId,
      status,
      placement_key: input.placementKey ?? "events.featured.local",
      budget_cents: input.budgetCents ?? 0,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      disclosure_label: input.disclosureLabel ?? "Sponsored"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Event promotion creation failed: ${error.message}`);
  }

  if (status === "active") {
    await createSponsoredEventCreative({
      promotion: mapEventPromotion(data),
      eventTitle: event.title,
      eventDescription: event.description,
      providerId: event.providerId,
      destinationUrl: event.registrationUrl,
      actorId: input.actorId,
      policyDecision: policy.decision
    });
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "provider" : "system",
    event_type: "event_promotion.created",
    subject_type: "event_promotion",
    subject_id: data.id,
    payload: {
      eventId: input.eventId,
      status,
      policyDecision: policy.decision,
      requiredDisclosures: policy.requiredDisclosures
    }
  });

  return mapEventPromotion(data);
}

export async function activateEventPromotion(input: ActivateEventPromotionInput): Promise<EventPromotionRecord> {
  const policy = await runPolicyCheck({
    subjectType: "event_promotion",
    subjectId: input.promotionId,
    actionKey: "activate_sponsored_event_promotion",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Event promotion blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: input.promotionId,
      eventId: "fallback-event",
      status: "active",
      placementKey: "events.featured.local",
      budgetCents: 0,
      disclosureLabel: "Sponsored",
      createdAt: now
    };
  }

  const { data: promotion, error: promotionError } = await supabase
    .from("event_promotions")
    .select("*")
    .eq("id", input.promotionId)
    .single();

  if (promotionError) {
    throw new Error(`Event promotion lookup failed: ${promotionError.message}`);
  }

  const event = await getEventById(String(promotion.event_id));

  if (!event) {
    throw new Error("Event not found");
  }

  if (event.providerId) {
    await requireProviderFeature(event.providerId, "event_promotions");
  }

  const { data, error } = await supabase
    .from("event_promotions")
    .update({ status: "active" })
    .eq("id", input.promotionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Event promotion activation failed: ${error.message}`);
  }

  await createSponsoredEventCreative({
    promotion: mapEventPromotion(data),
    eventTitle: event.title,
    eventDescription: event.description,
    providerId: event.providerId,
    destinationUrl: event.registrationUrl,
    actorId: input.actorId,
    policyDecision: policy.decision
  });

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "provider" : "system",
    event_type: "event_promotion.activated",
    subject_type: "event_promotion",
    subject_id: input.promotionId,
    payload: {
      eventId: promotion.event_id,
      policyDecision: policy.decision,
      disclosureLabel: data.disclosure_label
    }
  });

  return mapEventPromotion(data);
}

async function createSponsoredEventCreative(input: {
  promotion: EventPromotionRecord;
  eventTitle: string;
  eventDescription?: string;
  providerId?: string;
  destinationUrl?: string;
  actorId?: string;
  policyDecision: string;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { data: placement, error: placementError } = await supabase
    .from("ad_placements")
    .select("id")
    .eq("placement_key", input.promotion.placementKey)
    .single();

  if (placementError) {
    throw new Error(`Event promotion placement lookup failed: ${placementError.message}`);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .insert({
      provider_id: input.providerId,
      name: `Event promotion: ${input.eventTitle}`,
      status: "active",
      starts_at: input.promotion.startsAt,
      ends_at: input.promotion.endsAt,
      budget_cents: input.promotion.budgetCents,
      targeting_rules: {
        source: "event_promotion",
        eventId: input.promotion.eventId,
        promotionId: input.promotion.id
      }
    })
    .select("id")
    .single();

  if (campaignError) {
    throw new Error(`Event promotion ad campaign creation failed: ${campaignError.message}`);
  }

  const { error: creativeError } = await supabase.from("ad_creatives").insert({
    ad_campaign_id: campaign.id,
    placement_id: placement.id,
    headline: input.eventTitle,
    body: input.eventDescription,
    destination_url: input.destinationUrl,
    disclosure_label: input.promotion.disclosureLabel,
    creative_payload: {
      eventId: input.promotion.eventId,
      promotionId: input.promotion.id,
      policyDecision: input.policyDecision,
      actorId: input.actorId
    },
    is_active: true
  });

  if (creativeError) {
    throw new Error(`Event promotion creative creation failed: ${creativeError.message}`);
  }
}
