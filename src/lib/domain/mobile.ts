export type SavedProviderRecord = {
  id: string;
  userKey: string;
  providerId: string;
  notes?: string;
  tags: string[];
  createdAt: string;
};

export type SaveProviderInput = {
  userKey: string;
  providerId: string;
  notes?: string;
  tags?: string[];
};

export type CareCircleMemberRole = "senior" | "family" | "caregiver" | "advisor" | "provider";

export type CareCircleRecord = {
  id: string;
  ownerUserKey: string;
  name: string;
  city?: string;
  state?: string;
  goals: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type CareCircleMemberRecord = {
  id: string;
  careCircleId: string;
  displayName: string;
  email?: string;
  role: CareCircleMemberRole;
  inviteStatus: "pending" | "accepted" | "declined" | "removed";
  createdAt: string;
};

export type CreateCareCircleInput = {
  ownerUserKey: string;
  name: string;
  city?: string;
  state?: string;
  goals?: Record<string, unknown>;
};

export type AddCareCircleMemberInput = {
  careCircleId: string;
  displayName: string;
  email?: string;
  role?: CareCircleMemberRole;
};

