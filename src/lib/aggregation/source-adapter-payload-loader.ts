import { runSourceAdapterImport } from "@/lib/aggregation/source-adapter-imports";
import { getSourceAdapterManifestReadiness } from "@/lib/aggregation/source-adapter-manifests";
import type {
  ImportRecordInput,
  SourceAdapterManifestPayloadLoadInput,
  SourceAdapterManifestPayloadLoadResult,
  SourceAdapterManifestReadinessItem
} from "@/lib/domain/imports";

function applyManifestToRecord(record: ImportRecordInput, manifest: SourceAdapterManifestReadinessItem): ImportRecordInput {
  const manifestPayload = {
    id: manifest.id,
    fileName: manifest.fileName,
    payloadKind: manifest.payloadKind,
    checksumSha256: manifest.checksumSha256,
    recordCount: manifest.recordCount
  };

  return {
    ...record,
    sourceRecordId: record.sourceRecordId ?? `${manifest.id}:${record.name ?? "record"}`,
    rawPayload: {
      ...(record.rawPayload ?? {}),
      sourceAdapterManifest: manifestPayload,
      sourceAdapterManifestFileUrl: manifest.fileUrl
    },
    extractedFields: {
      ...(record.extractedFields ?? {}),
      sourceAdapterManifestId: manifest.id,
      sourceAdapterManifestFileName: manifest.fileName,
      sourceAdapterManifestChecksumSha256: manifest.checksumSha256,
      sourceAdapterManifestPayloadKind: manifest.payloadKind
    },
    auditTrail: [
      ...(record.auditTrail ?? []),
      {
        at: new Date().toISOString(),
        actor: "source-adapter-manifest-payload-loader",
        action: "source_adapter_manifest_payload_bound",
        notes: `Bound payload record to ${manifest.fileName} manifest ${manifest.id}.`
      }
    ]
  };
}

export async function loadSourceAdapterManifestPayload(
  input: SourceAdapterManifestPayloadLoadInput
): Promise<SourceAdapterManifestPayloadLoadResult> {
  if (!Array.isArray(input.records) || !input.records.length) {
    throw new Error("records are required for manifest payload loading");
  }

  const readiness = await getSourceAdapterManifestReadiness();
  const manifest = readiness.manifests.find((item) => item.id === input.manifestId);

  if (!manifest) {
    throw new Error("Source adapter manifest not found");
  }

  if (manifest.status !== "ready") {
    throw new Error(manifest.blockers[0] ?? "Source adapter manifest is not ready for payload loading");
  }

  const dryRun = input.dryRun ?? true;
  const records = input.records.map((record) => applyManifestToRecord(record, manifest));
  const manifestPayload = {
    id: manifest.id,
    fileName: manifest.fileName,
    payloadKind: manifest.payloadKind,
    checksumSha256: manifest.checksumSha256,
    recordCount: manifest.recordCount
  };
  const importResult = await runSourceAdapterImport({
    dataSourceId: manifest.dataSourceId,
    records,
    dryRun,
    actorId: input.actorId,
    batchName: input.batchName ?? `${manifest.fileName} manifest payload load`,
    manifest: manifestPayload
  });
  const recordCountMatchesManifest = input.records.length === manifest.recordCount;

  return {
    generatedAt: new Date().toISOString(),
    manifest,
    dryRun,
    recordsProvided: input.records.length,
    recordCountMatchesManifest,
    importResult,
    nextActions: [
      ...(recordCountMatchesManifest ? ["Manifest payload count matched the registered file manifest."] : []),
      ...(!recordCountMatchesManifest ? ["Investigate record count mismatch before non-dry-run scheduled ingestion."] : []),
      ...(dryRun ? ["Review dry-run staged entities before running this manifest payload with dryRun=false."] : []),
      ...(!dryRun ? ["Review staged entities for duplicate, legal, and image-rights approvals before publication."] : [])
    ]
  };
}
