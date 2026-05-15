import { recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getCredentialInstallationRunbook, type CredentialRunbookFormat } from "@/lib/system/credential-installation";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getPostCutoverMonitor } from "@/lib/system/post-cutover-monitor";

export type CredentialSmokeEvidenceRow = {
  key: string;
  family: string;
  installed: boolean;
  validation: string;
  validationStatus: "passed" | "blocked" | "warning";
  blocker?: string;
  evidenceSource: string;
};

export type CredentialSmokeEvidence = {
  generatedAt: string;
  status: "passed" | "blocked" | "warning";
  environment: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  totals: {
    credentials: number;
    installed: number;
    blocked: number;
    warnings: number;
  };
  rows: CredentialSmokeEvidenceRow[];
  blockers: string[];
  nextActions: string[];
  auditEvent?: OperationalAuditEvent;
  csv?: string;
};

export type CredentialSmokeEvidenceInput = {
  actorId?: string;
  dryRun?: boolean;
  notes?: string;
  format?: CredentialRunbookFormat;
};

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(evidence: CredentialSmokeEvidence) {
  const headers = ["key", "family", "installed", "validationStatus", "validation", "blocker", "evidenceSource"];
  const rows = evidence.rows.map((row) =>
    [row.key, row.family, row.installed ? "true" : "false", row.validationStatus, row.validation, row.blocker ?? "", row.evidenceSource]
      .map(csvEscape)
      .join(",")
  );
  const blockerRows = evidence.blockers.map((blocker) => ["blocker", "", "", "blocked", "", blocker, ""].map(csvEscape).join(","));
  const actionRows = evidence.nextActions.map((action) => ["next_action", "", "", "", "", action, ""].map(csvEscape).join(","));

  return [headers.join(","), ...rows, ...blockerRows, ...actionRows].join("\n");
}

function probeStatusForFamily(family: string, monitorStatus: "passed" | "blocked" | "warning") {
  if (family === "supabase") return "persistent_database";
  if (family === "auth" || family === "cron") return "production_deployment";
  if (family === "email" || family === "ads") return "credential_installation";
  return monitorStatus;
}

export async function getCredentialSmokeEvidence(format: CredentialRunbookFormat = "json"): Promise<CredentialSmokeEvidence> {
  const [deployment, runbook, monitor] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getCredentialInstallationRunbook(),
    getPostCutoverMonitor(true)
  ]);
  const rows = runbook.items.map((item): CredentialSmokeEvidenceRow => {
    const probeKey = probeStatusForFamily(item.family, monitor.status);
    const probe = typeof probeKey === "string" ? monitor.probes.find((candidate) => candidate.key === probeKey) : undefined;
    const validationStatus = item.installed ? (probe?.status ?? "passed") : "blocked";

    return {
      key: item.key,
      family: item.family,
      installed: item.installed,
      validation: item.validation,
      validationStatus,
      blocker: item.blocker ?? probe?.blockers[0],
      evidenceSource: probe ? `post_cutover_monitor:${probe.key}` : "credential_installation_runbook"
    };
  });
  const blockers = rows.filter((row) => row.validationStatus === "blocked").map((row) => row.blocker ?? `${row.key} validation is blocked.`);
  const warnings = rows.filter((row) => row.validationStatus === "warning");
  const evidence: CredentialSmokeEvidence = {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "passed",
    environment: deployment.environment,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    commitSha: deployment.commitSha,
    totals: {
      credentials: rows.length,
      installed: rows.filter((row) => row.installed).length,
      blocked: blockers.length,
      warnings: warnings.length
    },
    rows,
    blockers,
    nextActions: [
      ...(blockers.length ? ["Install missing credentials and rerun the credential smoke evidence export."] : []),
      "Archive this evidence after every production credential change.",
      "Rerun post-cutover monitor and protected production smoke checks after credential installation."
    ]
  };

  return format === "csv" ? { ...evidence, csv: rowsToCsv(evidence) } : evidence;
}

export async function recordCredentialSmokeEvidence(input: CredentialSmokeEvidenceInput = {}) {
  const evidence = await getCredentialSmokeEvidence(input.format ?? "json");
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: "credential_smoke_evidence.archived",
    subjectType: "production_credentials",
    subjectId: "credential-smoke-evidence",
    payload: {
      status: evidence.status,
      dryRun: input.dryRun ?? true,
      notes: input.notes,
      environment: evidence.environment,
      activeDeploymentUrl: evidence.activeDeploymentUrl,
      commitSha: evidence.commitSha,
      totals: evidence.totals,
      blockers: evidence.blockers,
      generatedAt: evidence.generatedAt
    }
  });

  return { ...evidence, auditEvent };
}
