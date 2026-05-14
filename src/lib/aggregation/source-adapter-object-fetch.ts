import crypto from "node:crypto";
import { recordAuditEvent } from "@/lib/audit-events";
import { loadSourceAdapterManifestPayload } from "@/lib/aggregation/source-adapter-payload-loader";
import { getSourceAdapterManifestReadiness } from "@/lib/aggregation/source-adapter-manifests";
import type {
  ImportRecordInput,
  SourceAdapterManifestFetchWorkerManifestSummary,
  SourceAdapterManifestFetchWorkerInput,
  SourceAdapterManifestFetchWorkerResult,
  SourceAdapterManifestFetchInput,
  SourceAdapterManifestFetchResult
} from "@/lib/domain/imports";
import { getSourceAdapterStorageReadiness } from "@/lib/aggregation/source-adapter-storage-readiness";

const defaultMaxBytes = 2_500_000;

function assertHttpsUrl(fileUrl?: string): string {
  if (!fileUrl) {
    throw new Error("Manifest fileUrl is required for signed object fetch execution");
  }

  const parsed = new URL(fileUrl);

  if (parsed.protocol !== "https:") {
    throw new Error("Signed object fetch executor only supports HTTPS signed URLs in this launch-safe adapter");
  }

  return parsed.toString();
}

function candidateRecordArrays(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : undefined;
  const candidates = [root.records, root.providers, root.data, data?.records, data?.providers, root.items, data?.items];

  return candidates.find((candidate): candidate is unknown[] => Array.isArray(candidate)) ?? [];
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));

  return normalized.length ? normalized : undefined;
}

function normalizeNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function normalizeFetchedRecord(rawRecord: unknown, index: number, fileUrl: string): ImportRecordInput {
  if (!rawRecord || typeof rawRecord !== "object") {
    throw new Error(`Fetched manifest record ${index + 1} is not an object`);
  }

  const record = rawRecord as Record<string, unknown>;
  const source = record.source && typeof record.source === "object" ? (record.source as Record<string, unknown>) : undefined;
  const name = normalizeString(record.name ?? record.providerName ?? record.title);

  if (!name) {
    throw new Error(`Fetched manifest record ${index + 1} is missing a provider name`);
  }

  return {
    name,
    categories: normalizeStringArray(record.categories),
    careTypes: normalizeStringArray(record.careTypes),
    addressLine1: normalizeString(record.addressLine1 ?? record.address),
    addressLine2: normalizeString(record.addressLine2),
    city: normalizeString(record.city),
    state: normalizeString(record.state),
    postalCode: normalizeString(record.postalCode ?? record.zip),
    county: normalizeString(record.county),
    latitude: normalizeNumber(record.latitude),
    longitude: normalizeNumber(record.longitude),
    phone: normalizeString(record.phone),
    email: normalizeString(record.email),
    websiteUrl: normalizeString(record.websiteUrl ?? record.website),
    description: normalizeString(record.description ?? record.summary),
    amenities: normalizeStringArray(record.amenities),
    services: normalizeStringArray(record.services),
    sourceUrl: normalizeString(source?.url ?? record.sourceUrl) ?? fileUrl,
    sourceRecordId: normalizeString(record.sourceRecordId ?? record.id) ?? `${fileUrl}#${index + 1}`,
    fetchedAt: normalizeString(source?.fetchedAt ?? record.fetchedAt) ?? new Date().toISOString(),
    licenseTermsStatus: normalizeString(record.licenseTermsStatus) ?? "source_terms_reviewed",
    robotsDecision: normalizeString(record.robotsDecision) ?? "source_reviewed",
    extractionConfidence: normalizeNumber(record.extractionConfidence ?? record.confidenceScore ?? source?.confidence),
    confidenceScore: normalizeNumber(record.confidenceScore ?? record.extractionConfidence ?? source?.confidence),
    rawPayload: {
      signedObjectFetchSource: fileUrl,
      fetchedRecord: record
    },
    extractedFields: {
      signedObjectFetchIndex: index,
      signedObjectFetchRecordId: normalizeString(record.id)
    },
    auditTrail: [
      {
        at: new Date().toISOString(),
        actor: "source-adapter-signed-object-fetch-executor",
        action: "source_adapter_signed_object_record_fetched",
        notes: `Fetched record ${index + 1} from verified HTTPS manifest object.`
      }
    ]
  };
}

async function fetchManifestBytes(fileUrl: string, maxBytes: number): Promise<Uint8Array> {
  const response = await fetch(fileUrl, {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Manifest object fetch failed with ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new Error("Signed object fetch executor only accepts JSON manifest payloads");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > maxBytes) {
    throw new Error(`Manifest object is ${bytes.byteLength} bytes, over the ${maxBytes} byte safety limit`);
  }

  return bytes;
}

export async function runSourceAdapterManifestFetch(
  input: SourceAdapterManifestFetchInput
): Promise<SourceAdapterManifestFetchResult> {
  const readiness = await getSourceAdapterManifestReadiness();
  const manifest = readiness.manifests.find((item) => item.id === input.manifestId);

  if (!manifest) {
    throw new Error("Source adapter manifest not found");
  }

  if (manifest.status !== "ready") {
    throw new Error(manifest.blockers[0] ?? "Source adapter manifest is not ready for signed object fetch");
  }

  const fileUrl = assertHttpsUrl(manifest.fileUrl);
  const maxBytes = Math.max(1_000, Math.min(Number(input.maxBytes ?? defaultMaxBytes), 10_000_000));
  const dryRun = input.dryRun ?? true;
  const bytes = await fetchManifestBytes(fileUrl, maxBytes);
  const checksumSha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  if (checksumSha256 !== manifest.checksumSha256.toLowerCase()) {
    throw new Error("Fetched manifest checksum does not match registered checksumSha256");
  }

  const payload = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  const records = candidateRecordArrays(payload).map((record, index) => normalizeFetchedRecord(record, index, fileUrl));

  if (!records.length) {
    throw new Error("Fetched manifest JSON did not contain records, providers, data.records, or data.providers");
  }

  const importResult = await loadSourceAdapterManifestPayload({
    manifestId: manifest.id,
    records,
    dryRun,
    actorId: input.actorId,
    batchName: input.batchName ?? `${manifest.fileName} signed object fetch`
  });
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "admin" : "system",
    eventType: "source_adapter_manifest.signed_object_fetch_executed",
    subjectType: "source_adapter_manifest",
    subjectId: manifest.id,
    payload: {
      fileName: manifest.fileName,
      fileUrl,
      dryRun,
      bytesFetched: bytes.byteLength,
      checksumSha256,
      recordsFetched: records.length,
      recordCountMatchesManifest: records.length === manifest.recordCount,
      importBatchId: importResult.importResult.batch.id,
      importRunStatus: importResult.importResult.run.status
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    manifest,
    dryRun,
    fileUrl,
    bytesFetched: bytes.byteLength,
    checksumSha256,
    recordsFetched: records.length,
    recordCountMatchesManifest: records.length === manifest.recordCount,
    importResult: importResult.importResult,
    auditEventId: auditEvent.id,
    nextActions: [
      ...(records.length === manifest.recordCount ? ["Fetched record count matched the registered manifest."] : []),
      ...(records.length !== manifest.recordCount ? ["Review record count mismatch before scheduled non-dry-run fetch execution."] : []),
      ...(dryRun ? ["Review dry-run import coverage before enabling live scheduled signed object fetching."] : []),
      ...(!dryRun ? ["Review staged records in the extracted entity queue before publication approval."] : [])
    ]
  };
}

function normalizeMaxManifests(maxManifests?: number) {
  if (!Number.isFinite(maxManifests)) return undefined;
  const rounded = Math.floor(Number(maxManifests));
  return rounded > 0 ? Math.min(rounded, 25) : undefined;
}

function emptyWorkerTotals() {
  return {
    recordsFetched: 0,
    totalRecords: 0,
    stagedRecords: 0,
    skippedRecords: 0,
    rejectedRecords: 0,
    errorRecords: 0
  };
}

function addFetchRunTotals(totals: ReturnType<typeof emptyWorkerTotals>, run?: SourceAdapterManifestFetchResult) {
  if (!run) return;

  totals.recordsFetched += run.recordsFetched;
  totals.totalRecords += run.importResult.run.totalRecords;
  totals.stagedRecords += run.importResult.run.stagedRecords;
  totals.skippedRecords += run.importResult.run.skippedRecords;
  totals.rejectedRecords += run.importResult.run.rejectedRecords;
  totals.errorRecords += run.importResult.run.errorRecords;
}

export async function runSourceAdapterManifestFetchWorker(
  input: SourceAdapterManifestFetchWorkerInput = {}
): Promise<SourceAdapterManifestFetchWorkerResult> {
  const dryRun = input.dryRun ?? true;
  const maxManifests = normalizeMaxManifests(input.maxManifests);
  const readiness = await getSourceAdapterStorageReadiness();
  const manifests = maxManifests ? readiness.manifests.slice(0, maxManifests) : readiness.manifests;
  const summaries: SourceAdapterManifestFetchWorkerManifestSummary[] = [];
  const blockers: string[] = [];
  const totals = emptyWorkerTotals();

  for (const manifest of manifests) {
    if (manifest.status === "blocked") {
      const reason = manifest.blockers[0] ?? "Source manifest is blocked by readiness gates.";
      blockers.push(`${manifest.fileName}: ${reason}`);
      summaries.push({
        manifestId: manifest.manifestId,
        dataSourceId: manifest.dataSourceId,
        dataSourceName: manifest.dataSourceName,
        fileName: manifest.fileName,
        fileUrl: manifest.fileUrl,
        status: manifest.status,
        action: "blocked",
        reason
      });
      continue;
    }

    if (manifest.status !== "fetch_ready") {
      const reason = "Manifest is manual-ready but does not have an HTTPS signed object URL.";
      summaries.push({
        manifestId: manifest.manifestId,
        dataSourceId: manifest.dataSourceId,
        dataSourceName: manifest.dataSourceName,
        fileName: manifest.fileName,
        fileUrl: manifest.fileUrl,
        status: manifest.status,
        action: "skipped",
        reason
      });
      continue;
    }

    try {
      const run = await runSourceAdapterManifestFetch({
        manifestId: manifest.manifestId,
        dryRun,
        actorId: input.actorId,
        maxBytes: input.maxBytes,
        batchName: `${manifest.fileName} scheduled signed object fetch`
      });
      addFetchRunTotals(totals, run);
      summaries.push({
        manifestId: manifest.manifestId,
        dataSourceId: manifest.dataSourceId,
        dataSourceName: manifest.dataSourceName,
        fileName: manifest.fileName,
        fileUrl: manifest.fileUrl,
        status: manifest.status,
        action: "executed",
        run
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown signed object fetch failure";
      blockers.push(`${manifest.fileName}: ${reason}`);
      summaries.push({
        manifestId: manifest.manifestId,
        dataSourceId: manifest.dataSourceId,
        dataSourceName: manifest.dataSourceName,
        fileName: manifest.fileName,
        fileUrl: manifest.fileUrl,
        status: manifest.status,
        action: "blocked",
        reason
      });
    }
  }

  const executedManifests = summaries.filter((summary) => summary.action === "executed").length;
  const skippedManifests = summaries.filter((summary) => summary.action === "skipped").length;
  const blockedManifests = summaries.filter((summary) => summary.action === "blocked").length;
  const fetchReadyManifests = summaries.filter((summary) => summary.status === "fetch_ready").length;

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    manifestsReviewed: summaries.length,
    fetchReadyManifests,
    executedManifests,
    skippedManifests,
    blockedManifests,
    totals,
    manifests: summaries,
    blockers,
    nextActions: [
      ...(executedManifests ? ["Review fetched manifest import coverage before enabling live scheduled fetch runs."] : []),
      ...(skippedManifests ? ["Use manual payload loading for manual-ready manifests or add HTTPS signed object URLs."] : []),
      ...(blockedManifests ? ["Resolve manifest readiness, checksum, mapping, and fetch failures before unattended execution."] : []),
      ...(!summaries.length ? ["Register verified source manifests before scheduling signed object fetches."] : [])
    ]
  };
}
