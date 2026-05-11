import { getAppEnv } from "@/lib/env";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getPersistenceStatus } from "@/lib/system/persistence";

type ReadinessCheck = {
  key: string;
  label: string;
  status: "ready" | "missing" | "partial" | "parked";
  action?: string;
};

function groupStatus(checks: ReadinessCheck[]) {
  if (checks.every((check) => check.status === "ready")) {
    return "ready";
  }

  if (checks.some((check) => check.status === "ready" || check.status === "partial")) {
    return "partial";
  }

  return "missing";
}

export function getSystemReadiness() {
  const env = getAppEnv();
  const deployment = getDeploymentStatus();
  const persistence = getPersistenceStatus();
  const supabaseChecks: ReadinessCheck[] = [
    {
      key: "PERSISTENCE_MODE",
      label: "Persistent backend storage",
      status: persistence.durableAcrossDeploys ? "ready" : "missing",
      action: persistence.durableAcrossDeploys
        ? "Supabase persistence is active."
        : "Supabase is not configured; API writes use fallback memory and do not survive deployments."
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "Supabase project URL",
      status: env.supabaseUrl ? "ready" : "missing",
      action: env.supabaseUrl ? undefined : "Provide production Supabase URL."
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Supabase browser key",
      status: env.supabaseAnonKey ? "ready" : "missing",
      action: env.supabaseAnonKey ? undefined : "Provide Supabase anon/publishable key."
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Supabase server service key",
      status: env.supabaseServiceRoleKey ? "ready" : "missing",
      action: env.supabaseServiceRoleKey ? undefined : "Provide server-only service role key for import/admin APIs."
    },
    {
      key: "SUPABASE_SCHEMA_READINESS",
      label: "Supabase schema readiness endpoint",
      status: "ready",
      action: "GET /api/v1/system/supabase-schema checks live table coverage; GET /api/v1/system/supabase-migration-plan returns migration order and owner blockers."
    }
  ];
  const emailChecks: ReadinessCheck[] = [
    {
      key: "MAILJET_API_KEY",
      label: "Mailjet API key",
      status: env.mailjetApiKey ? "ready" : "missing",
      action: env.mailjetApiKey ? undefined : "Provide Mailjet API key for provider outreach."
    },
    {
      key: "MAILJET_API_SECRET",
      label: "Mailjet API secret",
      status: env.mailjetApiSecret ? "ready" : "missing",
      action: env.mailjetApiSecret ? undefined : "Provide Mailjet API secret for provider outreach."
    }
  ];
  const adsChecks: ReadinessCheck[] = [
    {
      key: "GOOGLE_ADS_CLIENT_ID",
      label: "Google Ads client ID",
      status: env.googleAdsClientId ? "ready" : "missing",
      action: env.googleAdsClientId ? undefined : "Provide Google Ads or Ad Manager OAuth client ID."
    },
    {
      key: "GOOGLE_ADS_CLIENT_SECRET",
      label: "Google Ads client secret",
      status: env.googleAdsClientSecret ? "ready" : "missing",
      action: env.googleAdsClientSecret ? undefined : "Provide Google Ads or Ad Manager OAuth client secret."
    },
    {
      key: "GOOGLE_ADS_DEVELOPER_TOKEN",
      label: "Google Ads developer token",
      status: env.googleAdsDeveloperToken ? "ready" : "missing",
      action: env.googleAdsDeveloperToken ? undefined : "Provide Google Ads developer token or park direct-sold-only launch."
    }
  ];
  const hostingChecks: ReadinessCheck[] = [
    {
      key: "ACTIVE_DEPLOYMENT_URL",
      label: "Active deployment URL",
      status: deployment.activeDeploymentUrl ? "ready" : "partial",
      action: deployment.activeDeploymentUrl
        ? `Current deployment is ${deployment.activeDeploymentUrl}.`
        : "Deploy to production hosting and confirm public URL."
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      label: "Canonical application URL",
      status: env.appUrl.includes("theseniorguru.com") ? "ready" : "partial",
      action: env.appUrl.includes("theseniorguru.com") ? undefined : "Set NEXT_PUBLIC_APP_URL to https://theseniorguru.com in production."
    },
    {
      key: "THEVAULTED_ISOLATION",
      label: "TheVaulted isolation",
      status: "ready",
      action: "Deployment docs isolate Senior Guru under /opt/theseniorguru and port 3051."
    }
  ];
  const authChecks: ReadinessCheck[] = [
    {
      key: "ADMIN_ACCESS_CODE",
      label: "Owner backend access code",
      status: env.adminAccessCode ? "ready" : "partial",
      action: env.adminAccessCode ? undefined : "Set ADMIN_ACCESS_CODE in Vercel to replace temporary launch access."
    },
    {
      key: "ADMIN_SESSION_SECRET",
      label: "Owner session signing secret",
      status: env.adminSessionSecret ? "ready" : "partial",
      action: env.adminSessionSecret ? undefined : "Set ADMIN_SESSION_SECRET in Vercel for durable signed admin sessions."
    }
  ];
  const parkedChecks: ReadinessCheck[] = [
    {
      key: "DNS_CONFIRMATION",
      label: "DNS cutover approval",
      status: "parked",
      action: "Owner must approve before changing theseniorguru.com DNS records."
    },
    {
      key: "LEGAL_REVIEW",
      label: "Legal/policy launch review",
      status: "parked",
      action: "Owner/legal review required before public AI newsroom, claims, and paid placements launch."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    persistence,
    overallStatus:
      [supabaseChecks, emailChecks, adsChecks, hostingChecks, authChecks].every((checks) => groupStatus(checks) === "ready")
        ? "ready"
        : "action_required",
    groups: {
      supabase: {
        status: groupStatus(supabaseChecks),
        checks: supabaseChecks
      },
      email: {
        status: groupStatus(emailChecks),
        checks: emailChecks
      },
      ads: {
        status: groupStatus(adsChecks),
        checks: adsChecks
      },
      hosting: {
        status: groupStatus(hostingChecks),
        checks: hostingChecks
      },
      auth: {
        status: groupStatus(authChecks),
        checks: authChecks
      },
      parkedOwnerItems: {
        status: "parked",
        checks: parkedChecks
      }
    }
  };
}
