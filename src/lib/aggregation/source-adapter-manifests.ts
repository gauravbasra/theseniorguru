import crypto from "node:crypto";
import { listDataSources } from "@/lib/data-sources";
import type {
  SourceAdapterManifestInput,
  SourceAdapterManifestReadinessItem,
  SourceAdapterManifestReadinessSummary,
  SourceAdapterManifestRecord
} from "@/lib/domain/imports";
import type { DataSourceRecord } from "@/lib/domain/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localManifests: SourceAdapterManifestRecord[] = [];
const supportedSourceTypes = new Set<DataSourceRecord["sourceType"]>(["cms", "state_license", "manual"]);

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("source_adapter_manifests");
}

function mapManifest(row: Record<string, unknown>): SourceAdapterManifestRecord {
  return {
    id: String(row.id),
    dataSourceId: String(row.data_source_id),
    payloadKind: String(row.payload_kind),
    fileName: String(row.file_name),
    fileUrl: row.file_url ? String(row.file_url) : undefined,
    checksumSha256: String(row.checksum_sha256),
    recordCount: Number(row.record_count ?? 0),
    storageStatus: row.storage_status as SourceAdapterManifestRecord["storageStatus"],
    mappingStatus: row.mapping_status as SourceAdapterManifestRecord["mappingStatus"],
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    receivedAt: String(row.received_at),
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function withSource(manifest: SourceAdapterManifestRecord, sources: DataSourceRecord[]): SourceAdapterManifestRecord {
  const source = sources.find((item) => item.id === manifest.dataSourceId);

  return {
    ...manifest,
    dataSourceName: source?.name,
    sourceType: source?.sourceType
  };
}

function validateChecksum(value: string) {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

function manifestBlockers(manifest: SourceAdapterManifestRecord, source?: DataSourceRecord) {
  return [
    ...(!source ? ["Data source is not registered."] : []),
    ...(source && !supportedSourceTypes.has(source.sourceType) ? ["Manifest source type must be CMS, state license, or owner-controlled manual."] : []),
    ...(source?.reviewStatus !== "approved" ? [`Data source review status is ${source?.reviewStatus ?? "missing"}, not approved.`] : []),
    ...(source?.robotsStatus === "blocked" || source?.robotsStatus === "disallowed" ? ["Data source robots policy blocks import use."] : []),
    ...(!source?.termsNotes ? ["Data source terms notes are required before file ingestion."] : []),
    ...(!validateChecksum(manifest.checksumSha256) ? ["Manifest checksumSha256 must be a 64-character SHA-256 hex digest."] : []),
    ...(manifest.recordCount <= 0 ? ["Manifest recordCount must be greater than 0."] : []),
    ...(manifest.storageStatus !== "verified" ? ["Manifest storage location/checksum has not been verified."] : []),
    ...(manifest.mappingStatus !== "approved" ? ["Manifest schema mapping has not been approved."] : [])
  ];
}

function buildReadinessItem(manifest: SourceAdapterManifestRecord, sources: DataSourceRecord[]): SourceAdapterManifestReadinessItem {
  const source = sources.find((item) => item.id === manifest.dataSourceId);
  const blockers = manifestBlockers(manifest, source);

  return {
    ...withSource(manifest, sources),
    status: blockers.length ? "blocked" : "ready",
    blockers,
    nextActions: blockers.length
      ? ["Verify storage checksum, approve field mapping, and confirm source approval before scheduled payload ingestion."]
      : ["Manifest is ready for source adapter payload loading and scheduled worker execution."]
  };
}

export async function listSourceAdapterManifests(): Promise<SourceAdapterManifestRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const sources = await listDataSources();
    return localManifests.map((manifest) => withSource(manifest, sources));
  }

  const { data, error } = await supabase
    .from("source_adapter_manifests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      const sources = await listDataSources();
      return localManifests.map((manifest) => withSource(manifest, sources));
    }
    throw new Error(`Source adapter manifest query failed: ${error.message}`);
  }

  const sources = await listDataSources();
  return (data ?? []).map(mapManifest).map((manifest) => withSource(manifest, sources));
}

export async function upsertSourceAdapterManifest(input: SourceAdapterManifestInput): Promise<SourceAdapterManifestRecord> {
  if (!validateChecksum(input.checksumSha256)) {
    throw new Error("checksumSha256 must be a 64-character SHA-256 hex digest");
  }

  if (!Number.isFinite(input.recordCount) || input.recordCount <= 0) {
    throw new Error("recordCount must be greater than 0");
  }

  const sources = await listDataSources();
  const source = sources.find((item) => item.id === input.dataSourceId);

  if (!source) {
    throw new Error("Data source not found");
  }

  if (!supportedSourceTypes.has(source.sourceType)) {
    throw new Error("Source adapter manifests require a CMS, state license, or owner-controlled manual data source");
  }

  const now = new Date().toISOString();
  const record: SourceAdapterManifestRecord = {
    id: `source-manifest-${crypto.randomUUID()}`,
    dataSourceId: source.id,
    dataSourceName: source.name,
    sourceType: source.sourceType,
    payloadKind: input.payloadKind,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    checksumSha256: input.checksumSha256.toLowerCase(),
    recordCount: Math.floor(input.recordCount),
    storageStatus: input.storageStatus ?? "registered",
    mappingStatus: input.mappingStatus ?? "pending",
    approvedBy: input.approvedBy,
    receivedAt: input.receivedAt ?? now,
    createdAt: now,
    updatedAt: now
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existingIndex = localManifests.findIndex(
      (item) => item.dataSourceId === record.dataSourceId && item.checksumSha256 === record.checksumSha256
    );

    if (existingIndex >= 0) {
      localManifests[existingIndex] = { ...record, id: localManifests[existingIndex].id };
      return withSource(localManifests[existingIndex], sources);
    }

    localManifests.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("source_adapter_manifests")
    .upsert(
      {
        data_source_id: record.dataSourceId,
        payload_kind: record.payloadKind,
        file_name: record.fileName,
        file_url: record.fileUrl,
        checksum_sha256: record.checksumSha256,
        record_count: record.recordCount,
        storage_status: record.storageStatus,
        mapping_status: record.mappingStatus,
        approved_by: record.approvedBy,
        received_at: record.receivedAt,
        updated_at: now
      },
      { onConflict: "data_source_id,checksum_sha256" }
    )
    .select("*")
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      throw new Error(`Source adapter manifest upsert failed: ${error.message}`);
    }

    localManifests.unshift(record);
    return record;
  }

  return withSource(mapManifest(data), sources);
}

export async function getSourceAdapterManifestReadiness(): Promise<SourceAdapterManifestReadinessSummary> {
  const [manifests, sources] = await Promise.all([listSourceAdapterManifests(), listDataSources()]);
  const items = manifests.map((manifest) => buildReadinessItem(manifest, sources));
  const blockers = items.flatMap((item) => item.blockers.map((blocker) => `${item.fileName}: ${blocker}`));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      manifests: items.length,
      ready: items.filter((item) => item.status === "ready").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      verifiedStorage: items.filter((item) => item.storageStatus === "verified").length,
      approvedMappings: items.filter((item) => item.mappingStatus === "approved").length
    },
    manifests: items,
    blockers,
    nextActions: [
      ...(items.some((item) => item.status === "ready") ? ["Load ready manifest records into the source adapter scheduled worker payload queue."] : []),
      ...(blockers.length ? ["Keep scheduled source adapter imports blocked until manifest checksum, storage, and mapping review are complete."] : []),
      ...(!items.length ? ["Register CMS, state, or owner-controlled source export manifests before unattended payload ingestion."] : [])
    ]
  };
}
