export type AdCreativeRecord = {
  id: string;
  placementKey: string;
  headline: string;
  body?: string;
  imageUrl?: string;
  destinationUrl?: string;
  disclosureLabel: string;
  payload: Record<string, unknown>;
};

export type AdPlacementRecord = {
  id?: string;
  placementKey: string;
  name: string;
  surface: "web" | "mobile" | "web_mobile" | "unknown";
  description?: string;
  disclosureRequired: boolean;
  disclosureLabel: string;
  isActive: boolean;
  createdAt?: string;
};

export type AdPlacementResponse = {
  placementKey: string;
  disclosureRequired: boolean;
  disclosureLabel: string;
  creatives: AdCreativeRecord[];
};

export type UpsertAdPlacementInput = {
  placementKey: string;
  name: string;
  surface: AdPlacementRecord["surface"];
  description?: string;
  disclosureRequired?: boolean;
  disclosureLabel?: string;
  isActive?: boolean;
  actorId?: string;
};

export type CreateAdCreativeInput = {
  placementKey: string;
  providerId?: string;
  campaignName: string;
  headline: string;
  body?: string;
  imageUrl?: string;
  destinationUrl?: string;
  disclosureLabel?: string;
  budgetCents?: number;
  targetingRules?: Record<string, unknown>;
  creativePayload?: Record<string, unknown>;
  activate?: boolean;
  actorId?: string;
};

export type AdEventInput = {
  placementKey: string;
  adCreativeId?: string;
  requestId?: string;
  destinationUrl?: string;
  userContext?: Record<string, unknown>;
};

export type AdPlacementReadinessItem = {
  placementKey: string;
  surface: "web" | "mobile" | "web_mobile" | "unknown";
  status: "ready" | "empty" | "missing";
  disclosureRequired: boolean;
  disclosureLabel: string;
  activeCreatives: number;
  blockers: string[];
};

export type AdReadinessSummary = {
  generatedAt: string;
  status: "ready" | "direct_sold_ready" | "action_required";
  googleBackfillConfigured: boolean;
  directSoldPlacementsReady: number;
  totalPlacements: number;
  placements: AdPlacementReadinessItem[];
  blockers: string[];
  nextActions: string[];
};
