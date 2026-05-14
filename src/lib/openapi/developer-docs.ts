import { getOpenApiCatalog } from "@/lib/openapi/catalog";
import { getWebhookSigningGuide } from "@/lib/openapi/platform";

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
};

const partnerRouteOrder = [
  "/api/v1/partner/providers",
  "/api/v1/partner/events",
  "/api/v1/partner/usage",
  "/api/v1/partner/webhooks/signing-guide",
  "/api/v1/partner/webhooks/verify"
];

function getOperation(entries: unknown, method: string): OpenApiOperation | undefined {
  if (!entries || typeof entries !== "object") {
    return undefined;
  }

  const operation = (entries as Record<string, unknown>)[method];
  return operation && typeof operation === "object" ? (operation as OpenApiOperation) : undefined;
}

export function getPartnerDeveloperDocs() {
  const catalog = getOpenApiCatalog();
  const signingGuide = getWebhookSigningGuide();
  const paths = catalog.paths as Record<string, unknown>;
  const endpoints = Object.entries(paths)
    .flatMap(([path, operations]) =>
      ["get", "post", "patch", "delete"].flatMap((method) => {
        const operation = getOperation(operations, method);

        if (!operation) {
          return [];
        }

        return {
          path,
          method: method.toUpperCase(),
          summary: operation.summary ?? "Partner API operation",
          tags: operation.tags ?? []
        };
      })
    )
    .filter((endpoint) => endpoint.path.startsWith("/api/v1/partner/"))
    .sort((left, right) => {
      const leftIndex = partnerRouteOrder.indexOf(left.path);
      const rightIndex = partnerRouteOrder.indexOf(right.path);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return normalizedLeft - normalizedRight || left.path.localeCompare(right.path) || left.method.localeCompare(right.method);
    });

  return {
    generatedAt: new Date().toISOString(),
    version: catalog.info.version,
    title: "The Senior Guru Partner Developer Docs",
    baseUrl: catalog.servers[0]?.url ?? "https://theseniorguru.vercel.app",
    authentication: {
      type: "apiKey",
      header: catalog.components.securitySchemes.partnerApiKey.name,
      requiredScopes: ["providers:read", "events:read", "usage:read", "webhooks:write"]
    },
    endpoints,
    webhooks: {
      signatureHeader: signingGuide.signatureHeader,
      eventHeader: signingGuide.eventHeader,
      algorithm: signingGuide.algorithm,
      signedContent: signingGuide.signedContent,
      toleranceSeconds: signingGuide.toleranceSeconds,
      supportedEvents: signingGuide.supportedEvents,
      sampleSignature: signingGuide.sample.signature,
      sampleRawBody: signingGuide.sample.rawBody,
      verificationSteps: signingGuide.verificationSteps
    },
    operationalControls: [
      "All partner requests are audited by client, key, scope, subject, status, and rate-limit result.",
      "CSV usage evidence is available from /api/v1/partner/usage?format=csv with usage:read scope.",
      "Webhook subscriptions require HTTPS targets and expose signing secrets only once at creation.",
      "Failed webhook deliveries can be retried; historical deliveries can be replayed as fresh queued records with audit evidence.",
      "Replay evidence exports can be filtered by API client, event type, source status, replay status, subject, date window, and audited-only rows."
    ],
    nextActions: [
      "Issue a scoped sandbox API key from the admin Open API console.",
      "Call the providers or events endpoint with x-senior-guru-api-key.",
      "Create a webhook subscription and verify signatures against the signing guide sample.",
      "Review usage analytics and delivery evidence before moving a partner out of sandbox mode."
    ]
  };
}
