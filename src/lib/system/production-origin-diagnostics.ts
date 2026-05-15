import { getDeploymentStatus } from "@/lib/system/deployment";

export type ProductionOriginProbe = {
  key: string;
  label: string;
  targetUrl: string;
  runtimeMarkerUrl: string;
  status: "passed" | "blocked";
  httpStatus?: number;
  contentType?: string;
  elapsedMs?: number;
  evidence: {
    redirectedUrl?: string;
    serverHeader?: string;
    vercelId?: string;
    runtimeMarkerFound?: boolean;
    nextRuntimeDetected?: boolean;
    apacheDetected?: boolean;
    bodyPreview?: string;
    fallbackRuntimeMarkerUrl?: string;
    fallbackHttpStatus?: number;
    fallbackServerHeader?: string;
    fallbackApacheDetected?: boolean;
    fallbackBodyPreview?: string;
    error?: string;
  };
  blockers: string[];
  nextActions: string[];
};

export type ProductionOriginDiagnostics = {
  generatedAt: string;
  status: "passed" | "blocked";
  expectedFinalDomain: string;
  canonicalUrl: string;
  activeDeploymentUrl?: string;
  environment: string;
  commitSha?: string;
  probes: ProductionOriginProbe[];
  blockers: string[];
  nextActions: string[];
};

const expectedFinalDomain = "https://theseniorguru.com";
const timeoutMs = 8000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeUrl(value?: string) {
  if (!value) return undefined;
  const candidate = value.trim();

  if (!candidate) return undefined;

  const url = new URL(candidate.startsWith("http") ? candidate : `https://${candidate}`);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("target URL must use http or https");
  }

  return trimTrailingSlash(url.toString());
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function fetchRuntimeMarker(runtimeMarkerUrl: string) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(runtimeMarkerUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "theseniorguru-production-origin-diagnostics/1.0"
      }
    });
    const body = await response.text();

    return { response, body, elapsedMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

function runtimeMarkerUrl(targetUrl: string) {
  return `${trimTrailingSlash(targetUrl)}/api/v1/runtime-marker`;
}

function httpFallbackRuntimeMarkerUrl(targetUrl: string) {
  const url = new URL(targetUrl);

  if (url.protocol !== "https:") return undefined;

  url.protocol = "http:";

  return runtimeMarkerUrl(trimTrailingSlash(url.toString()));
}

async function probeOrigin(key: string, label: string, targetUrl: string): Promise<ProductionOriginProbe> {
  const markerUrl = runtimeMarkerUrl(targetUrl);

  try {
    const { response, body, elapsedMs } = await fetchRuntimeMarker(markerUrl);
    const contentType = response.headers.get("content-type") ?? undefined;
    const serverHeader = response.headers.get("server") ?? undefined;
    const vercelId = response.headers.get("x-vercel-id") ?? undefined;
    const runtimeMarkerFound = body.includes("theseniorguru-next-runtime");
    const nextRuntimeDetected = runtimeMarkerFound || Boolean(vercelId);
    const apacheDetected = Boolean(serverHeader?.toLowerCase().includes("apache")) || body.includes("-//IETF//DTD HTML 2.0//EN");
    const blockers = [
      ...(!response.ok ? [`${label} runtime marker returned HTTP ${response.status}.`] : []),
      ...(!runtimeMarkerFound ? [`${label} did not return the TheSeniorGuru Next runtime marker.`] : []),
      ...(apacheDetected ? [`${label} appears to be served by Apache or an old origin instead of the Next runtime.`] : [])
    ];

    return {
      key,
      label,
      targetUrl,
      runtimeMarkerUrl: markerUrl,
      status: blockers.length ? "blocked" : "passed",
      httpStatus: response.status,
      contentType,
      elapsedMs,
      evidence: {
        redirectedUrl: response.url,
        serverHeader,
        vercelId,
        runtimeMarkerFound,
        nextRuntimeDetected,
        apacheDetected,
        bodyPreview: body.slice(0, 160)
      },
      blockers,
      nextActions: blockers.length
        ? [`Point ${targetUrl} to the approved Next/Vercel deployment and rerun origin diagnostics.`]
        : []
    };
  } catch (error) {
    const fallbackUrl = httpFallbackRuntimeMarkerUrl(targetUrl);
    let fallbackEvidence: ProductionOriginProbe["evidence"] = {};
    let fallbackBlockers: string[] = [];

    if (fallbackUrl) {
      try {
        const { response, body } = await fetchRuntimeMarker(fallbackUrl);
        const fallbackServerHeader = response.headers.get("server") ?? undefined;
        const fallbackApacheDetected =
          Boolean(fallbackServerHeader?.toLowerCase().includes("apache")) || body.includes("-//IETF//DTD HTML 2.0//EN");

        fallbackEvidence = {
          fallbackRuntimeMarkerUrl: fallbackUrl,
          fallbackHttpStatus: response.status,
          fallbackServerHeader,
          fallbackApacheDetected,
          fallbackBodyPreview: body.slice(0, 160),
          apacheDetected: fallbackApacheDetected,
          runtimeMarkerFound: body.includes("theseniorguru-next-runtime"),
          nextRuntimeDetected: body.includes("theseniorguru-next-runtime")
        };
        fallbackBlockers = [
          ...(!response.ok ? [`${label} HTTP fallback runtime marker returned HTTP ${response.status}.`] : []),
          ...(fallbackApacheDetected ? [`${label} HTTP fallback appears to be served by Apache or an old origin.`] : [])
        ];
      } catch {
        fallbackEvidence = { fallbackRuntimeMarkerUrl: fallbackUrl };
      }
    }

    return {
      key,
      label,
      targetUrl,
      runtimeMarkerUrl: markerUrl,
      status: "blocked",
      evidence: {
        error: error instanceof Error ? error.message : "Unknown fetch error",
        ...fallbackEvidence
      },
      blockers: [`${label} runtime marker could not be fetched from ${markerUrl}.`, ...fallbackBlockers],
      nextActions: ["Verify DNS, SSL, deployment aliasing, and network reachability, then rerun origin diagnostics."]
    };
  }
}

export async function getProductionOriginDiagnostics(input: { targetUrl?: string } = {}): Promise<ProductionOriginDiagnostics> {
  const deployment = getDeploymentStatus();
  const finalDomain = normalizeUrl(input.targetUrl) ?? expectedFinalDomain;
  const targets = [
    { key: "final_domain", label: "Final public domain", url: finalDomain },
    ...(deployment.activeDeploymentUrl
      ? [{ key: "active_deployment", label: "Active deployment URL", url: trimTrailingSlash(deployment.activeDeploymentUrl) }]
      : [])
  ];
  const probes = await Promise.all(targets.map((target) => probeOrigin(target.key, target.label, target.url)));
  const blockers = uniq([
    ...probes.flatMap((probe) => probe.blockers),
    ...(deployment.canonicalUrl === expectedFinalDomain ? [] : ["NEXT_PUBLIC_APP_URL is not configured for https://theseniorguru.com."]),
    ...(deployment.activeDeploymentUrl ? [] : ["No active Vercel deployment URL is visible to the app runtime."])
  ]);

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : "passed",
    expectedFinalDomain,
    canonicalUrl: deployment.canonicalUrl,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    environment: deployment.environment,
    commitSha: deployment.commitSha,
    probes,
    blockers,
    nextActions: uniq(
      blockers.length
        ? [
            "Resolve origin blockers before treating public-domain cutover as ready.",
            "Rerun /api/v1/system/public-domain-smoke after DNS and deployment alias changes."
          ]
        : ["Archive origin diagnostics with the DNS cutover evidence bundle."]
    )
  };
}
