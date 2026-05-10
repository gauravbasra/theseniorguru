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
