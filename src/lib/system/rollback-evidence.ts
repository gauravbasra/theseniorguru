import { getDeploymentStatus } from "@/lib/system/deployment";
import { getLinkHealthSummary } from "@/lib/system/link-health";
import { getProductionCutoverReadiness } from "@/lib/system/production-cutover";

export type RollbackEvidenceFormat = "json" | "csv";

export type RollbackEvidenceStep = {
  order: number;
  action: string;
  owner: "owner" | "deployment_operator" | "platform_admin";
  evidenceRequired: string;
};

export type RollbackEvidenceResult = {
  generatedAt: string;
  format: RollbackEvidenceFormat;
  status: "ready_to_archive" | "blocked";
  deployment: {
    canonicalUrl: string;
    activeDeploymentUrl?: string;
    environment: string;
    commitSha?: string;
    persistenceMode: string;
  };
  cutover: {
    status: string;
    targetDomain: string;
    blockerCount: number;
    ownerActionCount: number;
  };
  linkHealth: {
    status: string;
    total: number;
    invalidCount: number;
  };
  rollbackSteps: RollbackEvidenceStep[];
  blockers: string[];
  nextActions: string[];
  csv?: string;
};

function csvCell(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(result: Omit<RollbackEvidenceResult, "csv">) {
  const headers = ["section", "key", "value", "owner", "evidence_required"];
  const rows = [
    ["deployment", "canonical_url", result.deployment.canonicalUrl, "", ""],
    ["deployment", "active_deployment_url", result.deployment.activeDeploymentUrl ?? "", "", ""],
    ["deployment", "environment", result.deployment.environment, "", ""],
    ["deployment", "commit_sha", result.deployment.commitSha ?? "", "", ""],
    ["deployment", "persistence_mode", result.deployment.persistenceMode, "", ""],
    ["cutover", "status", result.cutover.status, "", ""],
    ["cutover", "target_domain", result.cutover.targetDomain, "", ""],
    ["cutover", "blocker_count", result.cutover.blockerCount, "", ""],
    ["link_health", "status", result.linkHealth.status, "", ""],
    ["link_health", "invalid_count", result.linkHealth.invalidCount, "", ""],
    ...result.rollbackSteps.map((step) => [
      "rollback_step",
      String(step.order),
      step.action,
      step.owner,
      step.evidenceRequired
    ]),
    ...result.blockers.map((blocker) => ["blocker", "rollback_blocker", blocker, "", ""]),
    ...result.nextActions.map((action) => ["next_action", "rollback_next_action", action, "", ""])
  ];

  return [headers.join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n");
}

export async function getRollbackEvidence(format: RollbackEvidenceFormat = "json"): Promise<RollbackEvidenceResult> {
  const [deployment, cutover, linkHealth] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getProductionCutoverReadiness(),
    Promise.resolve(getLinkHealthSummary())
  ]);
  const rollbackSteps: RollbackEvidenceStep[] = [
    {
      order: 1,
      action: "Pause DNS cutover or restore prior DNS records if the production alias fails smoke checks.",
      owner: "owner",
      evidenceRequired: "DNS provider change log and previous A/CNAME values."
    },
    {
      order: 2,
      action: "Promote the last known-good Vercel deployment if the current deployment regresses.",
      owner: "deployment_operator",
      evidenceRequired: "Current deployment URL, previous deployment URL, commit SHA, and Vercel promote/rollback log."
    },
    {
      order: 3,
      action: "Keep write-heavy launch jobs in preview or manual-export mode until Supabase persistence is durable.",
      owner: "platform_admin",
      evidenceRequired: "Persistence mode, Supabase configured keys, and launch checklist blocker export."
    },
    {
      order: 4,
      action: "Re-run protected smoke checks for link health, cutover readiness, partner APIs, and admin operations.",
      owner: "platform_admin",
      evidenceRequired: "Timestamped smoke output and link-health status."
    }
  ];
  const blockers = [
    ...cutover.blockers.map((blocker) => `Cutover: ${blocker}`),
    ...(linkHealth.status === "passed" ? [] : [`Link health has ${linkHealth.invalidCount} invalid routes.`])
  ];
  const result: Omit<RollbackEvidenceResult, "csv"> = {
    generatedAt: new Date().toISOString(),
    format,
    status: blockers.length ? "blocked" : "ready_to_archive",
    deployment: {
      canonicalUrl: deployment.canonicalUrl,
      activeDeploymentUrl: deployment.activeDeploymentUrl,
      environment: deployment.environment,
      commitSha: deployment.commitSha,
      persistenceMode: deployment.persistenceMode
    },
    cutover: {
      status: cutover.status,
      targetDomain: cutover.targetDomain,
      blockerCount: cutover.blockers.length,
      ownerActionCount: cutover.ownerActions.length
    },
    linkHealth: {
      status: linkHealth.status,
      total: linkHealth.total,
      invalidCount: linkHealth.invalidCount
    },
    rollbackSteps,
    blockers,
    nextActions: [
      "Archive this evidence before DNS changes or production credential installation.",
      "Attach the Vercel deployment URL and commit SHA to the owner launch approval record.",
      ...(blockers.length
        ? ["Resolve cutover blockers before treating rollback evidence as final."]
        : ["Rollback evidence is ready to archive with launch approval notes."])
    ]
  };

  return {
    ...result,
    csv: format === "csv" ? buildCsv(result) : undefined
  };
}
