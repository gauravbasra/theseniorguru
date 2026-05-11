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

export type AdPlacementResponse = {
  placementKey: string;
  disclosureRequired: boolean;
  disclosureLabel: string;
  creatives: AdCreativeRecord[];
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
