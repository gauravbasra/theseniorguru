export type GrowthSubscriptionStatus =
  | "draft"
  | "pending_contract"
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "blocked_by_policy";

export type GrowthPlanRecord = {
  id: string;
  planKey: string;
  name: string;
  description?: string;
  monthlyPriceCents: number;
  defaultTermMonths: 3 | 6 | 12;
  featureFlags: string[];
  isActive: boolean;
  createdAt: string;
};

export type ProviderGrowthSubscriptionRecord = {
  id: string;
  providerId: string;
  growthPlanId: string;
  status: GrowthSubscriptionStatus;
  termMonths: 3 | 6 | 12;
  monthlyPriceCents: number;
  autoRenews: boolean;
  contractPayload: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
  activatedAt?: string;
  canceledAt?: string;
  policyCheckId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ProviderFeatureEntitlementRecord = {
  id: string;
  providerId: string;
  subscriptionId?: string;
  featureKey: string;
  status: "active" | "paused" | "revoked";
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
};

export type CreateGrowthSubscriptionInput = {
  providerId: string;
  planKey?: string;
  growthPlanId?: string;
  termMonths?: 3 | 6 | 12;
  autoRenews?: boolean;
  contractPayload?: Record<string, unknown>;
  actorId?: string;
};

export type ActivateGrowthSubscriptionInput = {
  subscriptionId: string;
  startsAt?: string;
  actorId?: string;
  dryRun?: boolean;
};

export type ActivateGrowthSubscriptionResult = {
  subscription: ProviderGrowthSubscriptionRecord;
  dryRun: boolean;
  policyDecision: string;
  previousStatus: GrowthSubscriptionStatus;
  nextStatus: GrowthSubscriptionStatus;
  featureFlags: string[];
  startsAt: string;
  endsAt: string;
  auditEventId?: string;
};
