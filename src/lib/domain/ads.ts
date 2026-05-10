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

