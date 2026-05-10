import type {
  ActivateGrowthSubscriptionInput,
  CreateGrowthSubscriptionInput,
  GrowthPlanRecord,
  ProviderFeatureEntitlementRecord,
  ProviderGrowthSubscriptionRecord
} from "@/lib/domain/billing";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedGrowthPlans: GrowthPlanRecord[] = [
  {
    id: "seed-plan-growth-starter",
    planKey: "growth_starter",
    name: "Growth Starter",
    description: "Campaigns, AI social, local SEO briefs, and baseline chat upgrades.",
    monthlyPriceCents: 10000,
    defaultTermMonths: 3,
    featureFlags: ["campaigns", "ai_social", "ai_seo", "enhanced_chat"],
    isActive: true,
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-plan-reputation-plus",
    planKey: "reputation_plus",
    name: "Reputation Plus",
    description: "Review response drafts, review campaign workflows, and reputation monitoring.",
    monthlyPriceCents: 10000,
    defaultTermMonths: 3,
    featureFlags: ["reviews", "review_responses", "review_campaigns"],
    isActive: true,
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-plan-growth-pro",
    planKey: "growth_pro",
    name: "Growth Pro",
    description: "Bundled growth engine with campaigns, SEO, social, reviews, events, and AI assistant features.",
    monthlyPriceCents: 25000,
    defaultTermMonths: 6,
    featureFlags: ["campaigns", "ai_social", "ai_seo", "enhanced_chat", "reviews", "event_promotions", "provider_dashboard"],
    isActive: true,
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

const seedSubscriptions: ProviderGrowthSubscriptionRecord[] = [];
const seedEntitlements: ProviderFeatureEntitlementRecord[] = [
  {
    id: "seed-entitlement-campaigns",
    providerId: "seed-cottages-dayton-place",
    subscriptionId: "seed-growth-pro-subscription",
    featureKey: "campaigns",
    status: "active",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-entitlement-event-promotions",
    providerId: "seed-cottages-dayton-place",
    subscriptionId: "seed-growth-pro-subscription",
    featureKey: "event_promotions",
    status: "active",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-entitlement-ai-seo",
    providerId: "seed-cottages-dayton-place",
    subscriptionId: "seed-growth-pro-subscription",
    featureKey: "ai_seo",
    status: "active",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-entitlement-ai-social",
    providerId: "seed-cottages-dayton-place",
    subscriptionId: "seed-growth-pro-subscription",
    featureKey: "ai_social",
    status: "active",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "seed-entitlement-reviews",
    providerId: "seed-cottages-dayton-place",
    subscriptionId: "seed-growth-pro-subscription",
    featureKey: "reviews",
    status: "active",
    startsAt: "2026-05-10T00:00:00.000Z",
    endsAt: "2026-11-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function mapPlan(row: Record<string, unknown>): GrowthPlanRecord {
  return {
    id: String(row.id),
    planKey: String(row.plan_key),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    monthlyPriceCents: Number(row.monthly_price_cents ?? 0),
    defaultTermMonths: Number(row.default_term_months) as 3 | 6 | 12,
    featureFlags: Array.isArray(row.feature_flags) ? row.feature_flags.map(String) : [],
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at)
  };
}

function mapSubscription(row: Record<string, unknown>): ProviderGrowthSubscriptionRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    growthPlanId: String(row.growth_plan_id),
    status: row.status as ProviderGrowthSubscriptionRecord["status"],
    termMonths: Number(row.term_months) as 3 | 6 | 12,
    monthlyPriceCents: Number(row.monthly_price_cents ?? 0),
    autoRenews: Boolean(row.auto_renews),
    contractPayload:
      row.contract_payload && typeof row.contract_payload === "object" && !Array.isArray(row.contract_payload)
        ? (row.contract_payload as Record<string, unknown>)
        : {},
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
    endsAt: row.ends_at ? String(row.ends_at) : undefined,
    activatedAt: row.activated_at ? String(row.activated_at) : undefined,
    canceledAt: row.canceled_at ? String(row.canceled_at) : undefined,
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mapEntitlement(row: Record<string, unknown>): ProviderFeatureEntitlementRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
    featureKey: String(row.feature_key),
    status: row.status as ProviderFeatureEntitlementRecord["status"],
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
    endsAt: row.ends_at ? String(row.ends_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listGrowthPlans(): Promise<GrowthPlanRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedGrowthPlans;
  }

  const { data, error } = await supabase
    .from("growth_plans")
    .select("*")
    .eq("is_active", true)
    .order("monthly_price_cents", { ascending: true });

  if (error) {
    throw new Error(`Growth plan query failed: ${error.message}`);
  }

  return (data ?? []).map(mapPlan);
}

export async function listProviderGrowthSubscriptions(providerId: string): Promise<ProviderGrowthSubscriptionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedSubscriptions.filter((subscription) => subscription.providerId === providerId);
  }

  const { data, error } = await supabase
    .from("provider_growth_subscriptions")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Provider growth subscription query failed: ${error.message}`);
  }

  return (data ?? []).map(mapSubscription);
}

export async function listProviderFeatureEntitlements(providerId: string): Promise<ProviderFeatureEntitlementRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedEntitlements.filter((entitlement) => entitlement.providerId === providerId);
  }

  const { data, error } = await supabase
    .from("provider_feature_entitlements")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Provider feature entitlement query failed: ${error.message}`);
  }

  return (data ?? []).map(mapEntitlement);
}

export async function createGrowthSubscription(
  input: CreateGrowthSubscriptionInput
): Promise<ProviderGrowthSubscriptionRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const plans = await listGrowthPlans();
  const plan = plans.find((item) => item.id === input.growthPlanId || item.planKey === input.planKey) ?? plans[0];

  if (!plan) {
    throw new Error("Growth plan not found");
  }

  const termMonths = input.termMonths ?? plan.defaultTermMonths;
  const policy = await runPolicyCheck({
    subjectType: "provider_growth_subscription",
    subjectId: input.providerId,
    actionKey: "create_provider_growth_subscription",
    input: {
      providerId: input.providerId,
      planKey: plan.planKey,
      termMonths,
      autoRenews: input.autoRenews ?? true,
      contractPayload: input.contractPayload
    }
  });
  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "pending_contract";
  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-growth-subscription-${Date.now()}`,
      providerId: input.providerId,
      growthPlanId: plan.id,
      status,
      termMonths,
      monthlyPriceCents: plan.monthlyPriceCents,
      autoRenews: input.autoRenews ?? true,
      contractPayload: input.contractPayload ?? {},
      createdAt: now,
      updatedAt: now
    };
  }

  const { data, error } = await supabase
    .from("provider_growth_subscriptions")
    .insert({
      provider_id: input.providerId,
      growth_plan_id: plan.id,
      status,
      term_months: termMonths,
      monthly_price_cents: plan.monthlyPriceCents,
      auto_renews: input.autoRenews ?? true,
      contract_payload: {
        ...(input.contractPayload ?? {}),
        planKey: plan.planKey,
        featureFlags: plan.featureFlags
      }
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Growth subscription creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "provider" : "system",
    event_type: "provider_growth_subscription.created",
    subject_type: "provider_growth_subscription",
    subject_id: data.id,
    payload: {
      providerId: input.providerId,
      planKey: plan.planKey,
      termMonths,
      monthlyPriceCents: plan.monthlyPriceCents,
      policyDecision: policy.decision
    }
  });

  return mapSubscription(data);
}

export async function activateGrowthSubscription(
  input: ActivateGrowthSubscriptionInput
): Promise<ProviderGrowthSubscriptionRecord> {
  const policy = await runPolicyCheck({
    subjectType: "provider_growth_subscription",
    subjectId: input.subscriptionId,
    actionKey: "activate_provider_growth_subscription",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Growth subscription activation blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: input.subscriptionId,
      providerId: "fallback-provider",
      growthPlanId: "fallback-plan",
      status: "active",
      termMonths: 3,
      monthlyPriceCents: 10000,
      autoRenews: true,
      contractPayload: {},
      startsAt: startsAt.toISOString(),
      endsAt: addMonths(startsAt, 3).toISOString(),
      activatedAt: now,
      createdAt: now,
      updatedAt: now
    };
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("provider_growth_subscriptions")
    .select("*, growth_plans(feature_flags, plan_key)")
    .eq("id", input.subscriptionId)
    .single();

  if (subscriptionError) {
    throw new Error(`Growth subscription lookup failed: ${subscriptionError.message}`);
  }

  const endsAt = addMonths(startsAt, Number(subscription.term_months));
  const { data, error } = await supabase
    .from("provider_growth_subscriptions")
    .update({
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      activated_at: now,
      updated_at: now
    })
    .eq("id", input.subscriptionId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Growth subscription activation failed: ${error.message}`);
  }

  const planData = Array.isArray(subscription.growth_plans) ? subscription.growth_plans[0] : subscription.growth_plans;
  const featureFlags: string[] = Array.isArray(planData?.feature_flags) ? planData.feature_flags.map(String) : [];

  if (featureFlags.length > 0) {
    const { error: entitlementError } = await supabase.from("provider_feature_entitlements").upsert(
      featureFlags.map((featureKey) => ({
        provider_id: subscription.provider_id,
        subscription_id: input.subscriptionId,
        feature_key: featureKey,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString()
      })),
      { onConflict: "provider_id,subscription_id,feature_key" }
    );

    if (entitlementError) {
      throw new Error(`Growth entitlement activation failed: ${entitlementError.message}`);
    }
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_growth_subscription.activated",
    subject_type: "provider_growth_subscription",
    subject_id: input.subscriptionId,
    payload: {
      providerId: subscription.provider_id,
      planKey: planData?.plan_key,
      featureFlags,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      policyDecision: policy.decision
    }
  });

  return mapSubscription(data);
}
