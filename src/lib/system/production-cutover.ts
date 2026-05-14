import { getDeploymentStatus } from "@/lib/system/deployment";
import { getLatestDnsCutoverApproval } from "@/lib/system/dns-cutover-approval";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getPersistenceStatus } from "@/lib/system/persistence";

export type ProductionCutoverCheck = {
  key: string;
  label: string;
  status: "ready" | "blocked" | "owner_action_required";
  evidence: Record<string, unknown>;
  blockers: string[];
  nextActions: string[];
};

export type ProductionCutoverReadiness = {
  generatedAt: string;
  status: "ready" | "blocked";
  targetDomain: string;
  activeDeploymentUrl?: string;
  checks: ProductionCutoverCheck[];
  blockers: string[];
  ownerActions: string[];
  nextActions: string[];
};

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function checkStatus(blockers: string[], ownerActions: string[] = []): ProductionCutoverCheck["status"] {
  if (blockers.length) return "blocked";
  if (ownerActions.length) return "owner_action_required";
  return "ready";
}

export async function getProductionCutoverReadiness(): Promise<ProductionCutoverReadiness> {
  const [deployment, launchChecklist, dnsApproval] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getLaunchChecklist(),
    getLatestDnsCutoverApproval()
  ]);
  const persistence = getPersistenceStatus();
  const targetDomain = "https://theseniorguru.com";
  const canonicalMatchesTarget = deployment.canonicalUrl === targetDomain;
  const vercelProductionReady = deployment.platform === "vercel" && deployment.environment === "production" && Boolean(deployment.activeDeploymentUrl);
  const dnsApproved = dnsApproval?.status === "approved_ready_for_dns";
  const nonOwnerLaunchBlockers = launchChecklist.checklist
    .filter((item) => item.key !== "owner_items")
    .flatMap((item) => item.blockers);

  const checks: ProductionCutoverCheck[] = [
    {
      key: "canonical_domain_config",
      label: "Canonical domain configuration",
      status: checkStatus(canonicalMatchesTarget ? [] : ["NEXT_PUBLIC_APP_URL does not match https://theseniorguru.com."]),
      evidence: {
        canonicalUrl: deployment.canonicalUrl,
        targetDomain,
        domainStatus: deployment.domainStatus
      },
      blockers: canonicalMatchesTarget ? [] : ["NEXT_PUBLIC_APP_URL does not match https://theseniorguru.com."],
      nextActions: canonicalMatchesTarget ? [] : ["Set NEXT_PUBLIC_APP_URL to https://theseniorguru.com before DNS cutover."]
    },
    {
      key: "vercel_production_alias",
      label: "Vercel production deployment",
      status: checkStatus(vercelProductionReady ? [] : ["No production Vercel deployment alias is visible to the app runtime."]),
      evidence: {
        platform: deployment.platform,
        environment: deployment.environment,
        activeDeploymentUrl: deployment.activeDeploymentUrl,
        commitSha: deployment.commitSha
      },
      blockers: vercelProductionReady ? [] : ["No production Vercel deployment alias is visible to the app runtime."],
      nextActions: vercelProductionReady ? [] : ["Deploy and alias the production build before DNS cutover."]
    },
    {
      key: "persistent_database",
      label: "Persistent Supabase database",
      status: checkStatus(persistence.mode === "supabase_persistent" ? [] : ["Backend writes are still using fallback memory."]),
      evidence: {
        mode: persistence.mode,
        durableAcrossDeploys: persistence.durableAcrossDeploys,
        configured: persistence.configured
      },
      blockers: persistence.mode === "supabase_persistent" ? [] : ["Backend writes are still using fallback memory."],
      nextActions: persistence.ownerActions
    },
    {
      key: "launch_go_no_go",
      label: "Launch go/no-go checklist",
      status: checkStatus(nonOwnerLaunchBlockers, launchChecklist.ownerParkedItems),
      evidence: {
        checklistStatus: launchChecklist.status,
        checklistItems: launchChecklist.checklist.length,
        ownerParkedItems: launchChecklist.ownerParkedItems.length
      },
      blockers: nonOwnerLaunchBlockers,
      nextActions: launchChecklist.nextActions
    },
    {
      key: "owner_dns_approval",
      label: "Owner DNS cutover approval",
      status: dnsApproved ? "ready" : "owner_action_required",
      evidence: {
        targetDomain,
        activeDeploymentUrl: deployment.activeDeploymentUrl,
        latestApprovalStatus: dnsApproval?.status ?? "not_recorded",
        latestApprovalAt: dnsApproval?.auditEvent.createdAt,
        latestApprovalId: dnsApproval?.auditEvent.id,
        requiredApproval: "Owner must approve DNS A/CNAME cutover timing."
      },
      blockers: [],
      nextActions: dnsApproved
        ? ["Run post-cutover production smoke checks immediately after DNS changes."]
        : [
            "Confirm whether theseniorguru.com should point to Vercel now or remain on the existing host until production credentials are installed.",
            "Archive the active deployment URL, commit SHA, and rollback target before changing DNS records.",
            "Record the owner DNS approval decision through /api/v1/system/dns-cutover-approval."
          ]
    }
  ];
  const blockers = uniq(checks.flatMap((check) => check.blockers));
  const ownerActions = uniq(checks.filter((check) => check.status === "owner_action_required").flatMap((check) => check.nextActions));

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "ready",
    targetDomain,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    checks,
    blockers,
    ownerActions,
    nextActions: uniq([
      ...checks.flatMap((check) => check.nextActions),
      ...(blockers.length
        ? ["Do not cut over production DNS until blockers are resolved and owner approval is recorded."]
        : ["Production cutover gates are clear except owner-controlled DNS timing approval."])
    ])
  };
}
