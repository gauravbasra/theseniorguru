import { recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getCredentialSmokeEvidence } from "@/lib/system/credential-smoke-evidence";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getDnsCutoverApprovalSummary } from "@/lib/system/dns-cutover-approval";
import { getLinkHealthSummary } from "@/lib/system/link-health";
import { getPostCutoverMonitor } from "@/lib/system/post-cutover-monitor";
import { getProductionCutoverReadiness } from "@/lib/system/production-cutover";
import { getRollbackEvidence } from "@/lib/system/rollback-evidence";

export type CutoverChecklistPhase = "pre_change" | "dns_change" | "post_change" | "rollback";
export type CutoverChecklistStatus = "ready" | "blocked" | "owner_action_required";

export type CutoverChecklistStep = {
  key: string;
  phase: CutoverChecklistPhase;
  label: string;
  status: CutoverChecklistStatus;
  commandOrRoute: string;
  evidenceRequired: string;
  blockers: string[];
  nextActions: string[];
};

export type CutoverSmokeChecklistInput = {
  actorId?: string;
  dryRun?: boolean;
  notes?: string;
};

export type CutoverSmokeChecklist = {
  generatedAt: string;
  status: "ready" | "blocked";
  dryRun: boolean;
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  phases: Record<CutoverChecklistPhase, { total: number; ready: number; blocked: number; ownerActionRequired: number }>;
  steps: CutoverChecklistStep[];
  blockers: string[];
  nextActions: string[];
  auditEvent?: OperationalAuditEvent;
};

const targetDomain = "https://theseniorguru.com";

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function stepStatus(blockers: string[], ownerActions: string[] = []): CutoverChecklistStatus {
  if (blockers.length) return "blocked";
  if (ownerActions.length) return "owner_action_required";
  return "ready";
}

function summarizePhases(steps: CutoverChecklistStep[]): CutoverSmokeChecklist["phases"] {
  const phases: CutoverChecklistPhase[] = ["pre_change", "dns_change", "post_change", "rollback"];

  return phases.reduce((summary, phase) => {
    const phaseSteps = steps.filter((step) => step.phase === phase);
    summary[phase] = {
      total: phaseSteps.length,
      ready: phaseSteps.filter((step) => step.status === "ready").length,
      blocked: phaseSteps.filter((step) => step.status === "blocked").length,
      ownerActionRequired: phaseSteps.filter((step) => step.status === "owner_action_required").length
    };
    return summary;
  }, {} as CutoverSmokeChecklist["phases"]);
}

export async function getCutoverSmokeChecklist(dryRun = true): Promise<CutoverSmokeChecklist> {
  const [deployment, dnsApproval, cutover, rollback, monitor, credentialSmoke, linkHealth] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getDnsCutoverApprovalSummary(),
    getProductionCutoverReadiness(),
    getRollbackEvidence(),
    getPostCutoverMonitor(true),
    getCredentialSmokeEvidence(),
    Promise.resolve(getLinkHealthSummary())
  ]);
  const dnsApproved = dnsApproval.latestApproval?.status === "approved_ready_for_dns";
  const rollbackReady = rollback.status === "ready_to_archive";
  const monitorReady = monitor.status === "passed" || monitor.status === "warning";
  const credentialReady = credentialSmoke.status === "passed" || credentialSmoke.status === "warning";
  const linkReady = linkHealth.status === "passed";
  const deploymentReady = deployment.environment === "production" && Boolean(deployment.activeDeploymentUrl);
  const canonicalReady = deployment.canonicalUrl === targetDomain;

  const steps: CutoverChecklistStep[] = [
    {
      key: "archive_rollback_evidence",
      phase: "pre_change",
      label: "Archive rollback evidence bundle",
      status: stepStatus(rollbackReady ? [] : ["Rollback evidence still contains unresolved blockers."]),
      commandOrRoute: "GET /api/v1/system/rollback-evidence?format=csv",
      evidenceRequired: "CSV export attached to the DNS change record.",
      blockers: rollbackReady ? [] : ["Rollback evidence still contains unresolved blockers."],
      nextActions: rollbackReady ? [] : rollback.nextActions
    },
    {
      key: "archive_credential_smoke",
      phase: "pre_change",
      label: "Archive production credential smoke evidence",
      status: stepStatus(credentialReady ? [] : ["Credential smoke evidence is blocked."]),
      commandOrRoute: "POST /api/v1/system/credential-smoke-evidence",
      evidenceRequired: "Credential smoke audit event and CSV export after production credential install.",
      blockers: credentialReady ? [] : ["Credential smoke evidence is blocked."],
      nextActions: credentialReady ? [] : credentialSmoke.nextActions
    },
    {
      key: "run_pre_change_monitor",
      phase: "pre_change",
      label: "Run pre-change synthetic monitor",
      status: stepStatus(monitorReady ? [] : ["Post-cutover monitor is currently blocked."]),
      commandOrRoute: "POST /api/v1/system/post-cutover-monitor",
      evidenceRequired: "Dry-run monitor audit event before DNS record edits.",
      blockers: monitorReady ? [] : ["Post-cutover monitor is currently blocked."],
      nextActions: monitorReady ? [] : monitor.nextActions
    },
    {
      key: "owner_dns_approval",
      phase: "dns_change",
      label: "Confirm owner DNS approval and change window",
      status: stepStatus([], dnsApproved ? [] : ["Owner approval is not ready_for_dns."]),
      commandOrRoute: "POST /api/v1/system/dns-cutover-approval",
      evidenceRequired: "Approval event with change window, rollback acknowledgement, and owner notes.",
      blockers: [],
      nextActions: dnsApproved ? [] : ["Record final owner DNS approval before changing records."]
    },
    {
      key: "verify_deployment_target",
      phase: "dns_change",
      label: "Verify production deployment target",
      status: stepStatus(deploymentReady ? [] : ["Production deployment alias is not visible."]),
      commandOrRoute: "GET /api/v1/system/deployment",
      evidenceRequired: "Active Vercel deployment URL, production environment, and commit SHA.",
      blockers: deploymentReady ? [] : ["Production deployment alias is not visible."],
      nextActions: deploymentReady ? [] : ["Deploy and alias the latest production build before DNS cutover."]
    },
    {
      key: "set_canonical_domain",
      phase: "dns_change",
      label: "Set canonical theseniorguru.com app URL",
      status: stepStatus(canonicalReady ? [] : ["NEXT_PUBLIC_APP_URL is not the final theseniorguru.com domain."]),
      commandOrRoute: "Vercel Production env: NEXT_PUBLIC_APP_URL=https://theseniorguru.com",
      evidenceRequired: "Deployment status reports canonicalUrl=https://theseniorguru.com.",
      blockers: canonicalReady ? [] : ["NEXT_PUBLIC_APP_URL is not the final theseniorguru.com domain."],
      nextActions: canonicalReady ? [] : ["Set NEXT_PUBLIC_APP_URL to https://theseniorguru.com and redeploy before final DNS cutover."]
    },
    {
      key: "run_post_change_monitor",
      phase: "post_change",
      label: "Run immediate post-change synthetic monitor",
      status: stepStatus(monitorReady ? [] : ["Post-cutover monitor is currently blocked."]),
      commandOrRoute: "POST /api/v1/system/post-cutover-monitor",
      evidenceRequired: "Monitor audit event immediately after DNS propagation.",
      blockers: monitorReady ? [] : ["Post-cutover monitor is currently blocked."],
      nextActions: monitorReady ? [] : monitor.nextActions
    },
    {
      key: "verify_link_health",
      phase: "post_change",
      label: "Verify route and link health",
      status: stepStatus(linkReady ? [] : ["Link health is not passing."]),
      commandOrRoute: "GET /api/v1/system/link-health",
      evidenceRequired: "Link-health status passed with invalidCount=0.",
      blockers: linkReady ? [] : ["Link health is not passing."],
      nextActions: linkReady ? [] : ["Fix route contract issues before marking cutover complete."]
    },
    {
      key: "verify_cutover_readiness",
      phase: "post_change",
      label: "Recheck cutover readiness",
      status: stepStatus(cutover.blockers),
      commandOrRoute: "GET /api/v1/system/production-cutover",
      evidenceRequired: "Cutover readiness response after DNS change.",
      blockers: cutover.blockers,
      nextActions: cutover.nextActions
    },
    {
      key: "rollback_if_smoke_fails",
      phase: "rollback",
      label: "Rollback DNS or deployment if smoke checks fail",
      status: "owner_action_required",
      commandOrRoute: "GET /api/v1/system/rollback-evidence",
      evidenceRequired: "Rollback step selected, timestamp, operator, and failed probe output.",
      blockers: [],
      nextActions: [
        "If post-change monitor fails, restore previous DNS records or promote last known-good Vercel deployment.",
        "Archive failed monitor output and rerun rollback evidence export."
      ]
    }
  ];
  const blockers = uniq(steps.flatMap((step) => step.blockers));

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "ready",
    dryRun,
    targetDomain,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    commitSha: deployment.commitSha,
    phases: summarizePhases(steps),
    steps,
    blockers,
    nextActions: uniq([
      ...(blockers.length ? ["Do not execute DNS cutover until blocked checklist steps are resolved."] : []),
      "Run this checklist before the change window, during DNS edits, and after propagation.",
      "Attach checklist audit evidence to the owner DNS cutover record."
    ])
  };
}

export async function recordCutoverSmokeChecklist(input: CutoverSmokeChecklistInput = {}) {
  const checklist = await getCutoverSmokeChecklist(input.dryRun ?? true);
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: "dns_cutover.smoke_checklist_archived",
    subjectType: "production_cutover",
    subjectId: "dns-cutover-smoke-checklist",
    payload: {
      status: checklist.status,
      dryRun: checklist.dryRun,
      notes: input.notes,
      targetDomain: checklist.targetDomain,
      activeDeploymentUrl: checklist.activeDeploymentUrl,
      commitSha: checklist.commitSha,
      phases: checklist.phases,
      blockerCount: checklist.blockers.length,
      blockers: checklist.blockers,
      generatedAt: checklist.generatedAt
    }
  });

  return { ...checklist, auditEvent };
}
