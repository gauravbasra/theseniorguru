import type { EventAnalyticsSummary } from "@/lib/domain/events";
import { listEventPromotions } from "@/lib/events/event-promotions";
import { getEventById, listEventRsvps } from "@/lib/events/events";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function emptyAnalytics(eventId: string): EventAnalyticsSummary {
  return {
    eventId,
    rsvps: {
      total: 0,
      confirmed: 0,
      waitlisted: 0,
      canceled: 0,
      attended: 0,
      noShow: 0
    },
    promotions: {
      total: 0,
      active: 0,
      budgetCents: 0
    },
    ads: {
      impressions: 0,
      clicks: 0,
      clickThroughRate: 0
    },
    generatedAt: new Date().toISOString()
  };
}

export async function getEventAnalytics(eventId: string): Promise<EventAnalyticsSummary> {
  const event = await getEventById(eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const rsvps = await listEventRsvps(event.id);
    const promotions = await listEventPromotions(event.id);

    return {
      ...emptyAnalytics(eventId),
      rsvps: summarizeRsvps(rsvps.map((rsvp) => ({ status: rsvp.status, party_size: rsvp.partySize }))),
      promotions: promotions.reduce(
        (summary, promotion) => {
          summary.total += 1;
          summary.budgetCents += promotion.budgetCents;
          if (promotion.status === "active") summary.active += 1;
          return summary;
        },
        { total: 0, active: 0, budgetCents: 0 }
      )
    };
  }

  const [{ data: rsvps, error: rsvpError }, { data: promotions, error: promotionError }, { data: creatives, error: creativeError }] =
    await Promise.all([
      supabase.from("event_rsvps").select("status,party_size").eq("event_id", event.id),
      supabase.from("event_promotions").select("id,status,budget_cents").eq("event_id", event.id),
      supabase.from("ad_creatives").select("id").contains("creative_payload", { eventId: event.id })
    ]);

  if (rsvpError) {
    throw new Error(`Event RSVP analytics query failed: ${rsvpError.message}`);
  }

  if (promotionError) {
    throw new Error(`Event promotion analytics query failed: ${promotionError.message}`);
  }

  if (creativeError) {
    throw new Error(`Event creative analytics query failed: ${creativeError.message}`);
  }

  const creativeIds = (creatives ?? []).map((creative) => creative.id);
  const [impressionResult, clickResult] =
    creativeIds.length > 0
      ? await Promise.all([
          supabase.from("ad_impressions").select("id", { count: "exact", head: true }).in("ad_creative_id", creativeIds),
          supabase.from("ad_clicks").select("id", { count: "exact", head: true }).in("ad_creative_id", creativeIds)
        ])
      : [{ count: 0, error: null }, { count: 0, error: null }];

  if (impressionResult.error) {
    throw new Error(`Event impression analytics query failed: ${impressionResult.error.message}`);
  }

  if (clickResult.error) {
    throw new Error(`Event click analytics query failed: ${clickResult.error.message}`);
  }

  const rsvpSummary = summarizeRsvps(rsvps ?? []);
  const promotionSummary = (promotions ?? []).reduce(
    (summary, promotion) => {
      summary.total += 1;
      summary.budgetCents += Number(promotion.budget_cents ?? 0);
      if (promotion.status === "active") summary.active += 1;
      return summary;
    },
    { total: 0, active: 0, budgetCents: 0 }
  );
  const impressions = impressionResult.count ?? 0;
  const clicks = clickResult.count ?? 0;

  return {
    eventId: event.id,
    rsvps: rsvpSummary,
    promotions: promotionSummary,
    ads: {
      impressions,
      clicks,
      clickThroughRate: impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0
    },
    generatedAt: new Date().toISOString()
  };
}

function summarizeRsvps(rsvps: Array<{ status: unknown; party_size?: unknown }>) {
  return rsvps.reduce(
    (summary, rsvp) => {
      const partySize = Number(rsvp.party_size ?? 1);
      summary.total += partySize;

      if (rsvp.status === "confirmed") summary.confirmed += partySize;
      if (rsvp.status === "waitlisted") summary.waitlisted += partySize;
      if (rsvp.status === "canceled") summary.canceled += partySize;
      if (rsvp.status === "attended") summary.attended += partySize;
      if (rsvp.status === "no_show") summary.noShow += partySize;

      return summary;
    },
    {
      total: 0,
      confirmed: 0,
      waitlisted: 0,
      canceled: 0,
      attended: 0,
      noShow: 0
    }
  );
}
