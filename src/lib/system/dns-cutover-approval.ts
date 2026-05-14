import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getDeploymentStatus } from "@/lib/system/deployment";
import type { ProductionCutoverReadiness } from "@/lib/system/production-cutover";

export type DnsCutoverApprovalStatus =
  | "review_recorded"
  | "deferred"
  | "approved_ready_for_dns"
  | "approved_pending_blocker_resolution";

export type DnsCutoverApprovalInput = {
  actorId?: string;
  ownerName?: string;
  ownerApproved?: boolean;
  targetDomain?: string;
  plannedWindowStart?: string;
  plannedWindowEnd?: string;
  rollbackAcknowledged?: boolean;
  approvalNotes?: string;
};

export type DnsCutoverApprovalRecord = {
  id: string;
  status: DnsCutoverApprovalStatus;
  actorId?: string;
  ownerName?: string;
  ownerApproved: boolean;
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  plannedWindowStart?: string;
  plannedWindowEnd?: string;
  rollbackAcknowledged: boolean;
  approvalNotes?: string;
  blockers: string[];
  nextActions: string[];
  auditEvent: OperationalAuditEvent;
};

export type DnsCutoverApprovalSummary = {
  generatedAt: string;
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  latestApproval?: DnsCutoverApprovalRecord;
  status: "not_recorded" | DnsCutoverApprovalStatus;
  blockers: string[];
  nextActions: string[];
};

const targetDomain = "https://theseniorguru.com";
const approvalEventType = "dns_cutover.approval_recorded";

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

function statusFromPayload(payload: Record<string, unknown>): DnsCutoverApprovalStatus {
  const status = payload.status;
  if (
    status === "review_recorded" ||
    status === "deferred" ||
    status === "approved_ready_for_dns" ||
    status === "approved_pending_blocker_resolution"
  ) {
    return status;
  }

  return "review_recorded";
}

function mapApprovalEvent(event: OperationalAuditEvent): DnsCutoverApprovalRecord {
  const payload = event.payload;

  return {
    id: event.id,
    status: statusFromPayload(payload),
    actorId: event.actorId,
    ownerName: getStringPayload(payload, "ownerName"),
    ownerApproved: getBooleanPayload(payload, "ownerApproved"),
    targetDomain: getStringPayload(payload, "targetDomain") ?? targetDomain,
    activeDeploymentUrl: getStringPayload(payload, "activeDeploymentUrl"),
    commitSha: getStringPayload(payload, "commitSha"),
    plannedWindowStart: getStringPayload(payload, "plannedWindowStart"),
    plannedWindowEnd: getStringPayload(payload, "plannedWindowEnd"),
    rollbackAcknowledged: getBooleanPayload(payload, "rollbackAcknowledged"),
    approvalNotes: getStringPayload(payload, "approvalNotes"),
    blockers: getStringArrayPayload(payload, "blockers"),
    nextActions: getStringArrayPayload(payload, "nextActions"),
    auditEvent: event
  };
}

export async function getLatestDnsCutoverApproval() {
  const summary = await listAuditEvents({ eventType: approvalEventType, subjectType: "production_cutover", limit: 1 });
  const latest = summary.events[0];

  return latest ? mapApprovalEvent(latest) : undefined;
}

export async function getDnsCutoverApprovalSummary(): Promise<DnsCutoverApprovalSummary> {
  const [deployment, latestApproval] = await Promise.all([Promise.resolve(getDeploymentStatus()), getLatestDnsCutoverApproval()]);
  const blockers = [
    ...(!latestApproval ? ["No owner DNS cutover approval record has been archived."] : []),
    ...(deployment.canonicalUrl === targetDomain ? [] : ["NEXT_PUBLIC_APP_URL does not match the final theseniorguru.com target."]),
    ...(deployment.persistenceMode === "supabase_persistent" ? [] : ["Supabase persistence is not active for production writes."])
  ];

  return {
    generatedAt: new Date().toISOString(),
    targetDomain,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    commitSha: deployment.commitSha,
    latestApproval,
    status: latestApproval?.status ?? "not_recorded",
    blockers,
    nextActions: [
      ...(latestApproval ? [] : ["Record owner DNS approval or deferral before changing DNS records."]),
      ...(blockers.length ? ["Keep DNS cutover paused until approval and production persistence blockers are resolved."] : []),
      "Archive rollback evidence and rerun production smoke immediately after DNS changes."
    ]
  };
}

export async function recordDnsCutoverApproval(
  input: DnsCutoverApprovalInput,
  readiness: ProductionCutoverReadiness
): Promise<DnsCutoverApprovalRecord> {
  const deployment = getDeploymentStatus();
  const ownerApproved = input.ownerApproved === true;
  const requestedTarget = input.targetDomain ?? targetDomain;
  const blockers = [
    ...(requestedTarget === targetDomain ? [] : [`targetDomain must be ${targetDomain}.`]),
    ...(ownerApproved && !input.rollbackAcknowledged ? ["Rollback evidence acknowledgement is required before owner approval can be archived."] : []),
    ...(ownerApproved ? readiness.blockers : [])
  ];
  const status: DnsCutoverApprovalStatus = ownerApproved
    ? blockers.length
      ? "approved_pending_blocker_resolution"
      : "approved_ready_for_dns"
    : input.approvalNotes
      ? "deferred"
      : "review_recorded";
  const nextActions = [
    ...(status === "approved_ready_for_dns"
      ? ["Coordinate DNS A/CNAME update with the owner-approved change window."]
      : ["Do not change DNS until blockers are cleared and owner approval is ready_for_dns."]),
    "Keep rollback evidence export attached to the change record.",
    "Run production smoke checks before and after DNS cutover."
  ];

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: approvalEventType,
    subjectType: "production_cutover",
    subjectId: "dns-cutover",
    payload: {
      status,
      ownerApproved,
      ownerName: input.ownerName,
      targetDomain: requestedTarget,
      activeDeploymentUrl: deployment.activeDeploymentUrl,
      commitSha: deployment.commitSha,
      plannedWindowStart: input.plannedWindowStart,
      plannedWindowEnd: input.plannedWindowEnd,
      rollbackAcknowledged: input.rollbackAcknowledged === true,
      approvalNotes: input.approvalNotes,
      blockers,
      nextActions,
      cutoverStatus: readiness.status,
      readinessGeneratedAt: readiness.generatedAt
    }
  });

  return mapApprovalEvent(auditEvent);
}
