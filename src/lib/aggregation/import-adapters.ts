import { listDataSources } from "@/lib/data-sources";
import type { DataSourceRecord } from "@/lib/domain/providers";
import type { ImportAdapterMode, ImportAdapterReadinessItem, ImportAdapterReadinessSummary } from "@/lib/domain/imports";
import { listImportBatches } from "@/lib/import-batches";

const sourceAdapterConfig: Record<
  DataSourceRecord["sourceType"],
  {
    adapterKey: string;
    mode: ImportAdapterMode;
    supportedActions: string[];
    requiredFields: string[];
    liveBlocker?: string;
  }
> = {
  cms: {
    adapterKey: "cms_care_compare_manual_export",
    mode: "manual_export",
    supportedActions: ["upload_csv_export", "stage_source_records", "run_quality_audit"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"],
    liveBlocker: "CMS live API ingestion is not enabled; use approved manual dataset exports for launch batches."
  },
  state_license: {
    adapterKey: "state_license_directory_manual_export",
    mode: "manual_export",
    supportedActions: ["upload_state_export", "normalize_license_fields", "run_quality_audit"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"],
    liveBlocker: "State license direct parser is not enabled; use reviewed state export files for launch batches."
  },
  manual: {
    adapterKey: "owner_controlled_inventory_import",
    mode: "manual_export",
    supportedActions: ["run_current_site_preview", "run_current_site_import", "stage_source_records"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"]
  },
  provider_website: {
    adapterKey: "provider_website_crawler_parser",
    mode: "crawler_parser",
    supportedActions: ["create_crawl_job", "review_robots", "stage_extracted_entities"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"],
    liveBlocker: "Provider website extraction parser is still gated behind crawler review and source-specific extraction rules."
  },
  rss: {
    adapterKey: "rss_content_adapter",
    mode: "not_supported",
    supportedActions: ["register_source", "review_terms"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"],
    liveBlocker: "RSS sources are reserved for newsroom intake and are not valid provider listing import adapters."
  },
  vendor: {
    adapterKey: "vendor_feed_adapter",
    mode: "vendor_feed",
    supportedActions: ["register_vendor", "review_contract", "map_feed_fields"],
    requiredFields: ["baseUrl", "jurisdiction", "robotsStatus", "termsNotes"],
    liveBlocker: "Vendor feeds require owner-approved contract, credential storage, and field mapping before import."
  }
};

function missingFields(source: DataSourceRecord, requiredFields: string[]) {
  return requiredFields.filter((field) => {
    if (field === "baseUrl") return !source.baseUrl;
    if (field === "jurisdiction") return !source.jurisdiction;
    if (field === "robotsStatus") return !source.robotsStatus;
    if (field === "termsNotes") return !source.termsNotes;
    return false;
  });
}

function buildAdapterItem(source: DataSourceRecord, existingBatches: number): ImportAdapterReadinessItem {
  const config = sourceAdapterConfig[source.sourceType];
  const missing = missingFields(source, config.requiredFields);
  const sourceBlockers = [
    ...(source.reviewStatus !== "approved" ? [`Source review status is ${source.reviewStatus}, not approved.`] : []),
    ...(source.robotsStatus === "blocked" || source.robotsStatus === "disallowed" ? ["Robots policy blocks import use."] : []),
    ...missing.map((field) => `Source is missing ${field}.`)
  ];
  const liveBlockers = config.liveBlocker ? [config.liveBlocker] : [];
  const blockers = [...sourceBlockers, ...liveBlockers];
  const sourceReady = sourceBlockers.length === 0;
  const status =
    !sourceReady || config.mode === "not_supported" || config.mode === "vendor_feed"
      ? "blocked"
      : config.liveBlocker
        ? "manual_ready"
        : "ready";

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.sourceType,
    adapterKey: config.adapterKey,
    mode: config.mode,
    status,
    reviewStatus: source.reviewStatus,
    jurisdiction: source.jurisdiction,
    baseUrl: source.baseUrl,
    existingBatches,
    supportedActions: config.supportedActions,
    requiredFields: config.requiredFields,
    blockers,
    nextActions: [
      ...(sourceReady && status === "ready" ? ["Adapter is ready for launch import execution."] : []),
      ...(sourceReady && status === "manual_ready" ? ["Use manual export/import batches while live parser work remains blocked."] : []),
      ...(!sourceReady ? ["Complete source approval, robots, terms, and jurisdiction review before import."] : []),
      ...(existingBatches === 0 && sourceReady && status !== "blocked" ? ["Create a launch starter import batch for this source."] : []),
      ...(config.mode === "vendor_feed" ? ["Park vendor credentials and contract approval as owner-dependent before live import."] : [])
    ]
  };
}

export async function getImportAdapterReadiness(): Promise<ImportAdapterReadinessSummary> {
  const [sources, batches] = await Promise.all([listDataSources(), listImportBatches()]);
  const batchesBySource = new Map<string, number>();

  for (const batch of batches) {
    if (batch.dataSourceId) {
      batchesBySource.set(batch.dataSourceId, (batchesBySource.get(batch.dataSourceId) ?? 0) + 1);
    }
  }

  const adapters = sources.map((source) => buildAdapterItem(source, batchesBySource.get(source.id) ?? 0));
  const blockers = adapters.flatMap((adapter) =>
    adapter.blockers.map((blocker) => `${adapter.sourceName}: ${blocker}`)
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      sources: adapters.length,
      ready: adapters.filter((adapter) => adapter.status === "ready").length,
      manualReady: adapters.filter((adapter) => adapter.status === "manual_ready").length,
      blocked: adapters.filter((adapter) => adapter.status === "blocked").length,
      existingBatches: batches.length
    },
    adapters,
    blockers,
    nextActions: [
      ...(adapters.some((adapter) => adapter.status === "ready" || adapter.status === "manual_ready")
        ? ["Create or run launch import batches for ready/manual-ready adapters."]
        : []),
      ...(blockers.length ? ["Resolve adapter blockers before enabling unattended CMS, state, provider website, RSS, or vendor imports."] : []),
      ...(!adapters.length ? ["Register and approve data sources before import adapter readiness can be evaluated."] : [])
    ]
  };
}
