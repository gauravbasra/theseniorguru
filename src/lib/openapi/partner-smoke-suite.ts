import { getPartnerDeveloperDocs } from "@/lib/openapi/developer-docs";
import { getOpenApiCatalog } from "@/lib/openapi/catalog";
import { getApiUsageAnalytics, listApiClients, listApiKeys } from "@/lib/openapi/platform";
import type { ApiClientScope } from "@/lib/domain/open-api";

type PartnerSmokeCheck = {
  key: string;
  method: "GET" | "POST";
  endpoint: string;
  contractPath?: string;
  requiredScope: ApiClientScope;
  assertion: string;
  smokeMode: "read_only" | "write_preview" | "signature_verification";
};

const partnerSmokeChecks: PartnerSmokeCheck[] = [
  {
    key: "providers-list",
    method: "GET",
    endpoint: "/api/v1/partner/providers?pageSize=2",
    requiredScope: "providers:read",
    assertion: "Returns provider records with response-envelope headers and meta.pagination.",
    smokeMode: "read_only"
  },
  {
    key: "provider-detail",
    method: "GET",
    endpoint: "/api/v1/partner/providers/seed-cottages-dayton-place",
    contractPath: "/api/v1/partner/providers/{id}",
    requiredScope: "providers:read",
    assertion: "Returns one provider with provenance metadata and without internal admin fields.",
    smokeMode: "read_only"
  },
  {
    key: "events-list",
    method: "GET",
    endpoint: "/api/v1/partner/events?pageSize=2",
    requiredScope: "events:read",
    assertion: "Returns event records with community-safe metadata and pagination.",
    smokeMode: "read_only"
  },
  {
    key: "reviews-list",
    method: "GET",
    endpoint: "/api/v1/partner/reviews?pageSize=2",
    requiredScope: "reviews:read",
    assertion: "Returns published reviews without reviewer email or moderation payloads.",
    smokeMode: "read_only"
  },
  {
    key: "community-posts-list",
    method: "GET",
    endpoint: "/api/v1/partner/community/posts?pageSize=2",
    requiredScope: "community:read",
    assertion: "Returns published community posts with sponsorship disclosure metadata.",
    smokeMode: "read_only"
  },
  {
    key: "newsroom-articles-list",
    method: "GET",
    endpoint: "/api/v1/partner/newsroom/articles?pageSize=2",
    requiredScope: "newsroom:read",
    assertion: "Returns published articles with attribution and preview-only body content.",
    smokeMode: "read_only"
  },
  {
    key: "ads-placement-list",
    method: "GET",
    endpoint: "/api/v1/partner/ads/placements?pageSize=2",
    requiredScope: "ads:read",
    assertion: "Returns active ad placements with disclosure labels and optional creative previews.",
    smokeMode: "read_only"
  },
  {
    key: "campaigns-list",
    method: "GET",
    endpoint: "/api/v1/partner/campaigns?pageSize=2",
    requiredScope: "campaigns:read",
    assertion: "Returns published, non-blocked campaigns and optional metrics only when requested.",
    smokeMode: "read_only"
  },
  {
    key: "usage-evidence",
    method: "GET",
    endpoint: "/api/v1/partner/usage?format=csv",
    requiredScope: "usage:read",
    assertion: "Returns usage evidence export with stable CSV headers for promotion review.",
    smokeMode: "read_only"
  },
  {
    key: "webhook-signature-verify",
    method: "POST",
    endpoint: "/api/v1/partner/webhooks/verify",
    requiredScope: "webhooks:write",
    assertion: "Verifies a deterministic webhook signature against an owned subscription.",
    smokeMode: "signature_verification"
  },
  {
    key: "claim-submit-preview",
    method: "POST",
    endpoint: "/api/v1/partner/claims",
    requiredScope: "claims:write",
    assertion: "Submits claim/correction payload only after claimant attestation and matching email evidence.",
    smokeMode: "write_preview"
  }
];

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function normalizePath(endpoint: string) {
  return endpoint.split("?")[0] ?? endpoint;
}

export async function getPartnerProductionSmokeSuite() {
  const [clients, usage] = await Promise.all([listApiClients(), getApiUsageAnalytics({ windowDays: 30 })]);
  const catalog = getOpenApiCatalog();
  const developerDocs = getPartnerDeveloperDocs();
  const catalogPaths = catalog.paths as Record<string, unknown>;
  const documentedPaths = new Set(developerDocs.endpoints.map((endpoint) => endpoint.path));
  const productionClients = clients.filter((client) => client.status === "active" && !client.sandboxMode);
  const sandboxClients = clients.filter((client) => client.status === "active" && client.sandboxMode);
  const activeKeyCounts = await Promise.all(
    clients.map(async (client) => ({
      apiClientId: client.id,
      activeKeys: (await listApiKeys(client.id)).filter((key) => key.status === "active").length
    }))
  );
  const requiredScopes = [...new Set(partnerSmokeChecks.map((check) => check.requiredScope))];
  const productionScopes = new Set(productionClients.flatMap((client) => client.scopes));
  const sandboxScopes = new Set(sandboxClients.flatMap((client) => client.scopes));
  const rows = partnerSmokeChecks.map((check) => {
    const path = check.contractPath ?? normalizePath(check.endpoint);
    const catalogEntry = catalogPaths[path] as Record<string, unknown> | undefined;
    const methodDocumented = Boolean(catalogEntry?.[check.method.toLowerCase()]);
    const developerDocsDocumented = documentedPaths.has(path);
    const productionScopeReady = productionScopes.has(check.requiredScope);
    const sandboxScopeReady = sandboxScopes.has(check.requiredScope);
    const status =
      methodDocumented && developerDocsDocumented && productionScopeReady
        ? "ready_for_live_smoke"
        : methodDocumented && developerDocsDocumented && sandboxScopeReady
          ? "ready_for_sandbox_smoke"
          : methodDocumented && developerDocsDocumented
            ? "blocked_missing_scoped_client"
            : "blocked_missing_documentation";

    return {
      ...check,
      path,
      catalogDocumented: methodDocumented,
      developerDocsDocumented,
      productionScopeReady,
      sandboxScopeReady,
      status
    };
  });
  const blockers = [
    ...(productionClients.length === 0 ? ["No active production-mode partner API client is available for live-key smoke execution."] : []),
    ...(!activeKeyCounts.some((client) => client.activeKeys > 0 && productionClients.some((record) => record.id === client.apiClientId))
      ? ["No active production-mode API key is available for live-key smoke execution."]
      : []),
    ...requiredScopes
      .filter((scope) => !productionScopes.has(scope))
      .map((scope) => `No production-mode API client currently carries ${scope}.`),
    ...(rows.some((row) => !row.catalogDocumented || !row.developerDocsDocumented)
      ? ["One or more smoke endpoints are missing OpenAPI or developer-docs coverage."]
      : [])
  ];
  const status =
    blockers.length === 0
      ? "ready_for_live_partner_smoke"
      : rows.every((row) => row.catalogDocumented && row.developerDocsDocumented)
        ? "blocked_pending_production_credentials"
        : "blocked_contract_gaps";

  return {
    generatedAt: new Date().toISOString(),
    title: "Partner Production Smoke Suite",
    status,
    mode: "readiness",
    requiredScopes,
    totals: {
      checks: rows.length,
      readyForLiveSmoke: rows.filter((row) => row.status === "ready_for_live_smoke").length,
      readyForSandboxSmoke: rows.filter((row) => row.status === "ready_for_sandbox_smoke").length,
      blocked: rows.filter((row) => row.status.startsWith("blocked_")).length,
      activeSandboxClients: sandboxClients.length,
      activeProductionClients: productionClients.length,
      activeProductionKeys: activeKeyCounts
        .filter((client) => productionClients.some((record) => record.id === client.apiClientId))
        .reduce((total, client) => total + client.activeKeys, 0),
      allowedRequestsLast30Days: usage.totals.allowed,
      blockedRequestsLast30Days: usage.totals.blocked,
      rateLimitedRequestsLast30Days: usage.totals.rateLimited
    },
    liveExecutionGuardrails: [
      "Run live partner smoke only with owner-approved production API keys stored outside this endpoint.",
      "Do not submit provider claims or webhook writes in live mode unless the partner purpose and rollback path are approved.",
      "Archive this suite output with API usage evidence before disabling sandboxMode for any client."
    ],
    blockers,
    nextActions:
      blockers.length === 0
        ? [
            "Run each smoke check with the approved production key and archive response headers, status codes, and payload shape evidence.",
            "Export partner usage after the smoke run and attach it to production promotion evidence."
          ]
        : [
            "Use this suite as the contract checklist while production partner credentials remain owner-dependent.",
            "Create or promote scoped API clients only after sandbox evidence and owner approval are reviewed.",
            "Keep page/pageSize assertions in the smoke suite until cursor pagination is implemented."
          ],
    rows
  };
}

export async function exportPartnerProductionSmokeSuiteCsv() {
  const suite = await getPartnerProductionSmokeSuite();
  const columns = [
    "key",
    "method",
    "endpoint",
    "requiredScope",
    "smokeMode",
    "status",
    "catalogDocumented",
    "developerDocsDocumented",
    "productionScopeReady",
    "sandboxScopeReady",
    "assertion"
  ] as const;
  const csv = [
    columns.join(","),
    ...suite.rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");

  return {
    filename: "partner-production-smoke-suite.csv",
    csv
  };
}
