import { getOpenApiCatalog } from "@/lib/openapi/catalog";
import { getWebhookSigningGuide } from "@/lib/openapi/platform";

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
};

type SdkExample = {
  language: "node" | "python" | "curl";
  title: string;
  code: string;
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

function buildSdkExamples(signingGuide: ReturnType<typeof getWebhookSigningGuide>): SdkExample[] {
  const { secret, timestamp, rawBody, signature } = signingGuide.sample;

  return [
    {
      language: "node",
      title: "Verify a webhook signature in Node.js",
      code: [
        "import crypto from \"node:crypto\";",
        "",
        `const secret = \"${secret}\";`,
        `const timestamp = \"${timestamp}\";`,
        `const rawBody = ${JSON.stringify(rawBody)};`,
        `const signature = \"${signature}\";`,
        "const expectedDigest = crypto",
        "  .createHmac(\"sha256\", secret)",
        "  .update(`${timestamp}.${rawBody}`)",
        "  .digest(\"hex\");",
        "const suppliedDigest = signature.split(\"v1=\")[1];",
        "const valid = crypto.timingSafeEqual(Buffer.from(expectedDigest), Buffer.from(suppliedDigest));"
      ].join("\n")
    },
    {
      language: "python",
      title: "Verify a webhook signature in Python",
      code: [
        "import hmac",
        "import hashlib",
        "",
        `secret = \"${secret}\"`,
        `timestamp = \"${timestamp}\"`,
        `raw_body = ${JSON.stringify(rawBody)}`,
        `signature = \"${signature}\"`,
        "expected_digest = hmac.new(secret.encode(), f\"{timestamp}.{raw_body}\".encode(), hashlib.sha256).hexdigest()",
        "supplied_digest = signature.split(\"v1=\")[1]",
        "valid = hmac.compare_digest(expected_digest, supplied_digest)"
      ].join("\n")
    },
    {
      language: "curl",
      title: "Call the partner providers endpoint",
      code: [
        "curl -sS \\",
        "  -H \"x-senior-guru-api-key: $SENIOR_GURU_API_KEY\" \\",
        "  -H \"accept: application/json\" \\",
        "  https://theseniorguru.vercel.app/api/v1/partner/providers"
      ].join("\n")
    }
  ];
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
    sdkExamples: buildSdkExamples(signingGuide),
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
