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

