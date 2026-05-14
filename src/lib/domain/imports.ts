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

export type SourceAdapterImportInput = {
  dataSourceId: string;
  records: ImportRecordInput[];
  dryRun?: boolean;
  actorId?: string;
  batchName?: string;
  manifest?: {
    id: string;
    fileName: string;
    payloadKind: string;
    checksumSha256: string;
    recordCount: number;
  };
};

export type SourceAdapterImportResult = {
  generatedAt: string;
  dataSourceId: string;
  dataSourceName: string;
  sourceType: string;
  adapterKey: string;
  dryRun: boolean;
  batch: ImportBatchRecord;
  run: ImportBatchRunResult;
  readiness: ImportAdapterReadinessItem;
  nextActions: string[];
};

export type SourceAdapterImportReadinessSummary = {
  generatedAt: string;
  totals: {
    adapters: number;
    runnable: number;
    blocked: number;
    unsupported: number;
  };
  adapters: Array<{
    dataSourceId: string;
    dataSourceName: string;
    sourceType: string;
    adapterKey: string;
    status: "runnable" | "blocked" | "unsupported";
    acceptedPayloadKinds: string[];
    blockers: string[];
    nextActions: string[];
  }>;
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterWorkerPayloadInput = {
  dataSourceId: string;
  records: ImportRecordInput[];
  batchName?: string;
};

export type SourceAdapterWorkerRunInput = {
  dryRun?: boolean;
  actorId?: string;
  maxAdapters?: number;
  payloads?: SourceAdapterWorkerPayloadInput[];
};

export type SourceAdapterWorkerAdapterSummary = {
  dataSourceId: string;
  dataSourceName: string;
  sourceType: string;
  adapterKey: string;
  readinessStatus: "runnable" | "blocked" | "unsupported";
  action: "blocked" | "skipped" | "unsupported" | "executed";
  reason?: string;
  recordsProvided: number;
  run?: SourceAdapterImportResult;
};

export type SourceAdapterWorkerRunResult = {
  generatedAt: string;
  dryRun: boolean;
  adaptersReviewed: number;
  runnableAdapters: number;
  blockedAdapters: number;
  unsupportedAdapters: number;
  skippedAdapters: number;
  executedAdapters: number;
  totals: {
    totalRecords: number;
    stagedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
  };
  adapters: SourceAdapterWorkerAdapterSummary[];
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterManifestStorageStatus = "registered" | "verified" | "blocked";
export type SourceAdapterManifestMappingStatus = "pending" | "approved" | "blocked";

export type SourceAdapterManifestRecord = {
  id: string;
  dataSourceId: string;
  dataSourceName?: string;
  sourceType?: string;
  payloadKind: string;
  fileName: string;
  fileUrl?: string;
  checksumSha256: string;
  recordCount: number;
  storageStatus: SourceAdapterManifestStorageStatus;
  mappingStatus: SourceAdapterManifestMappingStatus;
  approvedBy?: string;
  receivedAt: string;
  createdAt: string;
  updatedAt?: string;
};

export type SourceAdapterManifestInput = {
  dataSourceId: string;
  payloadKind: string;
  fileName: string;
  fileUrl?: string;
  checksumSha256: string;
  recordCount: number;
  storageStatus?: SourceAdapterManifestStorageStatus;
  mappingStatus?: SourceAdapterManifestMappingStatus;
  approvedBy?: string;
  receivedAt?: string;
};

export type SourceAdapterManifestReadinessItem = SourceAdapterManifestRecord & {
  status: "ready" | "blocked";
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterManifestReadinessSummary = {
  generatedAt: string;
  totals: {
    manifests: number;
    ready: number;
    blocked: number;
    verifiedStorage: number;
    approvedMappings: number;
  };
  manifests: SourceAdapterManifestReadinessItem[];
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterStorageScheme =
  | "https"
  | "s3"
  | "gcs"
  | "azure_blob"
  | "supabase_storage"
  | "manual_upload"
  | "unknown";

export type SourceAdapterStorageReadinessItem = {
  manifestId: string;
  dataSourceId: string;
  dataSourceName?: string;
  sourceType?: string;
  fileName: string;
  fileUrl?: string;
  payloadKind: string;
  scheme: SourceAdapterStorageScheme;
  status: "fetch_ready" | "manual_ready" | "blocked";
  storageStatus: SourceAdapterManifestStorageStatus;
  mappingStatus: SourceAdapterManifestMappingStatus;
  ownerCredentialRequired: boolean;
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterStorageReadinessSummary = {
  generatedAt: string;
  totals: {
    manifests: number;
    fetchReady: number;
    manualReady: number;
    blocked: number;
    ownerCredentialRequired: number;
  };
  manifests: SourceAdapterStorageReadinessItem[];
  blockers: string[];
  nextActions: string[];
};

export type SourceAdapterManifestPayloadLoadInput = {
  manifestId: string;
  records: ImportRecordInput[];
  dryRun?: boolean;
  actorId?: string;
  batchName?: string;
};

export type SourceAdapterManifestPayloadLoadResult = {
  generatedAt: string;
  manifest: SourceAdapterManifestReadinessItem;
  dryRun: boolean;
  recordsProvided: number;
  recordCountMatchesManifest: boolean;
  importResult: SourceAdapterImportResult;
  nextActions: string[];
};

export type SourceAdapterManifestFetchInput = {
  manifestId: string;
  dryRun?: boolean;
  actorId?: string;
  batchName?: string;
  maxBytes?: number;
};

export type SourceAdapterManifestFetchResult = {
  generatedAt: string;
  manifest: SourceAdapterManifestReadinessItem;
  dryRun: boolean;
  fileUrl: string;
  bytesFetched: number;
  checksumSha256: string;
  recordsFetched: number;
  recordCountMatchesManifest: boolean;
  importResult: SourceAdapterImportResult;
  auditEventId: string;
  nextActions: string[];
};

export type SourceAdapterManifestFetchWorkerInput = {
  dryRun?: boolean;
  actorId?: string;
  maxManifests?: number;
  maxBytes?: number;
};

export type SourceAdapterManifestFetchWorkerManifestSummary = {
  manifestId: string;
  dataSourceId: string;
  dataSourceName?: string;
  fileName: string;
  fileUrl?: string;
  status: "fetch_ready" | "manual_ready" | "blocked";
  action: "executed" | "skipped" | "blocked";
  reason?: string;
  run?: SourceAdapterManifestFetchResult;
};

export type SourceAdapterManifestFetchWorkerResult = {
  generatedAt: string;
  dryRun: boolean;
  manifestsReviewed: number;
  fetchReadyManifests: number;
  executedManifests: number;
  skippedManifests: number;
  blockedManifests: number;
  totals: {
    recordsFetched: number;
    totalRecords: number;
    stagedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
  };
  manifests: SourceAdapterManifestFetchWorkerManifestSummary[];
  blockers: string[];
  nextActions: string[];
};

export type VendorFeedAuthType = "api_key" | "sftp" | "oauth" | "manual_upload";
export type VendorFeedReviewStatus = "missing" | "pending" | "approved" | "blocked";
export type VendorFeedCredentialStorageStatus = "missing" | "reference_recorded" | "verified";

export type VendorFeedConnectionRecord = {
  id: string;
  dataSourceId: string;
  dataSourceName?: string;
  vendorName: string;
  authType: VendorFeedAuthType;
  contractStatus: VendorFeedReviewStatus;
  credentialStorageStatus: VendorFeedCredentialStorageStatus;
  fieldMappingStatus: VendorFeedReviewStatus;
  credentialReference?: string;
  sampleFileUrl?: string;
  approvedBy?: string;
  lastValidatedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type VendorFeedConnectionInput = {
  dataSourceId: string;
  vendorName: string;
  authType?: VendorFeedAuthType;
  contractStatus?: VendorFeedReviewStatus;
  credentialStorageStatus?: VendorFeedCredentialStorageStatus;
  fieldMappingStatus?: VendorFeedReviewStatus;
  credentialReference?: string;
  credentialSecret?: string;
  sampleFileUrl?: string;
  approvedBy?: string;
};

export type VendorFeedReadinessItem = {
  dataSourceId: string;
  dataSourceName: string;
  connectionId?: string;
  vendorName?: string;
  status: "ready" | "blocked";
  sourceReviewStatus: string;
  authType?: VendorFeedAuthType;
  contractStatus?: VendorFeedReviewStatus;
  credentialStorageStatus?: VendorFeedCredentialStorageStatus;
  fieldMappingStatus?: VendorFeedReviewStatus;
  credentialReference?: string;
  blockers: string[];
  nextActions: string[];
};

export type VendorFeedReadinessSummary = {
  generatedAt: string;
  totals: {
    vendorSources: number;
    connections: number;
    ready: number;
    blocked: number;
    credentialsVerified: number;
  };
  sources: VendorFeedReadinessItem[];
  connections: VendorFeedConnectionRecord[];
  blockers: string[];
  nextActions: string[];
};

export type VendorFeedImportInput = {
  dataSourceId: string;
  records: ImportRecordInput[];
  dryRun?: boolean;
  actorId?: string;
  batchName?: string;
};

export type VendorFeedImportResult = {
  generatedAt: string;
  dataSourceId: string;
  dataSourceName: string;
  vendorName: string;
  dryRun: boolean;
  batch: ImportBatchRecord;
  run: ImportBatchRunResult;
  readiness: VendorFeedReadinessItem;
  nextActions: string[];
};

export type VendorFeedWorkerFeedInput = {
  dataSourceId: string;
  records: ImportRecordInput[];
  batchName?: string;
};

export type VendorFeedWorkerRunInput = {
  dryRun?: boolean;
  actorId?: string;
  maxFeeds?: number;
  feeds?: VendorFeedWorkerFeedInput[];
};

export type VendorFeedWorkerSourceSummary = {
  dataSourceId: string;
  dataSourceName: string;
  vendorName?: string;
  readinessStatus: "ready" | "blocked";
  action: "ready" | "blocked" | "skipped" | "executed";
  reason?: string;
  recordsProvided: number;
  run?: VendorFeedImportResult;
};

export type VendorFeedWorkerRunResult = {
  generatedAt: string;
  dryRun: boolean;
  feedsReviewed: number;
  readyFeeds: number;
  blockedFeeds: number;
  skippedFeeds: number;
  executedFeeds: number;
  totals: {
    totalRecords: number;
    stagedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
  };
  feeds: VendorFeedWorkerSourceSummary[];
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
  ruleSignals?: ProviderWebsiteParserRuleSignal[];
  blockers: string[];
  extractedFields: Record<string, unknown>;
};

export type ProviderWebsiteParserRuleSignal = {
  key: string;
  label: string;
  status: "passed" | "warning" | "failed";
  weight: number;
  evidence?: string;
};

export type ProviderWebsiteParserRuleOverrideRecord = {
  id: string;
  dataSourceId: string;
  dataSourceName?: string;
  minConfidence: number;
  minContentCharacters: number;
  serviceKeywords: string[];
  conversionKeywords: string[];
  pricingKeywords: string[];
  status: "active" | "inactive";
  approvedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ProviderWebsiteParserRuleOverrideInput = {
  dataSourceId: string;
  minConfidence?: number;
  minContentCharacters?: number;
  serviceKeywords?: string[];
  conversionKeywords?: string[];
  pricingKeywords?: string[];
  status?: "active" | "inactive";
  approvedBy?: string;
  notes?: string;
};

export type ProviderWebsiteParserRuleOverrideRollbackInput = {
  dataSourceId?: string;
  overrideId?: string;
  dryRun?: boolean;
  actorId?: string;
  reason?: string;
};

export type ProviderWebsiteParserRuleOverrideRollbackResult = {
  generatedAt: string;
  dryRun: boolean;
  status: "preview" | "rolled_back";
  candidates: ProviderWebsiteParserRuleOverrideRecord[];
  override?: ProviderWebsiteParserRuleOverrideRecord;
  auditEventId?: string;
  nextActions: string[];
};

export type ProviderWebsiteParserRuleOverrideReplaceInput = ProviderWebsiteParserRuleOverrideInput & {
  dryRun?: boolean;
  actorId?: string;
  reason?: string;
};

export type ProviderWebsiteParserRuleOverrideReplaceResult = {
  generatedAt: string;
  dryRun: boolean;
  status: "preview" | "replaced";
  candidates: ProviderWebsiteParserRuleOverrideRecord[];
  previousOverride?: ProviderWebsiteParserRuleOverrideRecord;
  replacementPreview?: ProviderWebsiteParserRuleOverrideRecord;
  replacement?: ProviderWebsiteParserRuleOverrideRecord;
  auditEventId?: string;
  nextActions: string[];
};

export type ProviderWebsiteParserRuleImpactCompareInput = {
  dataSourceId?: string;
  crawlJobId?: string;
  dryRun?: boolean;
  actorId?: string;
  reason?: string;
  minConfidence?: number;
  minContentCharacters?: number;
  serviceKeywords?: string[];
  conversionKeywords?: string[];
  pricingKeywords?: string[];
  approvedBy?: string;
  notes?: string;
};

export type ProviderWebsiteParserRuleImpactMetrics = {
  candidatePages: number;
  stageableCandidates: number;
  rejectedCandidates: number;
  averageConfidence: number;
  blockerCount: number;
  minConfidence: number;
  minContentCharacters: number;
  signalCoverage: Record<string, number>;
};

export type ProviderWebsiteParserRuleImpactComparison = {
  crawlPageId: string;
  sourceUrl: string;
  candidateName?: string;
  defaultConfidence: number;
  activeConfidence?: number;
  replacementConfidence?: number;
  defaultStageable: boolean;
  activeStageable?: boolean;
  replacementStageable?: boolean;
  defaultBlockers: string[];
  activeBlockers?: string[];
  replacementBlockers?: string[];
};

export type ProviderWebsiteParserRuleImpactSourceCandidate = {
  dataSourceId: string;
  dataSourceName?: string;
  overrideId?: string;
  activeOverride?: ProviderWebsiteParserRuleOverrideRecord;
  completedCrawlJobs: number;
  stagedPages: number;
  status: "ready" | "blocked";
  blockers: string[];
};

export type ProviderWebsiteParserRuleImpactCompareResult = {
  generatedAt: string;
  dryRun: boolean;
  status: "overview" | "compared";
  candidates?: ProviderWebsiteParserRuleImpactSourceCandidate[];
  dataSourceId?: string;
  dataSourceName?: string;
  crawlJobId?: string;
  activeOverride?: ProviderWebsiteParserRuleOverrideRecord;
  replacementPreview?: ProviderWebsiteParserRuleOverrideRecord;
  totals?: {
    pagesCompared: number;
    defaultStageable: number;
    activeStageable?: number;
    replacementStageable?: number;
    activeStageableDelta?: number;
    replacementStageableDelta?: number;
    defaultAverageConfidence: number;
    activeAverageConfidence?: number;
    replacementAverageConfidence?: number;
  };
  profiles?: {
    default: ProviderWebsiteParserRuleImpactMetrics;
    active?: ProviderWebsiteParserRuleImpactMetrics;
    replacement?: ProviderWebsiteParserRuleImpactMetrics;
  };
  comparisons?: ProviderWebsiteParserRuleImpactComparison[];
  auditEventId?: string;
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserRuleImpactEvidenceExportRow = {
  auditEventId: string;
  createdAt: string;
  actorId?: string;
  dataSourceId?: string;
  dataSourceName?: string;
  crawlJobId?: string;
  activeOverrideId?: string;
  replacementOverrideId?: string;
  pagesCompared: number;
  defaultStageable: number;
  activeStageable?: number;
  replacementStageable?: number;
  activeStageableDelta?: number;
  replacementStageableDelta?: number;
  reason?: string;
};

export type ProviderWebsiteParserRuleImpactEvidenceExport = {
  generatedAt: string;
  filters: {
    dataSourceId?: string;
    limit: number;
  };
  totals: {
    events: number;
    pagesCompared: number;
    defaultStageable: number;
    activeStageable: number;
    replacementStageable: number;
  };
  rows: ProviderWebsiteParserRuleImpactEvidenceExportRow[];
  csv: string;
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserRuleOverrideAuditSummary = {
  generatedAt: string;
  totals: {
    overrides: number;
    activeOverrides: number;
    inactiveOverrides: number;
    auditEvents: number;
    impactAuditEvents: number;
    unauditedOverrides: number;
  };
  overrides: Array<
    ProviderWebsiteParserRuleOverrideRecord & {
      auditEvents: import("@/lib/domain/audit").OperationalAuditEvent[];
      auditStatus: "audited" | "missing_audit_event";
    }
  >;
  auditEvents: import("@/lib/domain/audit").OperationalAuditEvent[];
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserRuleProfile = {
  crawlPageId: string;
  sourceUrl: string;
  candidateName?: string;
  extractionConfidence: number;
  stageable: boolean;
  overrideApplied?: ProviderWebsiteParserRuleOverrideRecord;
  signals: ProviderWebsiteParserRuleSignal[];
  blockers: string[];
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

export type ProviderWebsiteParserRuleReadinessSource = {
  dataSourceId: string;
  dataSourceName: string;
  status: "ready" | "blocked";
  completedCrawlJobs: number;
  stagedPages: number;
  candidatePages: number;
  stageableCandidates: number;
  averageConfidence: number;
  overrideApplied?: ProviderWebsiteParserRuleOverrideRecord;
  signalCoverage: Record<string, number>;
  blockers: string[];
  nextActions: string[];
};

export type ProviderWebsiteParserRuleReadinessSummary = {
  generatedAt: string;
  totals: {
    sources: number;
    ready: number;
    blocked: number;
    stagedPages: number;
    candidatePages: number;
    stageableCandidates: number;
  };
  sources: ProviderWebsiteParserRuleReadinessSource[];
  ruleProfiles: ProviderWebsiteParserRuleProfile[];
  overrides: ProviderWebsiteParserRuleOverrideRecord[];
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
