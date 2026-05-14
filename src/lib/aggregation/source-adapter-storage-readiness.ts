import { getSourceAdapterManifestReadiness } from "@/lib/aggregation/source-adapter-manifests";
import type {
  SourceAdapterManifestReadinessItem,
  SourceAdapterStorageReadinessItem,
  SourceAdapterStorageReadinessSummary,
  SourceAdapterStorageScheme
} from "@/lib/domain/imports";

function detectStorageScheme(fileUrl?: string): SourceAdapterStorageScheme {
  if (!fileUrl) {
    return "manual_upload";
  }

  const normalized = fileUrl.trim().toLowerCase();

  if (normalized.startsWith("https://")) {
    return "https";
  }

  if (normalized.startsWith("s3://")) {
    return "s3";
  }

  if (normalized.startsWith("gs://") || normalized.startsWith("gcs://")) {
    return "gcs";
  }

  if (
    normalized.startsWith("az://") ||
    normalized.startsWith("azure://") ||
    normalized.startsWith("abfs://") ||
    normalized.startsWith("wasbs://")
  ) {
    return "azure_blob";
  }

  if (normalized.startsWith("supabase://") || normalized.startsWith("supabase-storage://")) {
    return "supabase_storage";
  }

  return "unknown";
}

function storageBlockers(manifest: SourceAdapterManifestReadinessItem, scheme: SourceAdapterStorageScheme) {
  const baseBlockers = manifest.blockers;

  if (baseBlockers.length) {
    return baseBlockers;
  }

  if (scheme === "manual_upload" || scheme === "https") {
    return [];
  }

  if (scheme === "s3") {
    return [
      "S3 object-store fetch is blocked until the owner provides an allowed role ARN, bucket/path policy, and checksum verification callback."
    ];
  }

  if (scheme === "gcs") {
    return [
      "GCS object-store fetch is blocked until the owner provides a service account, bucket/path allow-list, and checksum verification callback."
    ];
  }

  if (scheme === "azure_blob") {
    return [
      "Azure Blob object-store fetch is blocked until the owner provides a storage identity, container/path allow-list, and checksum verification callback."
    ];
  }

  if (scheme === "supabase_storage") {
    return [
      "Supabase Storage fetch is blocked until the owner confirms the bucket policy, service role scope, and checksum verification callback."
    ];
  }

  return ["Manifest fileUrl uses an unsupported storage scheme."];
}

function nextActionsForItem(
  status: SourceAdapterStorageReadinessItem["status"],
  scheme: SourceAdapterStorageScheme
) {
  if (status === "manual_ready") {
    return ["Use the manifest payload loader with supplied records after operator checksum review."];
  }

  if (status === "fetch_ready") {
    return ["Run the object-storage fetch executor for this manifest."];
  }

  if (scheme === "s3") {
    return ["Collect S3 owner role, bucket/path allow-list, and enable the signed object fetch adapter."];
  }

  if (scheme === "gcs") {
    return ["Collect GCS owner service account, bucket/path allow-list, and enable the signed object fetch adapter."];
  }

  if (scheme === "azure_blob") {
    return ["Collect Azure Storage identity, container/path allow-list, and enable the signed object fetch adapter."];
  }

  if (scheme === "supabase_storage") {
    return ["Confirm Supabase Storage bucket policy, object path, and service role scope before enabling fetch."];
  }

  return ["Resolve manifest readiness blockers before payload loading or object fetch execution."];
}

function buildStorageReadinessItem(manifest: SourceAdapterManifestReadinessItem): SourceAdapterStorageReadinessItem {
  const scheme = detectStorageScheme(manifest.fileUrl);
  const blockers = storageBlockers(manifest, scheme);
  const ownerCredentialRequired = ["s3", "gcs", "azure_blob", "supabase_storage"].includes(scheme);
  const status: SourceAdapterStorageReadinessItem["status"] =
    blockers.length > 0 ? "blocked" : scheme === "https" ? "fetch_ready" : "manual_ready";

  return {
    manifestId: manifest.id,
    dataSourceId: manifest.dataSourceId,
    dataSourceName: manifest.dataSourceName,
    sourceType: manifest.sourceType,
    fileName: manifest.fileName,
    fileUrl: manifest.fileUrl,
    payloadKind: manifest.payloadKind,
    scheme,
    status,
    storageStatus: manifest.storageStatus,
    mappingStatus: manifest.mappingStatus,
    ownerCredentialRequired,
    blockers,
    nextActions: nextActionsForItem(status, scheme)
  };
}

export async function getSourceAdapterStorageReadiness(): Promise<SourceAdapterStorageReadinessSummary> {
  const readiness = await getSourceAdapterManifestReadiness();
  const manifests = readiness.manifests.map(buildStorageReadinessItem);
  const blockers = manifests.flatMap((item) => item.blockers.map((blocker) => `${item.fileName}: ${blocker}`));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      manifests: manifests.length,
      fetchReady: manifests.filter((item) => item.status === "fetch_ready").length,
      manualReady: manifests.filter((item) => item.status === "manual_ready").length,
      blocked: manifests.filter((item) => item.status === "blocked").length,
      ownerCredentialRequired: manifests.filter((item) => item.ownerCredentialRequired).length
    },
    manifests,
    blockers,
    nextActions: [
      ...(manifests.some((item) => item.status === "manual_ready")
        ? ["Use verified manifest payload loading for manual and public-URL exports until signed object fetchers are enabled."]
        : []),
      ...(manifests.some((item) => item.ownerCredentialRequired)
        ? ["Collect owner-controlled object-storage credentials and path allow-lists before enabling unattended fetch execution."]
        : []),
      ...(blockers.length ? ["Keep scheduled object-storage fetching disabled for blocked manifests."] : []),
      ...(!manifests.length ? ["Register source adapter file manifests before evaluating object-storage fetch readiness."] : [])
    ]
  };
}
