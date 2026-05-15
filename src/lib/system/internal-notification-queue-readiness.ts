type NotificationQueueSurface = {
  key: string;
  label: string;
  route: string;
  method: "GET" | "POST";
  owner: string;
  liveDispatchMode: "https_queue" | "audit_event_queue";
  status: "ready" | "manual_only" | "blocked";
  blockers: string[];
  nextActions: string[];
};

type NotificationQueueReadiness = {
  generatedAt: string;
  status: "ready" | "manual_only" | "blocked";
  provider: {
    endpointConfigured: boolean;
    endpointIsHttps: boolean;
    endpointHost?: string;
    tokenConfigured: boolean;
    topicConfigured: boolean;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    approvedAtValid: boolean;
    requiredEnv: string[];
    optionalEnv: string[];
  };
  totals: {
    surfaces: number;
    ready: number;
    manualOnly: number;
    blocked: number;
  };
  surfaces: NotificationQueueSurface[];
  blockers: string[];
  nextActions: string[];
};

const requiredApprovalEnv = [
  "INTERNAL_NOTIFICATION_QUEUE_URL",
  "INTERNAL_NOTIFICATION_QUEUE_APPROVED",
  "INTERNAL_NOTIFICATION_QUEUE_APPROVED_BY",
  "INTERNAL_NOTIFICATION_QUEUE_APPROVED_AT"
];

const optionalEnv = ["INTERNAL_NOTIFICATION_QUEUE_TOKEN", "INTERNAL_NOTIFICATION_QUEUE_TOPIC"];

const surfaces = [
  {
    key: "scheduled_worker_alerts",
    label: "Scheduled worker health alerts",
    route: "/api/v1/admin/scheduled-worker-alerts",
    method: "POST" as const,
    owner: "platform-ops",
    liveDispatchMode: "manual_export_ready"
  },
  {
    key: "post_cutover_monitor_alerts",
    label: "Post-cutover monitor alerts",
    route: "/api/v1/system/post-cutover-monitor-alerts",
    method: "POST" as const,
    owner: "launch-ops",
    liveDispatchMode: "https_queue"
  },
  {
    key: "import_escalation_notifications",
    label: "Import review escalation notifications",
    route: "/api/v1/admin/extracted-entities/escalations/notify",
    method: "POST" as const,
    owner: "data-ops",
    liveDispatchMode: "https_queue"
  },
  {
    key: "import_escalation_retry_delivery",
    label: "Import escalation retry delivery",
    route: "/api/v1/admin/extracted-entities/escalations/retry-delivery",
    method: "POST" as const,
    owner: "data-ops",
    liveDispatchMode: "https_queue"
  },
  {
    key: "provider_verification_sla_alerts",
    label: "Provider verification SLA alerts",
    route: "/api/v1/admin/provider-verification-sla/notify",
    method: "POST" as const,
    owner: "claim-ops",
    liveDispatchMode: "audit_event_queue"
  },
  {
    key: "event_automation_delivery",
    label: "Event reminder and follow-up delivery",
    route: "/api/v1/admin/event-automation/deliver",
    method: "POST" as const,
    owner: "events-ops",
    liveDispatchMode: "audit_event_queue"
  },
  {
    key: "community_digest_delivery",
    label: "Community digest delivery",
    route: "/api/v1/admin/community/digests/run",
    method: "POST" as const,
    owner: "community-ops",
    liveDispatchMode: "audit_event_queue"
  },
  {
    key: "review_request_delivery",
    label: "Review request delivery",
    route: "/api/v1/provider/review-request-campaigns/{id}/send",
    method: "POST" as const,
    owner: "provider-growth",
    liveDispatchMode: "audit_event_queue"
  },
  {
    key: "care_circle_invites",
    label: "Care-circle invite delivery",
    route: "/api/v1/app/care-circles/{id}/members/{memberId}/invite",
    method: "POST" as const,
    owner: "family-app",
    liveDispatchMode: "audit_event_queue"
  },
  {
    key: "voice_assistant_internal_handoff",
    label: "Voice assistant internal handoff",
    route: "/api/v1/provider/voice-assistant",
    method: "POST" as const,
    owner: "provider-growth",
    liveDispatchMode: "audit_event_queue"
  }
];

function isHttpsUrl(value?: string) {
  if (!value) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function endpointHost(value?: string) {
  if (!value) return undefined;

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

function approval() {
  const approved = process.env.INTERNAL_NOTIFICATION_QUEUE_APPROVED === "true";
  const approvedBy = process.env.INTERNAL_NOTIFICATION_QUEUE_APPROVED_BY?.trim() || undefined;
  const approvedAt = process.env.INTERNAL_NOTIFICATION_QUEUE_APPROVED_AT?.trim() || undefined;
  const approvedAtValid = Boolean(approvedAt && !Number.isNaN(Date.parse(approvedAt)));

  return {
    approved: approved && Boolean(approvedBy) && approvedAtValid,
    approvedBy,
    approvedAt,
    approvedAtValid
  };
}

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join("; ") : value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function getInternalNotificationQueueReadiness(): NotificationQueueReadiness {
  const queueUrl = process.env.INTERNAL_NOTIFICATION_QUEUE_URL?.trim();
  const endpointConfigured = Boolean(queueUrl);
  const endpointIsHttps = isHttpsUrl(queueUrl);
  const tokenConfigured = Boolean(process.env.INTERNAL_NOTIFICATION_QUEUE_TOKEN?.trim());
  const topicConfigured = Boolean(process.env.INTERNAL_NOTIFICATION_QUEUE_TOPIC?.trim());
  const approvalState = approval();
  const providerBlockers = [
    ...(!endpointConfigured ? ["INTERNAL_NOTIFICATION_QUEUE_URL is not configured."] : []),
    ...(endpointConfigured && !endpointIsHttps ? ["INTERNAL_NOTIFICATION_QUEUE_URL must be an HTTPS endpoint."] : []),
    ...(!approvalState.approved ? ["Internal notification queue provider is not owner-approved for live delivery."] : [])
  ];

  const surfaceRows: NotificationQueueSurface[] = surfaces.map((surface) => {
    const needsHttpsQueue = surface.liveDispatchMode === "https_queue";
    const blockers = needsHttpsQueue ? providerBlockers : approvalState.approved ? [] : [providerBlockers.at(-1) ?? "Provider approval is required."];
    const status: NotificationQueueSurface["status"] = blockers.length
      ? needsHttpsQueue && endpointConfigured
        ? "manual_only"
        : "blocked"
      : "ready";

    return {
      key: surface.key,
      label: surface.label,
      route: surface.route,
      method: surface.method,
      owner: surface.owner,
      liveDispatchMode: needsHttpsQueue ? "https_queue" : "audit_event_queue",
      status,
      blockers,
      nextActions:
        status === "ready"
          ? ["Run a dry-run payload preview, then execute live delivery only when the triggering workflow requires notification."]
          : [
              "Keep manual-export or audit-only queue behavior enabled until provider activation is complete.",
              "Archive a dry-run payload before enabling live queue dispatch."
            ]
    };
  });
  const blockers = Array.from(new Set(surfaceRows.flatMap((surface) => surface.blockers)));
  const ready = surfaceRows.filter((surface) => surface.status === "ready").length;
  const manualOnly = surfaceRows.filter((surface) => surface.status === "manual_only").length;
  const blocked = surfaceRows.filter((surface) => surface.status === "blocked").length;

  return {
    generatedAt: new Date().toISOString(),
    status: blocked || manualOnly ? (ready ? "manual_only" : "blocked") : "ready",
    provider: {
      endpointConfigured,
      endpointIsHttps,
      endpointHost: endpointHost(queueUrl),
      tokenConfigured,
      topicConfigured,
      approved: approvalState.approved,
      approvedBy: approvalState.approvedBy,
      approvedAt: approvalState.approvedAt,
      approvedAtValid: approvalState.approvedAtValid,
      requiredEnv: requiredApprovalEnv,
      optionalEnv
    },
    totals: {
      surfaces: surfaceRows.length,
      ready,
      manualOnly,
      blocked
    },
    surfaces: surfaceRows,
    blockers,
    nextActions: [
      ...(blockers.length ? ["Collect owner-approved queue endpoint, approval metadata, and routing policy before live provider activation."] : []),
      ...(!tokenConfigured ? ["Decide whether INTERNAL_NOTIFICATION_QUEUE_TOKEN is required for the production queue endpoint."] : []),
      ...(!topicConfigured ? ["Decide whether INTERNAL_NOTIFICATION_QUEUE_TOPIC is required for route-specific dispatch."] : []),
      "Use dry-run/manual-export paths until the readiness API reports ready."
    ]
  };
}

export function exportInternalNotificationQueueReadinessCsv() {
  const readiness = getInternalNotificationQueueReadiness();
  const headers = [
    "key",
    "label",
    "route",
    "method",
    "owner",
    "liveDispatchMode",
    "status",
    "blockers",
    "nextActions"
  ];
  const rows = readiness.surfaces.map((surface) =>
    headers.map((header) => csvCell(surface[header as keyof NotificationQueueSurface])).join(",")
  );
  const blockerRows = readiness.blockers.map((blocker) => ["blocker", "", "", "", "", "", "blocked", blocker, ""].map(csvCell).join(","));
  const actionRows = readiness.nextActions.map((action) => ["next_action", "", "", "", "", "", "", "", action].map(csvCell).join(","));

  return {
    filename: `senior-guru-internal-notification-queue-readiness-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [headers.join(","), ...rows, ...blockerRows, ...actionRows].join("\n")
  };
}
