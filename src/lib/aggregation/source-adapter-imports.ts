import { getImportAdapterReadiness } from "@/lib/aggregation/import-adapters";
import { runImportBatch } from "@/lib/aggregation/import-worker";
import { listDataSources } from "@/lib/data-sources";
import type {
  ImportAdapterReadinessItem,
  ImportRecordInput,
  SourceAdapterImportInput,
  SourceAdapterImportReadinessSummary,
  SourceAdapterImportResult
} from "@/lib/domain/imports";
import type { DataSourceRecord } from "@/lib/domain/providers";
import { createImportBatch } from "@/lib/import-batches";

const runnableSourceTypes = new Set<DataSourceRecord["sourceType"]>(["cms", "state_license", "manual"]);

function payloadKindsFor(sourceType: DataSourceRecord["sourceType"]) {
  if (sourceType === "cms") return ["cms_export_json", "cms_export_csv_mapped_records"];
  if (sourceType === "state_license") return ["state_license_export_json", "state_license_csv_mapped_records"];
  if (sourceType === "manual") return ["owner_controlled_inventory_records"];
  return [];
}

function readinessStatus(adapter: ImportAdapterReadinessItem) {
  if (!runnableSourceTypes.has(adapter.sourceType as DataSourceRecord["sourceType"])) return "unsupported" as const;
  if (adapter.status === "ready" || adapter.status === "manual_ready") return "runnable" as const;
  return "blocked" as const;
}

function normalizeSourceRecord(
  record: ImportRecordInput,
  source: DataSourceRecord,
  adapter: ImportAdapterReadinessItem,
  index: number
): ImportRecordInput {
  const fetchedAt = record.fetchedAt ?? new Date().toISOString();
  const sourceRecordId = record.sourceRecordId ?? `${source.id}:${record.name ?? "record"}:${index}`;

  return {
    ...record,
    sourceUrl: record.sourceUrl ?? source.baseUrl,
    sourceRecordId,
    fetchedAt,
    licenseTermsStatus: record.licenseTermsStatus ?? source.termsNotes ?? "source_terms_reviewed",
    robotsDecision: record.robotsDecision ?? source.robotsStatus ?? "source_reviewed",
    extractionConfidence: record.extractionConfidence ?? record.confidenceScore ?? 0.72,
    confidenceScore: record.confidenceScore ?? record.extractionConfidence ?? 0.72,
    rawPayload: {
      ...(record.rawPayload ?? {}),
      dataSourceId: source.id,
      sourceType: source.sourceType,
      adapterKey: adapter.adapterKey
    },
    extractedFields: {
      ...(record.extractedFields ?? {}),
      adapter: adapter.adapterKey,
      sourceType: source.sourceType,
      sourceName: source.name,
      sourceReviewStatus: source.reviewStatus
    },
    auditTrail: [
      ...(record.auditTrail ?? []),
      {
        at: fetchedAt,
        actor: "source-adapter-import-runner",
        action: "source_adapter_record_mapped",
        notes: `Mapped from ${source.name} ${source.sourceType} adapter payload.`
      }
    ]
  };
}

export async function getSourceAdapterImportReadiness(): Promise<SourceAdapterImportReadinessSummary> {
  const readiness = await getImportAdapterReadiness();
  const adapters = readiness.adapters.map((adapter) => {
    const status = readinessStatus(adapter);
    const blockers =
      status === "unsupported"
        ? ["Use the dedicated vendor feed runner, provider website parser, or newsroom RSS intake for this source type."]
        : adapter.blockers;

    return {
      dataSourceId: adapter.sourceId,
      dataSourceName: adapter.sourceName,
      sourceType: adapter.sourceType,
      adapterKey: adapter.adapterKey,
      status,
      acceptedPayloadKinds: payloadKindsFor(adapter.sourceType as DataSourceRecord["sourceType"]),
      blockers,
      nextActions: [
        ...(status === "runnable" ? ["Submit source export records to run this adapter through the governed import worker."] : []),
        ...(status === "blocked" ? ["Complete source approval, robots, terms, and jurisdiction review before import."] : []),
        ...(status === "unsupported" ? ["Use the source-specific runner for this adapter type."] : [])
      ]
    };
  });
  const blockers = adapters.flatMap((adapter) =>
    adapter.blockers.map((blocker) => `${adapter.dataSourceName}: ${blocker}`)
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      adapters: adapters.length,
      runnable: adapters.filter((adapter) => adapter.status === "runnable").length,
      blocked: adapters.filter((adapter) => adapter.status === "blocked").length,
      unsupported: adapters.filter((adapter) => adapter.status === "unsupported").length
    },
    adapters,
    blockers,
    nextActions: [
      ...(adapters.some((adapter) => adapter.status === "runnable")
        ? ["Run approved CMS, state, or owner-controlled payloads through POST /api/v1/admin/source-adapter-imports."]
        : []),
      ...(blockers.length ? ["Resolve source-specific blockers before enabling unattended adapter runs."] : []),
      ...(!adapters.length ? ["Register and approve data sources before running source adapters."] : [])
    ]
  };
}

export async function runSourceAdapterImport(input: SourceAdapterImportInput): Promise<SourceAdapterImportResult> {
  if (!Array.isArray(input.records) || !input.records.length) {
    throw new Error("records are required for a source adapter import run");
  }

  const [sources, readiness] = await Promise.all([listDataSources(), getImportAdapterReadiness()]);
  const source = sources.find((item) => item.id === input.dataSourceId);

  if (!source) {
    throw new Error("Data source not found");
  }

  if (!runnableSourceTypes.has(source.sourceType)) {
    throw new Error("Use the dedicated source-specific runner for this data source type");
  }

  const adapter = readiness.adapters.find((item) => item.sourceId === source.id);

  if (!adapter) {
    throw new Error("Import adapter readiness record not found");
  }

  if (readinessStatus(adapter) !== "runnable") {
    throw new Error(adapter.blockers[0] ?? "Source adapter is not ready for import");
  }

  const dryRun = input.dryRun ?? true;
  const normalizedRecords = input.records.map((record, index) => normalizeSourceRecord(record, source, adapter, index));
  const batch = await createImportBatch({
    dataSourceId: source.id,
    name: input.batchName ?? `${source.name} source adapter import`,
    sourceKind: source.sourceType,
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
    sourceType: source.sourceType,
    adapterKey: adapter.adapterKey,
    dryRun,
    batch,
    run,
    readiness: adapter,
    nextActions: [
      ...(dryRun ? ["Review dry-run coverage and rejected records before running with dryRun=false."] : []),
      ...(!dryRun ? ["Review staged entities for duplicate, image-rights, and publication approval."] : []),
      ...(run.errors.length ? ["Resolve source adapter validation errors before scheduling this adapter."] : [])
    ]
  };
}
