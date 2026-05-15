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

export type ComparisonListRecord = {
  id: string;
  userKey: string;
  name: string;
  providerIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CreateComparisonListInput = {
  userKey: string;
  name: string;
  providerIds?: string[];
  notes?: string;
};

export type ComparisonListProviderRecord = {
  id: string;
  comparisonListId: string;
  providerId: string;
  createdAt: string;
};

export type AddComparisonListProviderInput = {
  comparisonListId: string;
  providerId: string;
  userKey?: string;
};

export type CareNoteVisibility = "private" | "care_circle";

export type CareNoteRecord = {
  id: string;
  userKey: string;
  careCircleId?: string;
  providerId?: string;
  note: string;
  visibility: CareNoteVisibility;
  tags: string[];
  createdAt: string;
};

export type CreateCareNoteInput = {
  userKey: string;
  careCircleId?: string;
  providerId?: string;
  note: string;
  visibility?: CareNoteVisibility;
  tags?: string[];
};

export type TourPlanStatus = "planned" | "requested" | "scheduled" | "completed" | "canceled";

export type TourPlanRecord = {
  id: string;
  userKey: string;
  providerId: string;
  careCircleId?: string;
  status: TourPlanStatus;
  preferredDates: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CreateTourPlanInput = {
  userKey: string;
  providerId: string;
  careCircleId?: string;
  preferredDates?: string[];
  notes?: string;
};

export type NotificationQuietHours = {
  start: string;
  end: string;
};

export type NotificationPreferencesRecord = {
  userKey: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  quietHours?: NotificationQuietHours;
  topics: string[];
  updatedAt: string;
};

export type UpdateNotificationPreferencesInput = {
  userKey: string;
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  quietHours?: NotificationQuietHours;
  topics?: string[];
};

export type AppDevicePlatform = "ios" | "android" | "web";

export type AppDeviceRegistrationRecord = {
  id: string;
  userKey: string;
  platform: AppDevicePlatform;
  deviceId?: string;
  pushToken: string;
  tokenProvider: "apns" | "fcm" | "web_push" | "expo";
  appVersion?: string;
  locale?: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt?: string;
};

export type RegisterAppDeviceInput = {
  userKey: string;
  platform: AppDevicePlatform;
  deviceId?: string;
  pushToken: string;
  tokenProvider?: AppDeviceRegistrationRecord["tokenProvider"];
  appVersion?: string;
  locale?: string;
};
