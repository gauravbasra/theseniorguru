export type ImportBatchStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "blocked_by_policy";

export type ImportBatchRecord = {
  id: string;
  dataSourceId?: string;
  status: ImportBatchStatus;
  name: string;
  sourceKind: string;
  totalRecords: number;
  importedRecords: number;
  skippedRecords?: number;
  rejectedRecords: number;
  errorRecords: number;
  policyCheckId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type CreateImportBatchInput = {
  dataSourceId?: string;
  name: string;
  sourceKind: string;
  estimatedRecords?: number;
};

export type ImportRecordInput = {
  name?: string;
  categories?: string[];
  careTypes?: string[];
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  description?: string;
  amenities?: string[];
  services?: string[];
  pricingSignals?: Record<string, unknown>;
  licenseFields?: Record<string, unknown>;
  accreditationFields?: Record<string, unknown>;
  sourceUrl?: string;
  sourceRecordId?: string;
  fetchedAt?: string;
  licenseTermsStatus?: string;
  robotsDecision?: string;
  extractionConfidence?: number;
  duplicateMatchData?: Record<string, unknown>;
  imageAssets?: import("@/lib/domain/entities").StagedListingImageRecord[];
  auditTrail?: import("@/lib/domain/entities").StagedListingAuditEvent[];
  confidenceScore?: number;
  rawPayload?: Record<string, unknown>;
  extractedFields?: Record<string, unknown>;
};

export type RunImportBatchInput = {
  records: ImportRecordInput[];
  actorId?: string;
  dryRun?: boolean;
};

export type ImportBatchSourceCoverage = {
  totalRecords: number;
  withSourceUrl: number;
  withSourceRecordId: number;
  withFetchedAt: number;
  withLicenseTermsStatus: number;
  withRobotsDecision: number;
  imageReadyRecords: number;
  imageBacklogRecords: number;
  sourcePolicyBlockedRecords: number;
  productionGradeRecords: number;
};

export type ImportBatchRunResult = {
  batchId: string;
  status: ImportBatchStatus;
  totalRecords: number;
  stagedRecords: number;
  skippedRecords: number;
  rejectedRecords: number;
  errorRecords: number;
  dryRun: boolean;
  sourceCoverage: ImportBatchSourceCoverage;
  errors: Array<{
    index: number;
    reason: string;
  }>;
};

export type RequeueImportBatchInput = {
  actorId?: string;
  reason?: string;
};

export type RequeueImportBatchResult = {
  batch: ImportBatchRecord;
  previousStatus: ImportBatchStatus;
  status: "queued";
};

export type ImportLaunchPlanBatch = {
  name: string;
  dataSourceId?: string;
  sourceName: string;
  sourceKind: string;
  estimatedRecords: number;
  wave: number;
};

export type ImportLaunchPlanSummary = {
  generatedAt: string;
  targetListings: number;
  batchSize: number;
  importedListings: number;
  stagedRecords: number;
  remainingListings: number;
  approvedSources: number;
  existingBatches: number;
  plannedBatches: ImportLaunchPlanBatch[];
  createdBatches?: ImportBatchRecord[];
  blockers: string[];
  nextActions: string[];
};

export type LaunchImportSourceSeedSummary = {
  generatedAt: string;
  sourcesReviewed: number;
  sourcesCreated: number;
  sourcesUpdated: number;
  readyForImport: number;
  starterBatchesCreated: number;
  sources: Array<{
    id: string;
    name: string;
    sourceType: string;
    reviewStatus: string;
    robotsStatus?: string;
    action: "created" | "updated" | "already_ready";
  }>;
  createdBatches: ImportBatchRecord[];
  blockers: string[];
  nextActions: string[];
};

export type LaunchImportExecutionBatchSummary = {
  batchId: string;
  name: string;
  sourceKind: string;
  status: ImportBatchStatus;
  estimatedRecords: number;
  action: "executed" | "ready" | "skipped" | "blocked";
  reason?: string;
  run?: ImportBatchRunResult;
};

export type LaunchImportExecutionSummary = {
  generatedAt: string;
  mode: "status" | "execute";
  dryRun: boolean;
  batchesReviewed: number;
  runnableBatches: number;
  executedBatches: number;
  skippedBatches: number;
  blockedBatches: number;
  totals: {
    totalRecords: number;
    stagedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
  };
  batches: LaunchImportExecutionBatchSummary[];
  blockers: string[];
  nextActions: string[];
};

export type ImportAdapterMode = "manual_export" | "live_api" | "crawler_parser" | "vendor_feed" | "not_supported";

export type ImportAdapterReadinessItem = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  adapterKey: string;
  mode: ImportAdapterMode;
  status: "ready" | "manual_ready" | "blocked";
  reviewStatus: string;
  jurisdiction?: string;
  baseUrl?: string;
  existingBatches: number;
  supportedActions: string[];
  requiredFields: string[];
  blockers: string[];
  nextActions: string[];
};

export type ImportAdapterReadinessSummary = {
  generatedAt: string;
  totals: {
    sources: number;
    ready: number;
    manualReady: number;
    blocked: number;
    existingBatches: number;
  };
  adapters: ImportAdapterReadinessItem[];
  blockers: string[];
  nextActions: string[];
};

export type CrawlJobStatus = "queued" | "running" | "completed" | "failed" | "blocked_by_policy";

export type CrawlJobRecord = {
  id: string;
  dataSourceId: string;
  status: CrawlJobStatus;
  seedUrl: string;
  maxPages: number;
  pagesSeen: number;
  pagesImported: number;
  robotsDecision?: string;
  policyCheckId?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type CreateCrawlJobInput = {
  dataSourceId: string;
  seedUrl: string;
  maxPages?: number;
  actorId?: string;
};

export type CrawlPageRecord = {
  id: string;
  crawlJobId: string;
  url: string;
  statusCode?: number;
  contentHash?: string;
  title?: string;
  extractedText?: string;
  fetchedAt: string;
};

export type RunCrawlJobInput = {
  dryRun?: boolean;
  actorId?: string;
};

export type CrawlJobRunResult = {
  crawlJobId: string;
  status: CrawlJobStatus;
  dryRun: boolean;
  pagesSeen: number;
  pagesImported: number;
  pages: CrawlPageRecord[];
  errors: string[];
};

export type ProviderWebsiteParserCandidate = {
  crawlPageId: string;
  sourceUrl: string;
  sourceRecordId: string;
  name?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  categories: string[];
  description?: string;
  extractionConfidence: number;
  blockers: string[];
  extractedFields: Record<string, unknown>;
};

export type ProviderWebsiteParserRunResult = {
  generatedAt: string;
  crawlJobId: string;
  dataSourceId: string;
  dataSourceName: string;
  dryRun: boolean;
  pagesReviewed: number;
  candidatesFound: number;
  stagedEntities: number;
  rejectedCandidates: number;
  candidates: ProviderWebsiteParserCandidate[];
  stagedEntityIds: string[];
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserReadinessSource = {
  dataSourceId: string;
  dataSourceName: string;
  status: "ready" | "blocked";
  baseUrl?: string;
  reviewStatus: string;
  robotsStatus?: string;
  completedCrawlJobs: number;
  stagedPages: number;
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserReadinessSummary = {
  generatedAt: string;
  totals: {
    providerWebsiteSources: number;
    ready: number;
    blocked: number;
    completedCrawlJobs: number;
    stagedPages: number;
  };
  sources: ProviderWebsiteParserReadinessSource[];
  blockers: string[];
  nextActions: string[];
};

export type DataQualityFlagRecord = {
  id: string;
  subjectType: string;
  subjectId: string;
  severity: "low" | "medium" | "high" | "critical";
  flagKey: string;
  message: string;
  resolvedAt?: string;
  createdAt: string;
};
