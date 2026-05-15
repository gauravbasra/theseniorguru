import { getAppEnv } from "@/lib/env";

type CronLiveApprovalDefinition = {
  workerKey: string;
  route: string;
  modeEnv: string;
  approvedEnv: string;
  approvedByEnv: string;
  approvedAtEnv: string;
  mode?: string;
  approved?: string;
  approvedBy?: string;
  approvedAt?: string;
  ownerDecision: string;
};

function csvCell(value: unknown) {
  const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function approvalStatus(definition: CronLiveApprovalDefinition) {
  const mode = definition.mode === "live" ? "live" : "preview";
  const approved = definition.approved === "true";
  const approvedAtValid = Boolean(definition.approvedAt && !Number.isNaN(new Date(definition.approvedAt).getTime()));
  const blockers = [
    ...(mode !== "live" ? [`${definition.modeEnv} is not set to live.`] : []),
    ...(!approved ? [`Set ${definition.approvedEnv}=true after owner approval.`] : []),
    ...(!definition.approvedBy ? [`Set ${definition.approvedByEnv} to the owner/admin who approved live execution.`] : []),
    ...(!approvedAtValid ? [`Set ${definition.approvedAtEnv} to a valid ISO approval timestamp.`] : [])
  ];
  const status = mode === "live" && approved && Boolean(definition.approvedBy) && approvedAtValid
    ? "ready_for_live"
    : mode === "live"
      ? "blocked_missing_approval"
      : "preview_mode";

  return {
    workerKey: definition.workerKey,
    route: definition.route,
    status,
    mode,
    ownerDecision: definition.ownerDecision,
    envKeys: {
      mode: definition.modeEnv,
      approved: definition.approvedEnv,
      approvedBy: definition.approvedByEnv,
      approvedAt: definition.approvedAtEnv
    },
    evidence: {
      approved,
      approvedBy: definition.approvedBy,
      approvedAt: definition.approvedAt,
      approvedAtValid
    },
    blockers,
    nextActions: blockers.length
      ? blockers
      : ["Archive the owner approval evidence before running this cron in live mode."]
  };
}

export function getCronLiveApprovalDashboard() {
  const env = getAppEnv();
  const definitions: CronLiveApprovalDefinition[] = [
    {
      workerKey: "cron:acquisition",
      route: "GET /api/cron/acquisition",
      modeEnv: "SOURCE_ACQUISITION_CRON_MODE",
      approvedEnv: "SOURCE_ACQUISITION_CRON_LIVE_APPROVED",
      approvedByEnv: "SOURCE_ACQUISITION_CRON_APPROVED_BY",
      approvedAtEnv: "SOURCE_ACQUISITION_CRON_APPROVED_AT",
      mode: env.sourceAcquisitionCronMode,
      approved: env.sourceAcquisitionCronLiveApproved,
      approvedBy: env.sourceAcquisitionCronApprovedBy,
      approvedAt: env.sourceAcquisitionCronApprovedAt,
      ownerDecision: "Approve live current-site acquisition from public TheSeniorGuru.com listings."
    },
    {
      workerKey: "cron:newsroom",
      route: "GET /api/cron/newsroom",
      modeEnv: "NEWSROOM_RSS_CRON_MODE",
      approvedEnv: "NEWSROOM_RSS_CRON_LIVE_APPROVED",
      approvedByEnv: "NEWSROOM_RSS_CRON_APPROVED_BY",
      approvedAtEnv: "NEWSROOM_RSS_CRON_APPROVED_AT",
      mode: env.newsroomRssCronMode,
      approved: env.newsroomRssCronLiveApproved,
      approvedBy: env.newsroomRssCronApprovedBy,
      approvedAt: env.newsroomRssCronApprovedAt,
      ownerDecision: "Approve live editorial RSS intake and policy-gated staging."
    },
    {
      workerKey: "cron:webhooks",
      route: "GET /api/cron/webhooks",
      modeEnv: "WEBHOOK_RETRY_CRON_MODE",
      approvedEnv: "WEBHOOK_RETRY_CRON_LIVE_APPROVED",
      approvedByEnv: "WEBHOOK_RETRY_CRON_APPROVED_BY",
      approvedAtEnv: "WEBHOOK_RETRY_CRON_APPROVED_AT",
      mode: env.webhookRetryCronMode,
      approved: env.webhookRetryCronLiveApproved,
      approvedBy: env.webhookRetryCronApprovedBy,
      approvedAt: env.webhookRetryCronApprovedAt,
      ownerDecision: "Approve live webhook retry delivery for partner endpoints."
    },
    {
      workerKey: "cron:source-manifest-fetch",
      route: "GET /api/cron/source-manifests",
      modeEnv: "SOURCE_MANIFEST_FETCH_CRON_MODE",
      approvedEnv: "SOURCE_MANIFEST_FETCH_CRON_LIVE_APPROVED",
      approvedByEnv: "SOURCE_MANIFEST_FETCH_CRON_APPROVED_BY",
      approvedAtEnv: "SOURCE_MANIFEST_FETCH_CRON_APPROVED_AT",
      mode: env.sourceManifestFetchCronMode,
      approved: env.sourceManifestFetchCronLiveApproved,
      approvedBy: env.sourceManifestFetchCronApprovedBy,
      approvedAt: env.sourceManifestFetchCronApprovedAt,
      ownerDecision: "Approve live signed object fetches for source adapter manifests."
    },
    {
      workerKey: "cron:import-escalation-retry",
      route: "GET /api/cron/import-escalation-retries",
      modeEnv: "IMPORT_ESCALATION_RETRY_CRON_MODE",
      approvedEnv: "IMPORT_ESCALATION_RETRY_CRON_LIVE_APPROVED",
      approvedByEnv: "IMPORT_ESCALATION_RETRY_CRON_APPROVED_BY",
      approvedAtEnv: "IMPORT_ESCALATION_RETRY_CRON_APPROVED_AT",
      mode: env.importEscalationRetryCronMode,
      approved: env.importEscalationRetryCronLiveApproved,
      approvedBy: env.importEscalationRetryCronApprovedBy,
      approvedAt: env.importEscalationRetryCronApprovedAt,
      ownerDecision: "Approve live import escalation retry scheduling and delivery mode."
    }
  ];
  const rows = definitions.map(approvalStatus);

  return {
    generatedAt: new Date().toISOString(),
    status: rows.some((row) => row.status === "blocked_missing_approval")
      ? "blocked_live_mode"
      : rows.some((row) => row.status === "ready_for_live")
        ? "live_approvals_ready"
        : "preview_mode",
    totals: {
      cronRoutes: rows.length,
      readyForLive: rows.filter((row) => row.status === "ready_for_live").length,
      previewMode: rows.filter((row) => row.status === "preview_mode").length,
      blockedMissingApproval: rows.filter((row) => row.status === "blocked_missing_approval").length,
      blockers: rows.reduce((total, row) => total + row.blockers.length, 0)
    },
    guardrails: [
      "Cron routes stay in preview mode unless the matching mode env is live and approval metadata is complete.",
      "A live cron request with missing approval metadata records a failed scheduled-worker run and returns HTTP 424.",
      "Approval timestamps must be valid ISO strings and should match the owner decision archive.",
      "Keep delivery/provider credentials parked separately from approval metadata."
    ],
    rows,
    nextActions: rows.some((row) => row.status === "blocked_missing_approval")
      ? ["Complete missing approval metadata or return blocked cron routes to preview mode before launch."]
      : ["Keep cron routes in preview until the owner approves each live operation window."]
  };
}

export function exportCronLiveApprovalDashboardCsv() {
  const dashboard = getCronLiveApprovalDashboard();
  const columns = [
    "workerKey",
    "route",
    "status",
    "mode",
    "ownerDecision",
    "blockers"
  ] as const;
  const csv = [
    columns.join(","),
    ...dashboard.rows.map((row) =>
      columns
        .map((column) => csvCell(column === "blockers" ? row.blockers : row[column]))
        .join(",")
    )
  ].join("\n");

  return {
    filename: "cron-live-approval-dashboard.csv",
    csv
  };
}
