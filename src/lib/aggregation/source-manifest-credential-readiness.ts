import { getSourceAdapterStorageReadiness } from "@/lib/aggregation/source-adapter-storage-readiness";
import type {
  SourceAdapterStorageReadinessItem,
  SourceAdapterStorageScheme,
  SourceManifestCredentialReadinessItem,
  SourceManifestCredentialReadinessSummary
} from "@/lib/domain/imports";

const credentialConfig: Partial<
  Record<
    SourceAdapterStorageScheme,
    {
      credentialReferenceKey: string;
      pathAllowListKey: string;
      ownerInputs: string;
    }
  >
> = {
  s3: {
    credentialReferenceKey: "SOURCE_MANIFEST_S3_CREDENTIAL_REF",
    pathAllowListKey: "SOURCE_MANIFEST_S3_PATH_ALLOWLIST",
    ownerInputs: "approved role ARN or vault reference, bucket/path allow-list, external ID policy, and checksum callback"
  },
  gcs: {
    credentialReferenceKey: "SOURCE_MANIFEST_GCS_CREDENTIAL_REF",
    pathAllowListKey: "SOURCE_MANIFEST_GCS_PATH_ALLOWLIST",
    ownerInputs: "approved service account or vault reference, bucket/path allow-list, rotation policy, and checksum callback"
  },
  azure_blob: {
    credentialReferenceKey: "SOURCE_MANIFEST_AZURE_CREDENTIAL_REF",
    pathAllowListKey: "SOURCE_MANIFEST_AZURE_PATH_ALLOWLIST",
    ownerInputs: "approved managed identity or vault reference, container/path allow-list, rotation policy, and checksum callback"
  },
  supabase_storage: {
    credentialReferenceKey: "SOURCE_MANIFEST_SUPABASE_STORAGE_CREDENTIAL_REF",
    pathAllowListKey: "SOURCE_MANIFEST_SUPABASE_STORAGE_PATH_ALLOWLIST",
    ownerInputs: "approved project reference, bucket policy, scoped service role reference, path allow-list, and checksum callback"
  }
};

const approvalKeys = [
  "SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED",
  "SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_BY",
  "SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_AT"
];

function envConfigured(key?: string) {
  return Boolean(key && process.env[key]?.trim());
}

function approvalState() {
  const approved = process.env.SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED === "true";
  const approvedBy = process.env.SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_BY?.trim() || undefined;
  const approvedAt = process.env.SOURCE_MANIFEST_OBJECT_CREDENTIALS_APPROVED_AT?.trim() || undefined;
  const approvedAtValid = Boolean(approvedAt && !Number.isNaN(Date.parse(approvedAt)));

  return {
    approved: approved && Boolean(approvedBy) && approvedAtValid,
    approvedBy,
    approvedAt,
    approvedAtValid,
    requiredEnv: approvalKeys
  };
}

function itemBlockers(
  manifest: SourceAdapterStorageReadinessItem,
  approval: ReturnType<typeof approvalState>
) {
  const schemeConfig = credentialConfig[manifest.scheme];
  const credentialReferenceConfigured = envConfigured(schemeConfig?.credentialReferenceKey);
  const pathAllowListConfigured = envConfigured(schemeConfig?.pathAllowListKey);
  const blockers = [...manifest.blockers];

  if (!manifest.ownerCredentialRequired && manifest.status === "manual_ready") {
    return blockers;
  }

  if (!manifest.ownerCredentialRequired) {
    return blockers;
  }

  if (!schemeConfig) {
    blockers.push("Manifest scheme requires credentials but has no supported credential reference contract.");
    return blockers;
  }

  if (!credentialReferenceConfigured) {
    blockers.push(`${schemeConfig.credentialReferenceKey} is not configured with an owner-approved credential reference.`);
  }

  if (!pathAllowListConfigured) {
    blockers.push(`${schemeConfig.pathAllowListKey} is not configured with an owner-approved object path allow-list.`);
  }

  if (!approval.approved) {
    blockers.push("Source manifest object credentials are not owner-approved for live fetch execution.");
  }

  return blockers;
}

function nextActionsForItem(
  manifest: SourceAdapterStorageReadinessItem,
  blockers: string[],
  approval: ReturnType<typeof approvalState>
) {
  const schemeConfig = credentialConfig[manifest.scheme];

  if (!blockers.length && manifest.ownerCredentialRequired) {
    return ["Run the scheduled signed-object fetch worker in preview mode, then request live cron approval."];
  }

  if (!manifest.ownerCredentialRequired && manifest.status === "fetch_ready") {
    return ["Run the HTTPS signed-object fetch executor with checksum verification."];
  }

  if (!manifest.ownerCredentialRequired && manifest.status === "manual_ready") {
    return ["Use the verified manual payload loader until an owner-controlled object source is configured."];
  }

  return [
    ...(schemeConfig ? [`Collect ${schemeConfig.ownerInputs}.`] : []),
    ...(!approval.approved ? ["Record owner approval metadata before enabling live object-store fetch execution."] : []),
    "Keep cron execution in preview mode until every blocked manifest is resolved."
  ];
}

function readinessItem(
  manifest: SourceAdapterStorageReadinessItem,
  approval: ReturnType<typeof approvalState>
): SourceManifestCredentialReadinessItem {
  const schemeConfig = credentialConfig[manifest.scheme];
  const blockers = itemBlockers(manifest, approval);
  const status: SourceManifestCredentialReadinessItem["status"] = blockers.length
    ? "blocked"
    : manifest.ownerCredentialRequired || manifest.status === "fetch_ready"
      ? "live_ready"
      : "manual_ready";

  return {
    manifestId: manifest.manifestId,
    dataSourceId: manifest.dataSourceId,
    dataSourceName: manifest.dataSourceName,
    sourceType: manifest.sourceType,
    fileName: manifest.fileName,
    fileUrl: manifest.fileUrl,
    scheme: manifest.scheme,
    storageStatus: manifest.storageStatus,
    mappingStatus: manifest.mappingStatus,
    fetchStatus: manifest.status,
    credentialReferenceRequired: manifest.ownerCredentialRequired,
    credentialReferenceKey: schemeConfig?.credentialReferenceKey,
    credentialReferenceConfigured: envConfigured(schemeConfig?.credentialReferenceKey),
    pathAllowListKey: schemeConfig?.pathAllowListKey,
    pathAllowListConfigured: envConfigured(schemeConfig?.pathAllowListKey),
    checksumRequired: true,
    ownerApprovalRequired: manifest.ownerCredentialRequired,
    ownerApprovalConfigured: approval.approved,
    status,
    blockers,
    nextActions: nextActionsForItem(manifest, blockers, approval)
  };
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function getSourceManifestCredentialReadiness(): Promise<SourceManifestCredentialReadinessSummary> {
  const [storageReadiness, approval] = await Promise.all([getSourceAdapterStorageReadiness(), approvalState()]);
  const manifests = storageReadiness.manifests.map((manifest) => readinessItem(manifest, approval));
  const blockers = manifests.flatMap((item) => item.blockers.map((blocker) => `${item.fileName}: ${blocker}`));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      manifests: manifests.length,
      liveReady: manifests.filter((item) => item.status === "live_ready").length,
      manualReady: manifests.filter((item) => item.status === "manual_ready").length,
      blocked: manifests.filter((item) => item.status === "blocked").length,
      credentialReferencesRequired: manifests.filter((item) => item.credentialReferenceRequired).length,
      credentialReferencesConfigured: manifests.filter((item) => item.credentialReferenceConfigured).length,
      pathAllowListsConfigured: manifests.filter((item) => item.pathAllowListConfigured).length
    },
    approval,
    manifests,
    blockers,
    nextActions: [
      ...(manifests.some((item) => item.status === "live_ready")
        ? ["Run live-ready manifests through the signed-object fetch executor in preview mode before requesting cron live mode."]
        : []),
      ...(manifests.some((item) => item.status === "manual_ready")
        ? ["Keep using the manual payload loader for manifests that do not require object-store credentials."]
        : []),
      ...(blockers.length
        ? ["Park owner credential and allow-list collection until production source-object owners provide approved references."]
        : []),
      ...(!manifests.length ? ["Register source adapter manifests before collecting production source-object credentials."] : [])
    ]
  };
}

export async function exportSourceManifestCredentialReadinessCsv() {
  const dashboard = await getSourceManifestCredentialReadiness();
  const headers = [
    "manifestId",
    "fileName",
    "scheme",
    "status",
    "fetchStatus",
    "credentialReferenceRequired",
    "credentialReferenceKey",
    "credentialReferenceConfigured",
    "pathAllowListKey",
    "pathAllowListConfigured",
    "ownerApprovalConfigured",
    "blockers",
    "nextActions"
  ];
  const rows = dashboard.manifests.map((item) => headers.map((header) => csvCell(item[header as keyof SourceManifestCredentialReadinessItem])).join(","));
  const blockerRows = dashboard.blockers.map((blocker) => ["blocker", "", "", "blocked", "", "", "", "", "", "", "", blocker, ""].map(csvCell).join(","));
  const actionRows = dashboard.nextActions.map((action) => ["next_action", "", "", "", "", "", "", "", "", "", "", "", action].map(csvCell).join(","));

  return {
    filename: `senior-guru-source-manifest-credential-readiness-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [headers.join(","), ...rows, ...blockerRows, ...actionRows].join("\n")
  };
}
