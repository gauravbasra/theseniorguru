import { recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getDnsCutoverApprovalSummary } from "@/lib/system/dns-cutover-approval";
import { getLinkHealthSummary } from "@/lib/system/link-health";

export type PublicDomainSmokeInput = {
  actorId?: string;
  dryRun?: boolean;
  targetUrl?: string;
  notes?: string;
};

export type PublicDomainSmokeCheck = {
  key: string;
  label: string;
  path: string;
  url: string;
  status: "passed" | "blocked" | "warning";
  httpStatus?: number;
  contentType?: string;
  elapsedMs?: number;
  evidence: Record<string, unknown>;
  blockers: string[];
  nextActions: string[];
};

export type PublicDomainSmokeResult = {
  generatedAt: string;
  status: "passed" | "blocked" | "warning";
  dryRun: boolean;
  targetUrl: string;
  expectedFinalDomain: string;
  activeDeploymentUrl?: string;
  canonicalUrl: string;
  commitSha?: string;
  checks: PublicDomainSmokeCheck[];
  blockers: string[];
  nextActions: string[];
  auditEvent?: OperationalAuditEvent;
};

const expectedFinalDomain = "https://theseniorguru.com";
const defaultTimeoutMs = 8000;

const publicChecks = [
  {
    key: "home",
    label: "Public home page",
    path: "/",
    expectedText: "Senior"
  },
  {
    key: "discover",
    label: "Discover page",
    path: "/discover",
    expectedText: "Search"
  },
  {
    key: "operators",
    label: "Operators page",
    path: "/operators",
    expectedText: "Operator"
  },
  {
    key: "seniors",
    label: "Seniors page",
    path: "/seniors",
    expectedText: "Senior"
  },
  {
    key: "robots",
    label: "Robots policy",
    path: "/robots.txt",
    expectedText: "User-Agent"
  },
  {
    key: "sitemap",
    label: "Sitemap XML",
    path: "/sitemap.xml",
    expectedText: "<urlset"
  }
];

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeTargetUrl(value?: string) {
  const candidate = value?.trim() || expectedFinalDomain;

  try {
    const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Unsupported protocol");
    }
    return trimTrailingSlash(url.toString());
  } catch {
    throw new Error("targetUrl must be a valid http or https URL");
  }
}

function checkUrl(targetUrl: string, path: string) {
  return `${trimTrailingSlash(targetUrl)}${path}`;
}

function isFinalDomain(targetUrl: string) {
  return trimTrailingSlash(targetUrl) === expectedFinalDomain;
}

async function fetchWithTimeout(url: string) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "theseniorguru-public-domain-smoke/1.0"
      }
    });
    const body = await response.text();

    return {
      response,
      body,
      elapsedMs: Date.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPublicCheck(targetUrl: string, check: (typeof publicChecks)[number]): Promise<PublicDomainSmokeCheck> {
  const url = checkUrl(targetUrl, check.path);

  try {
    const { response, body, elapsedMs } = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") ?? undefined;
    const expectedTextFound = body.includes(check.expectedText);
    const blockers = [
      ...(!response.ok ? [`${check.label} returned HTTP ${response.status}.`] : []),
      ...(response.ok && !expectedTextFound ? [`${check.label} did not include expected public content marker.`] : [])
    ];

    return {
      key: check.key,
      label: check.label,
      path: check.path,
      url,
      status: blockers.length ? "blocked" : "passed",
      httpStatus: response.status,
      contentType,
      elapsedMs,
      evidence: {
        redirectedUrl: response.url,
        expectedText: check.expectedText,
        expectedTextFound,
        contentLength: body.length
      },
      blockers,
      nextActions: blockers.length ? [`Fix ${check.path} on ${targetUrl} before marking public-domain smoke as passed.`] : []
    };
  } catch (error) {
    return {
      key: check.key,
      label: check.label,
      path: check.path,
      url,
      status: "blocked",
      evidence: {
        error: error instanceof Error ? error.message : "Unknown fetch error"
      },
      blockers: [`${check.label} could not be fetched from ${url}.`],
      nextActions: ["Verify DNS, SSL, Vercel aliasing, and public route availability, then rerun public-domain smoke."]
    };
  }
}

export async function getPublicDomainSmoke(input: PublicDomainSmokeInput = {}): Promise<PublicDomainSmokeResult> {
  const targetUrl = normalizeTargetUrl(input.targetUrl);
  const [deployment, dnsApproval, linkHealth] = await Promise.all([
    Promise.resolve(getDeploymentStatus()),
    getDnsCutoverApprovalSummary(),
    Promise.resolve(getLinkHealthSummary())
  ]);
  const checks = await Promise.all(publicChecks.map((check) => runPublicCheck(targetUrl, check)));
  const targetIsFinalDomain = isFinalDomain(targetUrl);
  const dnsApproved = dnsApproval.latestApproval?.status === "approved_ready_for_dns";
  const canonicalReady = deployment.canonicalUrl === expectedFinalDomain;
  const readinessBlockers = [
    ...(targetIsFinalDomain && !dnsApproved ? ["Owner DNS cutover approval is not approved_ready_for_dns."] : []),
    ...(targetIsFinalDomain && !canonicalReady ? ["NEXT_PUBLIC_APP_URL is not the final theseniorguru.com domain."] : []),
    ...(linkHealth.status === "passed" ? [] : [`Internal link-health is ${linkHealth.status}.`])
  ];
  const blockers = uniq([...checks.flatMap((check) => check.blockers), ...readinessBlockers]);
  const warnings = [
    ...(!targetIsFinalDomain
      ? [`Smoke target is ${targetUrl}; final public-domain smoke still needs ${expectedFinalDomain} after DNS cutover.`]
      : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "passed",
    dryRun: input.dryRun ?? true,
    targetUrl,
    expectedFinalDomain,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    canonicalUrl: deployment.canonicalUrl,
    commitSha: deployment.commitSha,
    checks,
    blockers,
    nextActions: uniq([
      ...warnings,
      ...(blockers.length ? ["Resolve blocked public-domain smoke checks before declaring DNS cutover complete."] : []),
      "Archive public-domain smoke after DNS propagation and before marking final cutover complete."
    ])
  };
}

export async function recordPublicDomainSmoke(input: PublicDomainSmokeInput = {}) {
  const result = await getPublicDomainSmoke(input);
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: "public_domain_smoke.archived",
    subjectType: "production_cutover",
    subjectId: "public-domain-smoke",
    payload: {
      status: result.status,
      dryRun: result.dryRun,
      notes: input.notes,
      targetUrl: result.targetUrl,
      expectedFinalDomain: result.expectedFinalDomain,
      activeDeploymentUrl: result.activeDeploymentUrl,
      canonicalUrl: result.canonicalUrl,
      commitSha: result.commitSha,
      checkStatuses: result.checks.map((check) => ({ key: check.key, status: check.status, httpStatus: check.httpStatus })),
      blockerCount: result.blockers.length,
      blockers: result.blockers,
      generatedAt: result.generatedAt
    }
  });

  return { ...result, auditEvent };
}

export function summarizePublicDomainSmokeAudit(event: OperationalAuditEvent | undefined) {
  if (!event) return undefined;

  return {
    id: event.id,
    createdAt: event.createdAt,
    actorId: event.actorId,
    status: typeof event.payload.status === "string" ? event.payload.status : "unknown",
    targetUrl: typeof event.payload.targetUrl === "string" ? event.payload.targetUrl : undefined
  };
}
