import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import { listProviderVerificationAttempts } from "@/lib/claims/provider-verification";
import { recordAuditEvent } from "@/lib/audit-events";
import type {
  NotifyProviderVerificationSlaAlertsInput,
  ProviderClaimRecord,
  ProviderVerificationAttemptRecord,
  ProviderVerificationQueueItem,
  ProviderVerificationSlaAlertResult,
  ProviderVerificationQueueSummary,
  ProviderVerificationSlaItem,
  ProviderVerificationSlaSummary
} from "@/lib/domain/claims";
import { runPolicyCheck } from "@/lib/policy";

const VERIFICATION_SLA_HOURS = {
  startVerification: 24,
  sendDelivery: 24,
  providerResponse: 72,
  adminReview: 24
};

function hoursSince(value?: string) {
  const timestamp = value ? Date.parse(value) : NaN;

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.round((Date.now() - timestamp) / (60 * 60 * 1000)));
}

function hoursUntil(value?: string) {
  const timestamp = value ? Date.parse(value) : NaN;

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return Math.round((timestamp - Date.now()) / (60 * 60 * 1000));
}

function addHours(value: string | undefined, hours: number) {
  const timestamp = value ? Date.parse(value) : NaN;

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp + hours * 60 * 60 * 1000).toISOString();
}

function latestAttempt(attempts: ProviderVerificationAttemptRecord[]) {
  return [...attempts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function hasDelivery(attempt?: ProviderVerificationAttemptRecord) {
  const delivery = attempt?.attemptPayload.delivery;
  return Boolean(delivery && typeof delivery === "object");
}

function classifyClaim(
  claim: ProviderClaimRecord,
  attempts: ProviderVerificationAttemptRecord[],
  readyForAdminReview: boolean
): Pick<ProviderVerificationQueueItem, "queueStatus" | "priority" | "nextAction"> {
  const latest = latestAttempt(attempts);
  const hasAnyAttempt = attempts.length > 0;
  const failedOrExpired = attempts.some((attempt) => attempt.status === "failed" || attempt.status === "expired");
  const pending = attempts.filter((attempt) => attempt.status === "pending");
  const pendingWithoutDelivery = pending.find((attempt) => !hasDelivery(attempt));

  if (claim.status === "approved") {
    return {
      queueStatus: "approved",
      priority: "low",
      nextAction: "Provider claim is approved; profile edits can continue through provider-portal review."
    };
  }

  if (claim.status === "rejected") {
    return {
      queueStatus: "rejected",
      priority: "low",
      nextAction: "Provider claim is rejected; reopen only if the operator submits new evidence."
    };
  }

  if (readyForAdminReview) {
    return {
      queueStatus: "ready_for_admin_review",
      priority: "critical",
      nextAction: "Review passed verification evidence and approve or reject the provider claim."
    };
  }

  if (failedOrExpired) {
    return {
      queueStatus: "failed_or_expired",
      priority: "high",
      nextAction: "Create a fresh verification attempt or request corrected evidence from the operator."
    };
  }

  if (!hasAnyAttempt) {
    return {
      queueStatus: "needs_verification_start",
      priority: "high",
      nextAction: "Start business email, phone, document, or manual verification for this claim."
    };
  }

  if (pendingWithoutDelivery) {
    return {
      queueStatus: "pending_delivery",
      priority: "medium",
      nextAction: "Send the pending verification attempt or issue a manual verification code."
    };
  }

  if (latest?.status === "pending") {
    return {
      queueStatus: "pending_provider_action",
      priority: "medium",
      nextAction: "Wait for provider action or expire stale attempts if the deadline has passed."
    };
  }

  return {
    queueStatus: "needs_verification_start",
    priority: "high",
    nextAction: "Start another verification attempt before admin approval."
  };
}

function sortQueueItems(items: ProviderVerificationQueueItem[]) {
  const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 };

  return [...items].sort((a, b) => {
    const priorityDelta = priorityScore[b.priority] - priorityScore[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return b.ageHours - a.ageHours;
  });
}

export async function getProviderVerificationQueue(): Promise<ProviderVerificationQueueSummary> {
  const claims = await listProviderClaims();
  const items = await Promise.all(
    claims.map(async (claim) => {
      const [statusSummary, attempts] = await Promise.all([
        getProviderClaimStatusSummary(claim.id),
        listProviderVerificationAttempts(claim.id)
      ]);
      const classification = classifyClaim(claim, attempts, statusSummary.readyForAdminReview);

      return {
        claim,
        statusSummary,
        latestAttempt: latestAttempt(attempts),
        ageHours: hoursSince(claim.createdAt),
        ...classification
      };
    })
  );
  const sortedItems = sortQueueItems(items);
  const totals = {
    claims: sortedItems.length,
    readyForAdminReview: sortedItems.filter((item) => item.queueStatus === "ready_for_admin_review").length,
    needsVerificationStart: sortedItems.filter((item) => item.queueStatus === "needs_verification_start").length,
    pendingDelivery: sortedItems.filter((item) => item.queueStatus === "pending_delivery").length,
    pendingProviderAction: sortedItems.filter((item) => item.queueStatus === "pending_provider_action").length,
    failedOrExpired: sortedItems.filter((item) => item.queueStatus === "failed_or_expired").length,
    approved: sortedItems.filter((item) => item.queueStatus === "approved").length,
    rejected: sortedItems.filter((item) => item.queueStatus === "rejected").length
  };
  const blockers = [
    ...(totals.failedOrExpired ? [`${totals.failedOrExpired} claim verification item needs a fresh attempt or corrected evidence.`] : []),
    ...(totals.needsVerificationStart ? [`${totals.needsVerificationStart} claim has not started verification.`] : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    totals,
    items: sortedItems,
    blockers,
    nextActions: [
      ...(totals.readyForAdminReview ? ["Approve or reject claims that have passed verification evidence."] : []),
      ...(totals.pendingDelivery ? ["Send pending verification attempts or issue manual codes from the claim console."] : []),
      ...(blockers.length ? ["Resolve claim verification blockers before counting providers as claimed launch inventory."] : []),
      ...(!sortedItems.length ? ["New provider claim submissions will appear here for owner verification operations."] : [])
    ]
  };
}

function slaDueAt(item: ProviderVerificationQueueItem) {
  if (item.queueStatus === "needs_verification_start") {
    return addHours(item.claim.createdAt, VERIFICATION_SLA_HOURS.startVerification);
  }

  if (item.queueStatus === "pending_delivery") {
    return addHours(item.latestAttempt?.createdAt, VERIFICATION_SLA_HOURS.sendDelivery);
  }

  if (item.queueStatus === "pending_provider_action") {
    return item.latestAttempt?.expiresAt ?? addHours(item.latestAttempt?.createdAt, VERIFICATION_SLA_HOURS.providerResponse);
  }

  if (item.queueStatus === "ready_for_admin_review") {
    return addHours(item.latestAttempt?.completedAt ?? item.latestAttempt?.createdAt ?? item.claim.createdAt, VERIFICATION_SLA_HOURS.adminReview);
  }

  return undefined;
}

function toSlaItem(item: ProviderVerificationQueueItem): ProviderVerificationSlaItem {
  const dueAt = slaDueAt(item);
  const remainingHours = hoursUntil(dueAt);

  return {
    claimId: item.claim.id,
    providerId: item.claim.providerId,
    claimantEmail: item.claim.claimantEmail,
    claimStatus: item.claim.status,
    queueStatus: item.queueStatus,
    priority: item.priority,
    ageHours: item.ageHours,
    attemptId: item.latestAttempt?.id,
    method: item.latestAttempt?.method,
    target: item.latestAttempt?.target,
    attemptStatus: item.latestAttempt?.status,
    dueAt,
    hoursUntilDue: remainingHours,
    hoursOverdue: remainingHours !== undefined && remainingHours < 0 ? Math.abs(remainingHours) : undefined,
    nextAction: item.nextAction
  };
}

function sortSlaItems(items: ProviderVerificationSlaItem[]) {
  const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 };

  return [...items].sort((a, b) => {
    const aDue = a.hoursUntilDue ?? Number.POSITIVE_INFINITY;
    const bDue = b.hoursUntilDue ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    const priorityDelta = priorityScore[b.priority] - priorityScore[a.priority];
    if (priorityDelta !== 0) return priorityDelta;

    return b.ageHours - a.ageHours;
  });
}

export async function getProviderVerificationSlaSummary(): Promise<ProviderVerificationSlaSummary> {
  const queue = await getProviderVerificationQueue();
  const slaItems = queue.items.map(toSlaItem);
  const overdue = sortSlaItems(
    slaItems.filter((item) => item.hoursUntilDue !== undefined && item.hoursUntilDue < 0)
  );
  const dueSoon = sortSlaItems(
    slaItems.filter((item) => item.hoursUntilDue !== undefined && item.hoursUntilDue >= 0 && item.hoursUntilDue <= 24)
  );
  const pendingDelivery = sortSlaItems(slaItems.filter((item) => item.queueStatus === "pending_delivery"));
  const failedOrExpired = sortSlaItems(slaItems.filter((item) => item.queueStatus === "failed_or_expired"));
  const readyForAdminReview = sortSlaItems(slaItems.filter((item) => item.queueStatus === "ready_for_admin_review"));
  const totals = {
    claims: queue.totals.claims,
    notStarted: queue.totals.needsVerificationStart,
    pendingDelivery: queue.totals.pendingDelivery,
    dueSoon: dueSoon.length,
    overdue: overdue.length,
    failedOrExpired: queue.totals.failedOrExpired,
    readyForAdminReview: queue.totals.readyForAdminReview
  };
  const blockers = [
    ...queue.blockers,
    ...(overdue.length ? [`${overdue.length} claim verification SLA item is overdue.`] : []),
    ...(failedOrExpired.length ? [`${failedOrExpired.length} claim verification item failed or expired and needs a fresh path.`] : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : dueSoon.length || pendingDelivery.length || readyForAdminReview.length ? "attention_needed" : "ready",
    slaHours: VERIFICATION_SLA_HOURS,
    totals,
    overdue,
    dueSoon,
    pendingDelivery,
    failedOrExpired,
    readyForAdminReview,
    blockers,
    nextActions: [
      ...(overdue.length ? ["Work overdue verification SLA items before launch inventory is counted as claimed."] : []),
      ...(pendingDelivery.length ? ["Send or issue codes for pending verification delivery items."] : []),
      ...(readyForAdminReview.length ? ["Approve or reject verified claim evidence inside the admin claim console."] : []),
      ...(failedOrExpired.length ? ["Create fresh verification attempts for failed or expired claims."] : []),
      ...(!queue.items.length ? ["Provider claim submissions will appear here once operators request ownership."] : []),
      ...(!blockers.length && queue.items.length ? ["Claim verification operations are inside the configured SLA windows."] : [])
    ]
  };
}

function uniqueSlaAlertItems(summary: ProviderVerificationSlaSummary) {
  const items = [
    ...summary.overdue,
    ...summary.failedOrExpired,
    ...summary.pendingDelivery,
    ...summary.readyForAdminReview,
    ...summary.dueSoon
  ];
  const uniqueItems = new Map<string, ProviderVerificationSlaItem>();

  for (const item of items) {
    const key = item.attemptId ?? item.claimId;
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, item);
    }
  }

  return [...uniqueItems.values()].slice(0, 25);
}

export async function notifyProviderVerificationSlaAlerts(
  input: NotifyProviderVerificationSlaAlertsInput = {}
): Promise<ProviderVerificationSlaAlertResult> {
  const dryRun = input.dryRun ?? true;
  const deliveryProvider = input.deliveryProvider ?? "manual_export";
  const summary = await getProviderVerificationSlaSummary();
  const items = uniqueSlaAlertItems(summary);
  const policy = await runPolicyCheck({
    subjectType: "provider_verification_sla",
    actionKey: "notify_provider_verification_sla_alerts",
    input: {
      dryRun,
      deliveryProvider,
      status: summary.status,
      totals: summary.totals
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider verification SLA alert delivery blocked by policy");
  }

  const blockers = [
    ...(deliveryProvider === "internal_notification_queue" && !dryRun
      ? ["Internal notification queue provider is not configured for live claim verification SLA alerts yet."]
      : [])
  ];
  const payloadPreview = {
    subject:
      summary.status === "ready"
        ? "The Senior Guru claim verification SLA is clear"
        : "The Senior Guru claim verification SLA needs attention",
    alertCount: items.length,
    overdue: summary.totals.overdue,
    dueSoon: summary.totals.dueSoon,
    pendingDelivery: summary.totals.pendingDelivery,
    failedOrExpired: summary.totals.failedOrExpired,
    readyForAdminReview: summary.totals.readyForAdminReview,
    items
  };
  const resultStatus =
    summary.status === "ready" ? "no_action" : blockers.length ? "blocked" : dryRun ? "ready" : "sent";

  if (!dryRun && !blockers.length && summary.status !== "ready") {
    await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "admin" : "system",
      eventType: "provider_verification.sla_alert_sent",
      subjectType: "provider_verification_sla",
      payload: {
        deliveryProvider,
        totals: summary.totals,
        alertCount: items.length,
        policyDecision: policy.decision
      }
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    deliveryProvider,
    status: resultStatus,
    recipients: ["claim-ops"],
    slaSummary: summary,
    payloadPreview,
    blockers,
    nextActions: [
      ...(summary.status === "ready" ? ["No claim verification SLA alert is needed right now."] : []),
      ...(dryRun && summary.status !== "ready" ? ["Review the payload preview, then run with dryRun=false after choosing the delivery provider."] : []),
      ...(!dryRun && blockers.length ? ["Keep delivery in manual export mode until the internal notification queue is configured."] : []),
      ...(!dryRun && !blockers.length && summary.status !== "ready" ? ["Claim verification SLA alert was recorded for launch operations follow-up."] : [])
    ]
  };
}
