import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getCredentialInstallationRunbook } from "@/lib/system/credential-installation";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getDnsCutoverApprovalSummary } from "@/lib/system/dns-cutover-approval";
import { getLinkHealthSummary } from "@/lib/system/link-health";
import { getPersistenceStatus } from "@/lib/system/persistence";
import { getProductionCutoverReadiness } from "@/lib/system/production-cutover";
import { getRollbackEvidence } from "@/lib/system/rollback-evidence";

export type PostCutoverMonitorStatus = "passed" | "blocked" | "warning";

export type PostCutoverMonitorProbe = {
  key: string;
  label: string;
  status: "passed" | "blocked" | "warning";
  evidence: Record<string, unknown>;
  blockers: string[];
  nextActions: string[];
};

export type PostCutoverMonitorRunInput = {
  actorId?: string;
  dryRun?: boolean;
  notes?: string;
};

export type PostCutoverMonitorRun = {
  generatedAt: string;
  status: PostCutoverMonitorStatus;
  dryRun: boolean;
  environment: string;
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  probes: PostCutoverMonitorProbe[];
  blockers: string[];
  nextActions: string[];
  latestAuditEvent?: OperationalAuditEvent;
};

const monitorEventType = "post_cutover_monitor.run_recorded";
const targetDomain = "https://theseniorguru.com";

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function probeStatus(blockers: string[], warnings: string[] = []): PostCutoverMonitorProbe["status"] {
  if (blockers.length) return "blocked";
  if (warnings.length) return "warning";
  return "passed";
}

function getStringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getBooleanPayload(payload: Record<string, unknown>, key: string) {
  return payload[key] === true;
}

function getStringArrayPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

async function getLatestMonitorAuditEvent() {
  const summary = await listAuditEvents({ eventType: monitorEventType, subjectType: "production_cutover", limit: 1 });
  return summary.events[0];
}

export async function getPostCutoverMonitor(dryRun = true): Promise<PostCutoverMonitorRun> {
  const [deployment, cutover, dnsApproval, credentialRunbook, rollbackEvidence, linkHealth, latestAuditEvent] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getProductionCutoverReadiness(),
    getDnsCutoverApprovalSummary(),
    getCredentialInstallationRunbook(),
    getRollbackEvidence(),
    Promise.resolve(getLinkHealthSummary()),
    getLatestMonitorAuditEvent()
  ]);
  const persistence = getPersistenceStatus();
  const canonicalWarnings = deployment.canonicalUrl === targetDomain ? [] : ["Canonical URL is not yet the final theseniorguru.com domain."];
  const dnsBlockers = dnsApproval.latestApproval?.status === "approved_ready_for_dns" ? [] : ["Owner DNS cutover approval is not ready_for_dns."];
  const persistenceBlockers = persistence.durableAcrossDeploys ? [] : ["Supabase persistence is not active for production writes."];
  const credentialBlockers = credentialRunbook.blockers;
  const rollbackBlockers = rollbackEvidence.status === "ready_to_archive" ? [] : ["Rollback evidence still includes unresolved launch blockers."];
  const linkBlockers = linkHealth.status === "passed" ? [] : [`Link health is ${linkHealth.status}.`];

  const probes: PostCutoverMonitorProbe[] = [
    {
      key: "production_deployment",
      label: "Production deployment and canonical target",
      status: probeStatus(deployment.activeDeploymentUrl ? [] : ["No active production deployment URL is visible."], canonicalWarnings),
      evidence: {
        canonicalUrl: deployment.canonicalUrl,
        targetDomain,
        activeDeploymentUrl: deployment.activeDeploymentUrl,
        environment: deployment.environment,
        commitSha: deployment.commitSha
      },
      blockers: deployment.activeDeploymentUrl ? [] : ["No active production deployment URL is visible."],
      nextActions: canonicalWarnings.length ? ["Set NEXT_PUBLIC_APP_URL to https://theseniorguru.com before final DNS cutover."] : []
    },
    {
      key: "dns_approval",
      label: "Owner DNS approval evidence",
      status: probeStatus(dnsBlockers),
      evidence: {
        latestApprovalStatus: dnsApproval.latestApproval?.status ?? "not_recorded",
        latestApprovalId: dnsApproval.latestApproval?.id,
        targetDomain: dnsApproval.targetDomain
      },
      blockers: dnsBlockers,
      nextActions: dnsBlockers.length ? ["Record final owner approval through /api/v1/system/dns-cutover-approval before DNS changes."] : []
    },
    {
      key: "persistent_database",
      label: "Persistent Supabase writes",
      status: probeStatus(persistenceBlockers),
      evidence: {
        mode: persistence.mode,
        durableAcrossDeploys: persistence.durableAcrossDeploys,
        configured: persistence.configured
      },
      blockers: persistenceBlockers,
      nextActions: persistenceBlockers.length ? persistence.ownerActions : []
    },
    {
      key: "credential_installation",
      label: "Credential installation runbook",
      status: probeStatus(credentialBlockers),
      evidence: {
        status: credentialRunbook.status,
        totalItems: credentialRunbook.items.length,
        installedItems: credentialRunbook.items.filter((item) => item.installed).length,
        latestReviewStatus: credentialRunbook.latestReview?.status
      },
      blockers: credentialBlockers,
      nextActions: credentialRunbook.nextActions
    },
    {
      key: "cutover_readiness",
      label: "Production cutover readiness",
      status: probeStatus(cutover.blockers),
      evidence: {
        status: cutover.status,
        checks: cutover.checks.length,
        ownerActions: cutover.ownerActions.length
      },
      blockers: cutover.blockers,
      nextActions: cutover.nextActions
    },
    {
      key: "rollback_evidence",
      label: "Rollback evidence archive",
      status: probeStatus(rollbackBlockers),
      evidence: {
        status: rollbackEvidence.status,
        rollbackSteps: rollbackEvidence.rollbackSteps.length,
        blockers: rollbackEvidence.blockers.length
      },
      blockers: rollbackBlockers,
      nextActions: rollbackEvidence.nextActions
    },
    {
      key: "link_health",
      label: "Route and link health",
      status: probeStatus(linkBlockers),
      evidence: {
        status: linkHealth.status,
        total: linkHealth.total,
        invalidCount: linkHealth.invalidCount
      },
      blockers: linkBlockers,
      nextActions: linkBlockers.length ? ["Fix invalid internal route contracts before and after DNS cutover."] : []
    }
  ];
  const blockers = uniq(probes.flatMap((probe) => probe.blockers));
  const warnings = probes.filter((probe) => probe.status === "warning").map((probe) => `${probe.label}: warning`);

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "passed",
    dryRun,
    environment: deployment.environment,
    targetDomain,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    commitSha: deployment.commitSha,
    probes,
    blockers,
    nextActions: uniq([
      ...(blockers.length ? ["Do not treat post-cutover monitoring as passing until all blockers are resolved."] : []),
      "Run this monitor immediately before DNS change, immediately after DNS propagation, and again after credential changes.",
      "Archive monitor audit evidence with the DNS cutover change record."
    ]),
    latestAuditEvent
  };
}

export async function recordPostCutoverMonitorRun(input: PostCutoverMonitorRunInput = {}): Promise<PostCutoverMonitorRun> {
  const monitor = await getPostCutoverMonitor(input.dryRun ?? true);
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: monitorEventType,
    subjectType: "production_cutover",
    subjectId: "post-cutover-monitor",
    payload: {
      status: monitor.status,
      dryRun: monitor.dryRun,
      notes: input.notes,
      environment: monitor.environment,
      targetDomain: monitor.targetDomain,
      activeDeploymentUrl: monitor.activeDeploymentUrl,
      commitSha: monitor.commitSha,
      blockerCount: monitor.blockers.length,
      blockers: monitor.blockers,
      probeStatuses: monitor.probes.map((probe) => ({ key: probe.key, status: probe.status })),
      nextActions: monitor.nextActions,
      generatedAt: monitor.generatedAt
    }
  });

  return { ...monitor, latestAuditEvent: auditEvent };
}

export function summarizeMonitorAudit(event: OperationalAuditEvent | undefined) {
  if (!event) return undefined;

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorId: event.actorId,
    status: getStringPayload(event.payload, "status") ?? "unknown",
    dryRun: getBooleanPayload(event.payload, "dryRun"),
    blockers: getStringArrayPayload(event.payload, "blockers")
  };
}
