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

type SandboxChecklistStep = {
  key: string;
  title: string;
  owner: "platform_admin" | "partner_engineer" | "partner_ops";
  requiredScopes: string[];
  endpoint: string;
  completionSignal: string;
  blocker: string;
};

const partnerRouteOrder = [
  "/api/v1/partner/providers",
  "/api/v1/partner/events",
  "/api/v1/partner/usage",
  "/api/v1/partner/onboarding-checklist",
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

export function getPartnerSandboxOnboardingChecklist() {
  const signingGuide = getWebhookSigningGuide();

  const steps: SandboxChecklistStep[] = [
    {
      key: "create-sandbox-client",
      title: "Create a sandbox API client with least-privilege scopes",
      owner: "platform_admin",
      requiredScopes: [],
      endpoint: "POST /api/v1/admin/api-clients",
      completionSignal: "Client has sandboxMode=true, status=active, rate limit, owner type, and approved scopes.",
      blocker: "Do not issue live-mode clients until partner business owner, data use, and webhook purpose are approved."
    },
    {
      key: "mint-sandbox-key",
      title: "Mint one sandbox key and store the secret outside The Senior Guru",
      owner: "platform_admin",
      requiredScopes: [],
      endpoint: "POST /api/v1/admin/api-clients/{id}/keys",
      completionSignal: "Key preview is visible in admin records and the full secret was copied once into the partner vault.",
      blocker: "Lost secrets must be revoked and reissued; backend never exposes stored key material."
    },
    {
      key: "read-provider-inventory",
      title: "Call provider inventory from the partner environment",
      owner: "partner_engineer",
      requiredScopes: ["providers:read"],
      endpoint: "GET /api/v1/partner/providers",
      completionSignal: "Response includes provider records and rate-limit headers with x-senior-guru-sandbox=true.",
      blocker: "403 responses mean the key is missing providers:read scope or the client is paused/revoked."
    },
    {
      key: "read-community-events",
      title: "Call event inventory and confirm date/location handling",
      owner: "partner_engineer",
      requiredScopes: ["events:read"],
      endpoint: "GET /api/v1/partner/events",
      completionSignal: "Response includes event records with community-safe metadata for sandbox validation.",
      blocker: "Do not mirror events publicly until partner display rules and sponsorship disclosures are reviewed."
    },
    {
      key: "verify-usage-evidence",
      title: "Review JSON and CSV usage evidence",
      owner: "partner_ops",
      requiredScopes: ["usage:read"],
      endpoint: "GET /api/v1/partner/usage?format=csv",
      completionSignal: "Usage export shows allowed, blocked, and rate-limited calls for partner operations review.",
      blocker: "Missing usage evidence blocks production promotion because launch operations cannot audit partner access."
    },
    {
      key: "create-webhook-subscription",
      title: "Register the sandbox webhook endpoint",
      owner: "platform_admin",
      requiredScopes: ["webhooks:write"],
      endpoint: "POST /api/v1/admin/webhook-subscriptions",
      completionSignal: "Subscription uses HTTPS, approved event types, active status, and a one-time signing secret.",
      blocker: "HTTP targets, unsupported events, and missing signing-secret custody block subscription approval."
    },
    {
      key: "verify-webhook-signatures",
      title: "Verify webhook signatures against the deterministic sample",
      owner: "partner_engineer",
      requiredScopes: ["webhooks:write"],
      endpoint: "POST /api/v1/partner/webhooks/verify",
      completionSignal: `Partner code validates ${signingGuide.signatureHeader} using ${signingGuide.algorithm} over ${signingGuide.signedContent}.`,
      blocker: "Parsing JSON before verifying the raw body can invalidate signatures and blocks production approval."
    },
    {
      key: "review-production-promotion",
      title: "Review sandbox evidence before live promotion",
      owner: "partner_ops",
      requiredScopes: ["providers:read", "events:read", "usage:read", "webhooks:write"],
      endpoint: "GET /api/v1/admin/api-usage-analytics",
      completionSignal: "Admin usage analytics, webhook delivery evidence, link-health, and OpenAPI coverage are reviewed.",
      blocker: "Production mode remains blocked until owner approves partner purpose, scopes, rate limits, and webhook events."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "Partner Sandbox Onboarding Checklist",
    mode: "sandbox",
    objective:
      "Move a partner from scoped sandbox access to production approval with auditable API usage, webhook verification, and explicit owner review.",
    minimumScopes: ["providers:read", "events:read", "usage:read"],
    optionalScopes: ["webhooks:write", "reviews:read", "campaigns:read", "ads:read", "claims:write"],
    promotionControls: [
      "Sandbox clients must keep sandboxMode=true until owner approval is recorded.",
      "Partner keys are secret-once and revocation-first if custody is uncertain.",
      "Webhook subscriptions require HTTPS, approved event types, and raw-body signature verification.",
      "Usage evidence and rate-limit headers must be reviewed before live promotion."
    ],
    steps,
    nextActions: [
      "Create or confirm a sandbox API client in the admin Open API console.",
      "Run provider, event, usage, and webhook signature checks from the partner environment.",
      "Export usage and webhook evidence before requesting production promotion."
    ]
  };
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
    sandboxOnboarding: getPartnerSandboxOnboardingChecklist(),
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
