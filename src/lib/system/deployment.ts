import { getAppEnv } from "@/lib/env";
import { getPersistenceStatus } from "@/lib/system/persistence";

export type DeploymentStatus = {
  generatedAt: string;
  canonicalUrl: string;
  activeDeploymentUrl?: string;
  platform: "vercel" | "self_hosted_or_local";
  environment: string;
  commitSha?: string;
  domainStatus: "canonical_ready" | "vercel_preview_ready" | "local_only";
  persistenceMode: "supabase_persistent" | "fallback_memory";
  ownerActions: string[];
};

function normalizeUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.startsWith("http") ? value : `https://${value}`;
}

export function getDeploymentStatus(): DeploymentStatus {
  const env = getAppEnv();
  const activeDeploymentUrl = normalizeUrl(env.vercelUrl);
  const canonicalUrl = env.appUrl;
  const isCanonicalReady = canonicalUrl.includes("theseniorguru.com");
  const isVercelReady = Boolean(activeDeploymentUrl && env.vercelEnv === "production");
  const persistence = getPersistenceStatus();

  return {
    generatedAt: new Date().toISOString(),
    canonicalUrl,
    activeDeploymentUrl,
    platform: activeDeploymentUrl ? "vercel" : "self_hosted_or_local",
    environment: env.vercelEnv ?? "local",
    commitSha: env.vercelGitCommitSha,
    domainStatus: isCanonicalReady ? "canonical_ready" : isVercelReady ? "vercel_preview_ready" : "local_only",
    persistenceMode: persistence.mode,
    ownerActions: [
      ...(isCanonicalReady ? [] : ["Set NEXT_PUBLIC_APP_URL to https://theseniorguru.com in production."]),
      ...persistence.ownerActions,
      "Approve theseniorguru.com DNS cutover before changing A/CNAME records.",
      "Add production Supabase, Mailjet, and ads credentials in the deployment environment."
    ]
  };
}
