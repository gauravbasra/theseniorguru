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
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  websiteUrl?: string;
  categories?: string[];
  sourceUrl?: string;
  sourceRecordId?: string;
  confidenceScore?: number;
  rawPayload?: Record<string, unknown>;
  extractedFields?: Record<string, unknown>;
};

export type RunImportBatchInput = {
  records: ImportRecordInput[];
  actorId?: string;
  dryRun?: boolean;
};

export type ImportBatchRunResult = {
  batchId: string;
  status: ImportBatchStatus;
  totalRecords: number;
  stagedRecords: number;
  rejectedRecords: number;
  errorRecords: number;
  dryRun: boolean;
  errors: Array<{
    index: number;
    reason: string;
  }>;
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
