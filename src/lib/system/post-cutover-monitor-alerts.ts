import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getPostCutoverMonitor, type PostCutoverMonitorProbe, type PostCutoverMonitorRun } from "@/lib/system/post-cutover-monitor";

export type PostCutoverMonitorAlertProvider = "manual_export" | "internal_notification_queue";
export type PostCutoverMonitorAlertStatus = "no_action" | "ready" | "manual_exported" | "sent" | "blocked";

export type PostCutoverMonitorAlertInput = {
  actorId?: string;
  deliveryProvider?: PostCutoverMonitorAlertProvider;
  dryRun?: boolean;
  notes?: string;
};

export type PostCutoverMonitorAlertResult = {
  generatedAt: string;
  status: PostCutoverMonitorAlertStatus;
  dryRun: boolean;
  deliveryProvider: PostCutoverMonitorAlertProvider;
  monitorStatus: PostCutoverMonitorRun["status"];
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  alertCount: number;
  alertItems: PostCutoverMonitorAlertItem[];
  delivery: PostCutoverMonitorAlertDelivery;
  payloadPreview: PostCutoverMonitorAlertPayload;
  blockers: string[];
  nextActions: string[];
  latestAuditEvent?: OperationalAuditEvent;
};

export type PostCutoverMonitorAlertItem = {
  key: string;
  label: string;
  status: PostCutoverMonitorProbe["status"];
  blockers: string[];
  nextActions: string[];
};

export type PostCutoverMonitorAlertDelivery = {
  provider: PostCutoverMonitorAlertProvider;
  label: string;
  target?: string;
  status: "ready" | "manual_only" | "blocked";
  dispatchedAt?: string;
  statusCode?: number;
  providerMessageId?: string;
  blockers: string[];
};

export type PostCutoverMonitorAlertPayload = {
  eventType: "post_cutover_monitor.alert";
  generatedAt: string;
  monitorStatus: PostCutoverMonitorRun["status"];
  targetDomain: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  alertItems: PostCutoverMonitorAlertItem[];
  blockers: string[];
  nextActions: string[];
};

const alertEventType = "post_cutover_monitor.alert_sent";

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function queueTarget() {
  return process.env.INTERNAL_NOTIFICATION_QUEUE_URL?.trim() || process.env.INTERNAL_NOTIFICATION_QUEUE_TOPIC?.trim();
}

function isValidHttpsTarget(value?: string) {
  if (!value) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function deliveryReadiness(provider: PostCutoverMonitorAlertProvider): PostCutoverMonitorAlertDelivery {
  if (provider === "manual_export") {
    return {
      provider,
      label: "Launch-ops manual export",
      status: "ready",
      blockers: []
    };
  }

  const queueUrl = process.env.INTERNAL_NOTIFICATION_QUEUE_URL?.trim();
  const queueTopic = process.env.INTERNAL_NOTIFICATION_QUEUE_TOPIC?.trim();
  const configured = Boolean(queueUrl || queueTopic);
  const urlReady = isValidHttpsTarget(queueUrl);

  return {
    provider,
    label: "Internal notification queue",
    target: queueTarget(),
    status: urlReady ? "ready" : configured ? "manual_only" : "blocked",
    blockers: [
      ...(!configured ? ["INTERNAL_NOTIFICATION_QUEUE_URL is required before live post-cutover monitor alert delivery can run."] : []),
      ...(configured && !urlReady
        ? ["INTERNAL_NOTIFICATION_QUEUE_URL must be an HTTPS endpoint before live post-cutover monitor alert delivery can run."]
        : [])
    ]
  };
}

async function latestAlertAuditEvent() {
  const summary = await listAuditEvents({ eventType: alertEventType, subjectType: "production_cutover", limit: 1 });
  return summary.events[0];
}

function alertItemsForMonitor(monitor: PostCutoverMonitorRun): PostCutoverMonitorAlertItem[] {
  return monitor.probes
    .filter((probe) => probe.status !== "passed")
    .map((probe) => ({
      key: probe.key,
      label: probe.label,
      status: probe.status,
      blockers: probe.blockers,
      nextActions: probe.nextActions
    }));
}

function payloadForMonitor(monitor: PostCutoverMonitorRun, alertItems: PostCutoverMonitorAlertItem[]): PostCutoverMonitorAlertPayload {
  return {
    eventType: "post_cutover_monitor.alert",
    generatedAt: new Date().toISOString(),
    monitorStatus: monitor.status,
    targetDomain: monitor.targetDomain,
    activeDeploymentUrl: monitor.activeDeploymentUrl,
    commitSha: monitor.commitSha,
    alertItems,
    blockers: monitor.blockers,
    nextActions: monitor.nextActions
  };
}

async function dispatchInternalQueue(input: {
  payload: PostCutoverMonitorAlertPayload;
  actorId?: string;
}): Promise<Pick<PostCutoverMonitorAlertDelivery, "dispatchedAt" | "providerMessageId" | "statusCode" | "target">> {
  const queueUrl = process.env.INTERNAL_NOTIFICATION_QUEUE_URL?.trim();

  if (!queueUrl || !isValidHttpsTarget(queueUrl)) {
    throw new Error("INTERNAL_NOTIFICATION_QUEUE_URL must be a valid HTTPS endpoint for live post-cutover monitor alert dispatch");
  }

  const response = await fetch(queueUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.INTERNAL_NOTIFICATION_QUEUE_TOKEN
        ? { authorization: `Bearer ${process.env.INTERNAL_NOTIFICATION_QUEUE_TOKEN}` }
        : {}),
      ...(process.env.INTERNAL_NOTIFICATION_QUEUE_TOPIC
        ? { "x-notification-topic": process.env.INTERNAL_NOTIFICATION_QUEUE_TOPIC }
        : {})
    },
    body: JSON.stringify({
      eventType: input.payload.eventType,
      actorId: input.actorId,
      payload: input.payload
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Internal notification queue returned HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }

  return {
    target: queueUrl,
    statusCode: response.status,
    providerMessageId:
      response.headers.get("x-message-id") ??
      response.headers.get("x-request-id") ??
      response.headers.get("x-vercel-id") ??
      undefined,
    dispatchedAt: new Date().toISOString()
  };
}

export async function getPostCutoverMonitorAlertPreview(
  input: PostCutoverMonitorAlertInput = {}
): Promise<PostCutoverMonitorAlertResult> {
  const deliveryProvider = input.deliveryProvider ?? "manual_export";
  const [monitor, latestAuditEvent] = await Promise.all([getPostCutoverMonitor(true), latestAlertAuditEvent()]);
  const alertItems = alertItemsForMonitor(monitor);
  const delivery = deliveryReadiness(deliveryProvider);
  const blockers = uniq([
    ...delivery.blockers,
    ...(deliveryProvider === "internal_notification_queue" && delivery.status !== "ready"
      ? ["Live queue-backed delivery is blocked; use manual_export until the owner approves and configures the provider."]
      : [])
  ]);
  const payloadPreview = payloadForMonitor(monitor, alertItems);

  return {
    generatedAt: new Date().toISOString(),
    status: alertItems.length === 0 ? "no_action" : blockers.length ? "blocked" : "ready",
    dryRun: true,
    deliveryProvider,
    monitorStatus: monitor.status,
    targetDomain: monitor.targetDomain,
    activeDeploymentUrl: monitor.activeDeploymentUrl,
    commitSha: monitor.commitSha,
    alertCount: alertItems.length,
    alertItems,
    delivery,
    payloadPreview,
    blockers,
    nextActions: uniq([
      ...(alertItems.length === 0 ? ["No post-cutover monitor alert is needed while all probes are passing."] : []),
      ...(deliveryProvider === "manual_export"
        ? ["Use the manual export payload for launch-ops follow-up until a live queue provider is approved."]
        : []),
      ...(deliveryProvider === "internal_notification_queue" && delivery.status !== "ready"
        ? ["Configure INTERNAL_NOTIFICATION_QUEUE_URL as an HTTPS endpoint before live queue delivery."]
        : []),
      ...monitor.nextActions
    ]),
    latestAuditEvent
  };
}

export async function sendPostCutoverMonitorAlert(input: PostCutoverMonitorAlertInput = {}): Promise<PostCutoverMonitorAlertResult> {
  const deliveryProvider = input.deliveryProvider ?? "manual_export";
  const dryRun = input.dryRun ?? true;
  const preview = await getPostCutoverMonitorAlertPreview({ ...input, deliveryProvider });

  if (dryRun || preview.status === "no_action" || preview.status === "blocked") {
    return { ...preview, dryRun };
  }

  let delivery = preview.delivery;
  let status: PostCutoverMonitorAlertStatus = deliveryProvider === "manual_export" ? "manual_exported" : "sent";

  if (deliveryProvider === "internal_notification_queue") {
    const dispatch = await dispatchInternalQueue({ payload: preview.payloadPreview, actorId: input.actorId });
    delivery = {
      ...delivery,
      target: dispatch.target,
      dispatchedAt: dispatch.dispatchedAt,
      providerMessageId: dispatch.providerMessageId,
      statusCode: dispatch.statusCode
    };
  }

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: alertEventType,
    subjectType: "production_cutover",
    subjectId: "post-cutover-monitor",
    payload: {
      status,
      dryRun,
      deliveryProvider,
      notes: input.notes,
      monitorStatus: preview.monitorStatus,
      targetDomain: preview.targetDomain,
      activeDeploymentUrl: preview.activeDeploymentUrl,
      commitSha: preview.commitSha,
      alertCount: preview.alertCount,
      alertItems: preview.alertItems.map((item) => ({ key: item.key, status: item.status, blockers: item.blockers })),
      delivery,
      blockers: preview.blockers,
      generatedAt: preview.generatedAt
    }
  });

  return {
    ...preview,
    status,
    dryRun,
    delivery,
    latestAuditEvent: auditEvent
  };
}

export function summarizePostCutoverMonitorAlertAudit(event: OperationalAuditEvent | undefined) {
  if (!event) return undefined;

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorId: event.actorId,
    status: typeof event.payload.status === "string" ? event.payload.status : "unknown",
    deliveryProvider: typeof event.payload.deliveryProvider === "string" ? event.payload.deliveryProvider : undefined,
    alertCount: typeof event.payload.alertCount === "number" ? event.payload.alertCount : 0
  };
}
