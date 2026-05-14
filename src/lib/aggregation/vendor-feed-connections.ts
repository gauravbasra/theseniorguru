import crypto from "node:crypto";
import { listDataSources } from "@/lib/data-sources";
import type {
  ImportRecordInput,
  VendorFeedConnectionInput,
  VendorFeedConnectionRecord,
  VendorFeedImportInput,
  VendorFeedImportResult,
  VendorFeedReadinessItem,
  VendorFeedReadinessSummary
} from "@/lib/domain/imports";
import type { DataSourceRecord } from "@/lib/domain/providers";
import { createImportBatch } from "@/lib/import-batches";
import { runImportBatch } from "@/lib/aggregation/import-worker";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedVendorFeedConnections: VendorFeedConnectionRecord[] = [];

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("vendor_feed_connections");
}

function mapConnection(row: Record<string, unknown>): VendorFeedConnectionRecord {
  return {
    id: String(row.id),
    dataSourceId: String(row.data_source_id),
    vendorName: String(row.vendor_name),
    authType: row.auth_type as VendorFeedConnectionRecord["authType"],
    contractStatus: row.contract_status as VendorFeedConnectionRecord["contractStatus"],
    credentialStorageStatus: row.credential_storage_status as VendorFeedConnectionRecord["credentialStorageStatus"],
    fieldMappingStatus: row.field_mapping_status as VendorFeedConnectionRecord["fieldMappingStatus"],
    credentialReference: row.credential_reference ? String(row.credential_reference) : undefined,
    sampleFileUrl: row.sample_file_url ? String(row.sample_file_url) : undefined,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    lastValidatedAt: row.last_validated_at ? String(row.last_validated_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function withSourceName(connection: VendorFeedConnectionRecord, sources: DataSourceRecord[]) {
  return {
    ...connection,
    dataSourceName: sources.find((source) => source.id === connection.dataSourceId)?.name
  };
}

export async function listVendorFeedConnections(): Promise<VendorFeedConnectionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedVendorFeedConnections;
  }

  const { data, error } = await supabase
    .from("vendor_feed_connections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return seedVendorFeedConnections;
    throw new Error(`Vendor feed connection query failed: ${error.message}`);
  }

  return (data ?? []).map(mapConnection);
}

export async function upsertVendorFeedConnection(input: VendorFeedConnectionInput): Promise<VendorFeedConnectionRecord> {
  if (input.credentialSecret) {
    throw new Error("Do not submit vendor secrets to this API; store secrets in the owner-approved vault and pass only a credentialReference.");
  }

  const sources = await listDataSources();
  const source = sources.find((item) => item.id === input.dataSourceId);

  if (!source) {
    throw new Error("Vendor data source not found");
  }

  if (source.sourceType !== "vendor") {
    throw new Error("Vendor feed connections require a vendor data source");
  }

  const now = new Date().toISOString();
  const record: VendorFeedConnectionRecord = {
    id: `vendor-feed-${crypto.randomUUID()}`,
    dataSourceId: input.dataSourceId,
    vendorName: input.vendorName,
    authType: input.authType ?? "manual_upload",
    contractStatus: input.contractStatus ?? "pending",
    credentialStorageStatus: input.credentialStorageStatus ?? (input.credentialReference ? "reference_recorded" : "missing"),
    fieldMappingStatus: input.fieldMappingStatus ?? "pending",
    credentialReference: input.credentialReference,
    sampleFileUrl: input.sampleFileUrl,
    approvedBy: input.approvedBy,
    lastValidatedAt: input.credentialStorageStatus === "verified" ? now : undefined,
    createdAt: now,
    updatedAt: now
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existingIndex = seedVendorFeedConnections.findIndex((item) => item.dataSourceId === record.dataSourceId);
    if (existingIndex >= 0) {
      seedVendorFeedConnections[existingIndex] = { ...record, id: seedVendorFeedConnections[existingIndex].id };
      return withSourceName(seedVendorFeedConnections[existingIndex], sources);
    }
    seedVendorFeedConnections.unshift(record);
    return withSourceName(record, sources);
  }

  const { data, error } = await supabase
    .from("vendor_feed_connections")
    .upsert(
      {
        data_source_id: record.dataSourceId,
        vendor_name: record.vendorName,
        auth_type: record.authType,
        contract_status: record.contractStatus,
        credential_storage_status: record.credentialStorageStatus,
        field_mapping_status: record.fieldMappingStatus,
        credential_reference: record.credentialReference,
        sample_file_url: record.sampleFileUrl,
        approved_by: record.approvedBy,
        last_validated_at: record.lastValidatedAt,
        updated_at: now
      },
      { onConflict: "data_source_id" }
    )
    .select("*")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(`Vendor feed connection upsert failed: ${error.message}`);
    }

    seedVendorFeedConnections.unshift(record);
    return withSourceName(record, sources);
  }

  return withSourceName(mapConnection(data), sources);
}

function sourceBlockers(source: DataSourceRecord) {
  return [
    ...(source.reviewStatus !== "approved" ? [`Vendor source review status is ${source.reviewStatus}, not approved.`] : []),
    ...(source.robotsStatus === "blocked" || source.robotsStatus === "disallowed" ? ["Vendor source robots policy blocks import use."] : []),
    ...(!source.baseUrl ? ["Vendor source is missing baseUrl."] : []),
    ...(!source.jurisdiction ? ["Vendor source is missing jurisdiction."] : []),
    ...(!source.termsNotes ? ["Vendor source is missing contract or terms notes."] : [])
  ];
}

function buildReadinessItem(source: DataSourceRecord, connection?: VendorFeedConnectionRecord): VendorFeedReadinessItem {
  const blockers = [
    ...sourceBlockers(source),
    ...(!connection ? ["No vendor feed connection metadata is registered."] : []),
    ...(connection?.contractStatus !== "approved" ? ["Vendor contract or data-use agreement is not approved."] : []),
    ...(connection?.credentialStorageStatus !== "verified" ? ["Vendor credential reference is not verified in owner-approved storage."] : []),
    ...(connection?.fieldMappingStatus !== "approved" ? ["Vendor feed field mapping is not approved."] : [])
  ];

  return {
    dataSourceId: source.id,
    dataSourceName: source.name,
    connectionId: connection?.id,
    vendorName: connection?.vendorName,
    status: blockers.length ? "blocked" : "ready",
    sourceReviewStatus: source.reviewStatus,
    authType: connection?.authType,
    contractStatus: connection?.contractStatus,
    credentialStorageStatus: connection?.credentialStorageStatus,
    fieldMappingStatus: connection?.fieldMappingStatus,
    credentialReference: connection?.credentialReference,
    blockers,
    nextActions: blockers.length
      ? ["Complete vendor contract approval, vault credential verification, and field mapping before enabling vendor feed import."]
      : ["Vendor feed metadata is ready for an import adapter run."]
  };
}

export async function getVendorFeedReadiness(): Promise<VendorFeedReadinessSummary> {
  const [sources, connections] = await Promise.all([listDataSources(), listVendorFeedConnections()]);
  const vendorSources = sources.filter((source) => source.sourceType === "vendor");
  const connectionsBySource = new Map(connections.map((connection) => [connection.dataSourceId, connection]));
  const items = vendorSources.map((source) => buildReadinessItem(source, connectionsBySource.get(source.id)));
  const blockers = items.flatMap((item) => item.blockers.map((blocker) => `${item.dataSourceName}: ${blocker}`));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      vendorSources: vendorSources.length,
      connections: connections.length,
      ready: items.filter((item) => item.status === "ready").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      credentialsVerified: connections.filter((connection) => connection.credentialStorageStatus === "verified").length
    },
    sources: items,
    connections: connections.map((connection) => withSourceName(connection, sources)),
    blockers,
    nextActions: [
      ...(items.some((item) => item.status === "ready") ? ["Create a vendor feed import adapter run for ready sources."] : []),
      ...(blockers.length ? ["Keep vendor feed imports blocked until owner contract, credential, and mapping approvals are complete."] : []),
      ...(!vendorSources.length ? ["Register vendor data sources before vendor feed readiness can be evaluated."] : [])
    ]
  };
}

function normalizeVendorRecord(
  record: ImportRecordInput,
  source: DataSourceRecord,
  connection: VendorFeedConnectionRecord,
  index: number
): ImportRecordInput {
  const fetchedAt = record.fetchedAt ?? new Date().toISOString();
  const sourceRecordId =
    record.sourceRecordId ?? `${source.id}:${connection.vendorName}:${record.name ?? "record"}:${index}`;

  return {
    ...record,
    sourceUrl: record.sourceUrl ?? source.baseUrl,
    sourceRecordId,
    fetchedAt,
    licenseTermsStatus: record.licenseTermsStatus ?? source.termsNotes ?? "vendor_contract_approved",
    robotsDecision: record.robotsDecision ?? source.robotsStatus ?? "vendor_feed_contract",
    extractionConfidence: record.extractionConfidence ?? record.confidenceScore ?? 0.74,
    confidenceScore: record.confidenceScore ?? record.extractionConfidence ?? 0.74,
    rawPayload: {
      ...(record.rawPayload ?? {}),
      vendorName: connection.vendorName,
      credentialReference: connection.credentialReference,
      dataSourceId: source.id
    },
    extractedFields: {
      ...(record.extractedFields ?? {}),
      adapter: "vendor_feed_import_v1",
      vendorName: connection.vendorName,
      credentialReference: connection.credentialReference,
      contractStatus: connection.contractStatus,
      fieldMappingStatus: connection.fieldMappingStatus
    },
    auditTrail: [
      ...(record.auditTrail ?? []),
      {
        at: fetchedAt,
        actor: "vendor-feed-import-runner",
        action: "vendor_feed_record_mapped",
        notes: `Mapped from ${connection.vendorName} vendor feed metadata.`
      }
    ]
  };
}

export async function runVendorFeedImport(input: VendorFeedImportInput): Promise<VendorFeedImportResult> {
  if (!Array.isArray(input.records) || !input.records.length) {
    throw new Error("records are required for a vendor feed import run");
  }

  const [sources, readiness] = await Promise.all([listDataSources(), getVendorFeedReadiness()]);
  const source = sources.find((item) => item.id === input.dataSourceId);

  if (!source) {
    throw new Error("Vendor data source not found");
  }

  if (source.sourceType !== "vendor") {
    throw new Error("Vendor feed import requires a vendor data source");
  }

  const readinessItem = readiness.sources.find((item) => item.dataSourceId === input.dataSourceId);

  if (!readinessItem) {
    throw new Error("Vendor feed readiness record not found");
  }

  if (readinessItem.status !== "ready") {
    throw new Error(readinessItem.blockers[0] ?? "Vendor feed is not ready for import");
  }

  const connection = readiness.connections.find((item) => item.dataSourceId === input.dataSourceId);

  if (!connection) {
    throw new Error("Vendor feed connection metadata not found");
  }

  const dryRun = input.dryRun ?? true;
  const normalizedRecords = input.records.map((record, index) => normalizeVendorRecord(record, source, connection, index));
  const batch = await createImportBatch({
    dataSourceId: source.id,
    name: input.batchName ?? `${connection.vendorName} vendor feed import`,
    sourceKind: "vendor",
    estimatedRecords: normalizedRecords.length
  });
  const run = await runImportBatch(batch.id, {
    records: normalizedRecords,
    dryRun,
    actorId: input.actorId
  });

  return {
    generatedAt: new Date().toISOString(),
    dataSourceId: source.id,
    dataSourceName: source.name,
    vendorName: connection.vendorName,
    dryRun,
    batch,
    run,
    readiness: readinessItem,
    nextActions: [
      ...(dryRun ? ["Review the dry-run source coverage and rejected records before running with dryRun=false."] : []),
      ...(!dryRun ? ["Review staged extracted entities and duplicate candidates before publication."] : []),
      ...(run.errors.length ? ["Resolve vendor feed validation errors before scaling scheduled imports."] : [])
    ]
  };
}
