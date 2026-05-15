import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getCredentialSmokeEvidence } from "@/lib/system/credential-smoke-evidence";

export type CredentialEvidenceRetentionFormat = "json" | "csv";

export type CredentialEvidenceRetentionInput = {
  actorId?: string;
  dryRun?: boolean;
  retentionDays?: number;
  limit?: number;
  notes?: string;
  format?: CredentialEvidenceRetentionFormat;
};

export type CredentialEvidenceRetentionResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  dryRun: boolean;
  retentionDays: number;
  retentionCutoff: string;
  status: "preview" | "blocked";
  currentEvidenceStatus: "passed" | "blocked" | "warning";
  currentEvidenceTotals: {
    credentials: number;
    installed: number;
    blocked: number;
    warnings: number;
  };
  totals: {
    archivedEvents: number;
    retained: number;
    retentionCandidates: number;
    blockedArchives: number;
    warningArchives: number;
  };
  retentionCandidates: CredentialEvidenceRetentionEvent[];
  recentArchives: CredentialEvidenceRetentionEvent[];
  blockers: string[];
  nextActions: string[];
  auditEvent?: OperationalAuditEvent;
  csv?: string;
};

export type CredentialEvidenceRetentionEvent = {
  id: string;
  createdAt: string;
  actorId?: string;
  status: string;
  dryRun: boolean;
  environment?: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  credentialCount: number;
  blockedCount: number;
  notes?: string;
};

const credentialEvidenceEventType = "credential_smoke_evidence.archived";
const retentionReviewEventType = "credential_evidence_retention.reviewed";

function retentionCutoffFor(days = 2555) {
  const retentionDays = Math.max(30, Math.min(Number(days), 3650));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

  return { retentionDays, retentionCutoff: cutoff.toISOString() };
}

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function payloadString(event: OperationalAuditEvent, key: string) {
  const value = event.payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function payloadBoolean(event: OperationalAuditEvent, key: string) {
  return event.payload[key] === true;
}

function payloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapCredentialEvidenceEvent(event: OperationalAuditEvent): CredentialEvidenceRetentionEvent {
  const totals = event.payload.totals && typeof event.payload.totals === "object" ? (event.payload.totals as Record<string, unknown>) : {};

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorId: event.actorId,
    status: payloadString(event, "status") ?? "unknown",
    dryRun: payloadBoolean(event, "dryRun"),
    environment: payloadString(event, "environment"),
    activeDeploymentUrl: payloadString(event, "activeDeploymentUrl"),
    commitSha: payloadString(event, "commitSha"),
    credentialCount: payloadNumber(totals.credentials),
    blockedCount: payloadNumber(totals.blocked),
    notes: payloadString(event, "notes")
  };
}

function evidenceEventsToCsv(result: CredentialEvidenceRetentionResult) {
  const headers = [
    "id",
    "createdAt",
    "status",
    "dryRun",
    "environment",
    "activeDeploymentUrl",
    "commitSha",
    "credentialCount",
    "blockedCount",
    "retentionCandidate",
    "notes"
  ];
  const candidateIds = new Set(result.retentionCandidates.map((event) => event.id));
  const rows = result.recentArchives.map((event) =>
    [
      event.id,
      event.createdAt,
      event.status,
      event.dryRun ? "true" : "false",
      event.environment ?? "",
      event.activeDeploymentUrl ?? "",
      event.commitSha ?? "",
      event.credentialCount,
      event.blockedCount,
      candidateIds.has(event.id) ? "true" : "false",
      event.notes ?? ""
    ]
      .map(csvEscape)
      .join(",")
  );
  const blockerRows = result.blockers.map((blocker) =>
    ["blocker", "", "blocked", "", "", "", "", "", "", "", blocker].map(csvEscape).join(",")
  );
  const actionRows = result.nextActions.map((action) =>
    ["next_action", "", "", "", "", "", "", "", "", "", action].map(csvEscape).join(",")
  );

  return [headers.join(","), ...rows, ...blockerRows, ...actionRows].join("\n");
}

export async function getCredentialEvidenceRetentionDashboard(
  input: CredentialEvidenceRetentionInput = {}
): Promise<CredentialEvidenceRetentionResult> {
  const dryRun = input.dryRun ?? true;
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 250));
  const { retentionDays, retentionCutoff } = retentionCutoffFor(input.retentionDays);
  const [auditSummary, currentEvidence] = await Promise.all([
    listAuditEvents({ eventType: credentialEvidenceEventType, subjectType: "production_credentials", limit }),
    getCredentialSmokeEvidence("json")
  ]);
  const archiveEvents = auditSummary.events.map(mapCredentialEvidenceEvent);
  const retentionCandidates = archiveEvents.filter((event) => Date.parse(event.createdAt) < Date.parse(retentionCutoff));
  const blockers = [
    ...(!dryRun
      ? [
          "Live credential evidence purge is disabled until owner approval, legal hold rules, and archive storage location are approved."
        ]
      : [])
  ];
  const result: CredentialEvidenceRetentionResult = {
    generatedAt: new Date().toISOString(),
    source: auditSummary.source,
    dryRun,
    retentionDays,
    retentionCutoff,
    status: blockers.length ? "blocked" : "preview",
    currentEvidenceStatus: currentEvidence.status,
    currentEvidenceTotals: currentEvidence.totals,
    totals: {
      archivedEvents: archiveEvents.length,
      retained: archiveEvents.length - retentionCandidates.length,
      retentionCandidates: retentionCandidates.length,
      blockedArchives: archiveEvents.filter((event) => event.status === "blocked").length,
      warningArchives: archiveEvents.filter((event) => event.status === "warning").length
    },
    retentionCandidates,
    recentArchives: archiveEvents,
    blockers,
    nextActions: [
      ...(retentionCandidates.length
        ? ["Export credential evidence retention candidates and collect owner/legal approval before purge execution."]
        : ["No credential smoke evidence archives are older than the current retention cutoff in this window."]),
      ...(currentEvidence.status !== "passed"
        ? ["Resolve current credential smoke blockers before treating retention evidence as launch-ready."]
        : ["Keep credential smoke evidence archived after each production credential change."]),
      ...(!dryRun ? ["Keep live purge disabled and use this blocked review as approval evidence."] : [])
    ]
  };

  return input.format === "csv" ? { ...result, csv: evidenceEventsToCsv(result) } : result;
}

export async function reviewCredentialEvidenceRetention(input: CredentialEvidenceRetentionInput = {}) {
  const result = await getCredentialEvidenceRetentionDashboard(input);
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: retentionReviewEventType,
    subjectType: "production_credentials",
    subjectId: "credential-evidence-retention",
    payload: {
      status: result.status,
      dryRun: result.dryRun,
      notes: input.notes,
      retentionDays: result.retentionDays,
      retentionCutoff: result.retentionCutoff,
      totals: result.totals,
      currentEvidenceStatus: result.currentEvidenceStatus,
      currentEvidenceTotals: result.currentEvidenceTotals,
      blockers: result.blockers,
      generatedAt: result.generatedAt
    }
  });

  return { ...result, auditEvent };
}

export function summarizeCredentialEvidenceRetentionAudit(event: OperationalAuditEvent | undefined) {
  if (!event) return undefined;

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorId: event.actorId,
    status: typeof event.payload.status === "string" ? event.payload.status : "unknown",
    retentionDays: typeof event.payload.retentionDays === "number" ? event.payload.retentionDays : undefined
  };
}
