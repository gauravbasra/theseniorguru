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
  delivery?: {
    eligibleCreatives: number;
    suppressedCreatives: number;
    frequencyCap: {
      maxImpressions: number;
      windowHours: number;
    };
  };
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

export type AdEventRecordResult = {
  recorded: boolean;
  duplicate: boolean;
  eventType: "impression" | "click";
  placementKey: string;
  requestId?: string;
  recordedAt?: string;
  suppressed?: boolean;
  suppressionReason?: string;
};

export type AdCampaignReportingInput = {
  placementKey?: string;
  providerId?: string;
  from?: string;
  to?: string;
};

export type AdCampaignReportingPlacement = {
  placementKey: string;
  surface: AdPlacementRecord["surface"];
  activeCreatives: number;
  impressions: number;
  clicks: number;
  ctr: number;
  lastActivityAt?: string;
};

export type AdCampaignReportingSummary = {
  generatedAt: string;
  filters: AdCampaignReportingInput;
  totals: {
    placements: number;
    activeCreatives: number;
    impressions: number;
    clicks: number;
    ctr: number;
  };
  placements: AdCampaignReportingPlacement[];
  nextActions: string[];
};

export type ProviderAdCampaignDashboard = AdCampaignReportingSummary & {
  providerId: string;
  providerName?: string;
  status: "active" | "needs_creative" | "needs_distribution" | "needs_measurement";
  health: {
    hasActiveCreatives: boolean;
    hasTrackedTraffic: boolean;
    activePlacements: number;
    averageCtr: number;
  };
  recommendations: string[];
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

export type GoogleAdManagerSyncMode = "preview" | "manual_export" | "google_ad_manager";

export type GoogleAdManagerSyncInput = {
  mode?: GoogleAdManagerSyncMode;
  placementKeys?: string[];
  dryRun?: boolean;
  actorId?: string;
};

export type GoogleAdManagerUnit = {
  placementKey: string;
  surface: AdPlacementRecord["surface"];
  status: "ready" | "blocked";
  adUnitCode: string;
  disclosureLabel: string;
  activeCreatives: number;
  payload: Record<string, unknown>;
  blockers: string[];
};

export type GoogleAdManagerSyncResult = {
  generatedAt: string;
  dryRun: boolean;
  mode: GoogleAdManagerSyncMode;
  status: "preview" | "manual_export_ready" | "blocked" | "synced";
  googleBackfillConfigured: boolean;
  totals: {
    placementsReviewed: number;
    readyUnits: number;
    blockedUnits: number;
  };
  units: GoogleAdManagerUnit[];
  blockers: string[];
  nextActions: string[];
};
