import { getOpenApiCatalog } from "@/lib/openapi/catalog";
import { getWebhookSigningGuide } from "@/lib/openapi/platform";
import { partnerResponseEnvelopeMeta, partnerResponseEnvelopeVersion } from "@/lib/openapi/responses";
import { getLinkHealthSummary } from "@/lib/system/link-health";

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

type PartnerApiChangelogEntry = {
  version: string;
  releasedAt: string;
  status: "current" | "planned";
  summary: string;
  additions: string[];
  breakingChanges: string[];
  migrationNotes: string[];
  affectedEndpoints: string[];
};

type SdkPackage = {
  language: "node" | "python";
  packageName: string;
  status: "planned";
  publicModule: string;
  responsibilities: string[];
  releaseGate: string;
};

const partnerRouteOrder = [
  "/api/v1/partner/providers",
  "/api/v1/partner/providers/{id}",
  "/api/v1/partner/providers/{id}/visibility",
  "/api/v1/partner/events",
  "/api/v1/partner/events/{id}/analytics",
  "/api/v1/partner/reviews",
  "/api/v1/partner/community/posts",
  "/api/v1/partner/newsroom/articles",
  "/api/v1/partner/newsroom/newsletters",
  "/api/v1/partner/newsroom/performance",
  "/api/v1/partner/newsroom/readiness",
  "/api/v1/partner/newsroom/sources",
  "/api/v1/partner/ads/placements",
  "/api/v1/partner/campaigns",
  "/api/v1/partner/claims",
  "/api/v1/partner/claims/{id}",
  "/api/v1/partner/usage",
  "/api/v1/partner/onboarding-checklist",
  "/api/v1/partner/changelog",
  "/api/v1/partner/sdk-package-plan",
  "/api/v1/partner/sandbox-evidence",
  "/api/v1/partner/response-envelope",
  "/api/v1/partner/response-pagination",
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
      key: "read-provider-detail",
      title: "Call provider detail by id or slug with source provenance",
      owner: "partner_engineer",
      requiredScopes: ["providers:read"],
      endpoint: "GET /api/v1/partner/providers/{id}",
      completionSignal: "Response includes one approved provider record, source provenance, lookup metadata, partner envelope headers, and excludes internal admin notes or claim verification evidence.",
      blocker: "Do not hydrate partner provider profiles from non-approved statuses or from internal claim verification evidence."
    },
    {
      key: "read-provider-visibility",
      title: "Call provider visibility readiness without internal action links",
      owner: "partner_ops",
      requiredScopes: ["providers:read"],
      endpoint: "GET /api/v1/partner/providers/{id}/visibility",
      completionSignal: "Response includes aggregate provider readiness scores, metrics, missing public profile fields, and next-best-action labels without entitlement keys, internal URLs, or claim evidence.",
      blocker: "Do not use provider readiness evidence for partner ranking when internal entitlements, audit records, or claim verification evidence are required by the partner workflow."
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
      key: "read-event-analytics",
      title: "Call aggregate event analytics without attendee PII",
      owner: "partner_ops",
      requiredScopes: ["events:read"],
      endpoint: "GET /api/v1/partner/events/{id}/analytics",
      completionSignal: "Response includes aggregate RSVP, promotion, and ad metrics with partner envelope headers and no attendee names, emails, phones, or consent payloads.",
      blocker: "Do not share event performance externally if attendee PII, consent payloads, or provider-only notes are required by the partner workflow."
    },
    {
      key: "read-published-reviews",
      title: "Call published review inventory without reviewer email exposure",
      owner: "partner_engineer",
      requiredScopes: ["reviews:read"],
      endpoint: "GET /api/v1/partner/reviews",
      completionSignal: "Response includes only published reviews, provider context, pagination metadata, and no reviewer email field.",
      blocker: "Do not syndicate reviews until partner display rules, attribution, and moderation status handling are approved."
    },
    {
      key: "read-community-posts",
      title: "Call published community posts with sponsorship disclosures",
      owner: "partner_engineer",
      requiredScopes: ["community:read"],
      endpoint: "GET /api/v1/partner/community/posts",
      completionSignal: "Response includes only published community posts, optional location/topic filters, pagination metadata, and disclosure labels for sponsored posts.",
      blocker: "Do not mirror community content until partner moderation display rules and sponsored-content disclosure handling are approved."
    },
    {
      key: "read-newsroom-articles",
      title: "Call published newsroom articles with attribution metadata",
      owner: "partner_engineer",
      requiredScopes: ["newsroom:read"],
      endpoint: "GET /api/v1/partner/newsroom/articles",
      completionSignal: "Response includes only published articles, preview body text, source links, topic/audience filters, pagination metadata, and partner envelope headers.",
      blocker: "Do not syndicate editorial content unless attribution, preview-only body display, and partner content-use approval are preserved."
    },
    {
      key: "read-newsroom-newsletters",
      title: "Call public newsletter editions without recipient details",
      owner: "partner_engineer",
      requiredScopes: ["newsroom:read"],
      endpoint: "GET /api/v1/partner/newsroom/newsletters",
      completionSignal: "Response includes approved, scheduled, or sent newsletter metadata, linked article references, pagination metadata, and no recipient or delivery-attempt records.",
      blocker: "Do not syndicate newsletter editions unless attribution, unsubscribe expectations, and recipient privacy boundaries are preserved."
    },
    {
      key: "read-newsroom-performance",
      title: "Call aggregated newsroom performance without raw payloads",
      owner: "partner_ops",
      requiredScopes: ["newsroom:read"],
      endpoint: "GET /api/v1/partner/newsroom/performance",
      completionSignal: "Response includes aggregate totals, channel rollups, top article/newsletter rows, partner envelope metadata, and no raw metric payloads or recipient records.",
      blocker: "Do not use partner content performance evidence unless aggregation-only reporting and recipient privacy boundaries are preserved."
    },
    {
      key: "read-newsroom-readiness",
      title: "Call newsroom syndication readiness before mirroring content",
      owner: "partner_ops",
      requiredScopes: ["newsroom:read"],
      endpoint: "GET /api/v1/partner/newsroom/readiness",
      completionSignal: "Response includes aggregate source, article, derivative, and blocker summaries with no draft bodies, source item bodies, or admin review notes.",
      blocker: "Do not enable partner syndication when readiness status is blocked or action_required without partner content-use and editorial approval."
    },
    {
      key: "read-newsroom-sources",
      title: "Call approved newsroom source attribution metadata",
      owner: "partner_engineer",
      requiredScopes: ["newsroom:read"],
      endpoint: "GET /api/v1/partner/newsroom/sources",
      completionSignal: "Response includes only approved source records, attribution notes, pagination metadata, and excludes pending, blocked, legal-review, and raw source item bodies.",
      blocker: "Do not attribute or mirror newsroom content from sources that are pending, blocked, or awaiting legal review."
    },
    {
      key: "read-ad-placements",
      title: "Call ad placement inventory with disclosure metadata",
      owner: "partner_engineer",
      requiredScopes: ["ads:read"],
      endpoint: "GET /api/v1/partner/ads/placements",
      completionSignal: "Response includes active placements, surfaces, disclosure labels, pagination metadata, and optional delivery preview data when includeCreatives=true.",
      blocker: "Do not render paid placements unless the partner UI preserves disclosure labels and separates organic ranking from sponsored placement."
    },
    {
      key: "read-published-campaigns",
      title: "Call published campaign inventory with optional metrics",
      owner: "partner_engineer",
      requiredScopes: ["campaigns:read"],
      endpoint: "GET /api/v1/partner/campaigns",
      completionSignal: "Response includes published non-blocked campaigns, provider/type/status filters, pagination metadata, and optional metrics when includeMetrics=true.",
      blocker: "Do not mirror campaign content until partner campaign purpose, channel rules, consent boundaries, and attribution are approved."
    },
    {
      key: "submit-provider-claim",
      title: "Submit a provider claim or data correction request",
      owner: "partner_engineer",
      requiredScopes: ["claims:write"],
      endpoint: "POST /api/v1/partner/claims",
      completionSignal: "Response includes the created provider claim, verification checklist, next action, partner envelope metadata, and API audit evidence.",
      blocker: "Do not submit third-party correction claims without claimant authority, provider identity evidence, and partner data-use approval."
    },
    {
      key: "poll-provider-claim-status",
      title: "Poll claim status with claimant email verification",
      owner: "partner_engineer",
      requiredScopes: ["claims:write"],
      endpoint: "GET /api/v1/partner/claims/{id}?claimantEmail={email}",
      completionSignal: "Response includes the claim, checklist, next action, and partner envelope metadata only when the claimant email matches.",
      blocker: "Do not expose claim status in partner systems unless the claimant email match and partner data-use approval are both preserved."
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
    optionalScopes: ["webhooks:write", "reviews:read", "community:read", "newsroom:read", "campaigns:read", "ads:read", "claims:write"],
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

export function getPartnerApiChangelog() {
  const entries: PartnerApiChangelogEntry[] = [
    {
      version: "0.1.0",
      releasedAt: "2026-05-14",
      status: "current",
      summary:
        "Initial governed partner API foundation for sandbox provider/event reads, usage evidence, webhook verification, developer docs, and onboarding readiness.",
      additions: [
        "Scoped partner API key authentication with rate-limit headers and sandbox-mode response metadata.",
        "Provider and event read endpoints for approved partner integrations.",
        "Partner usage analytics with JSON and CSV evidence export.",
        "Webhook signing guide, signature verification endpoint, replay evidence export, and SDK examples.",
        "Sandbox onboarding checklist with production promotion blockers and evidence signals."
      ],
      breakingChanges: [],
      migrationNotes: [
        "Use x-senior-guru-api-key for all partner calls.",
        "Treat all 0.x endpoints as pre-1.0 and verify OpenAPI metadata before production promotion.",
        "Keep sandbox clients in sandboxMode=true until owner approval records partner purpose, scopes, rate limits, and webhook events."
      ],
      affectedEndpoints: [
        "GET /api/v1/partner/providers",
        "GET /api/v1/partner/providers/{id}",
        "GET /api/v1/partner/providers/{id}/visibility",
        "GET /api/v1/partner/events",
        "GET /api/v1/partner/events/{id}/analytics",
        "GET /api/v1/partner/reviews",
        "GET /api/v1/partner/community/posts",
        "GET /api/v1/partner/newsroom/articles",
        "GET /api/v1/partner/newsroom/newsletters",
        "GET /api/v1/partner/newsroom/performance",
        "GET /api/v1/partner/newsroom/readiness",
        "GET /api/v1/partner/newsroom/sources",
        "GET /api/v1/partner/ads/placements",
        "GET /api/v1/partner/campaigns",
        "POST /api/v1/partner/claims",
        "GET /api/v1/partner/claims/{id}",
        "GET /api/v1/partner/usage",
        "GET /api/v1/partner/onboarding-checklist",
        "GET /api/v1/partner/developer-docs",
        "GET /api/v1/partner/webhooks/signing-guide",
        "POST /api/v1/partner/webhooks/verify"
      ]
    },
    {
      version: "0.2.0",
      releasedAt: "planned",
      status: "planned",
      summary:
        "Planned partner evidence release for sandbox evidence export, versioned response envelopes, and SDK package publishing guidance.",
      additions: [
        "Sandbox evidence bundle export for provider, events, usage, webhook, and link-health checks.",
        "Explicit response envelope version metadata for partner routes.",
        "Package publishing plan for signed webhook verification helpers."
      ],
      breakingChanges: [],
      migrationNotes: [
        "No breaking changes are planned for 0.2.0.",
        "Partners should begin storing usage and webhook evidence ids so evidence bundles can reconcile prior sandbox runs."
      ],
      affectedEndpoints: [
        "GET /api/v1/partner/usage",
        "GET /api/v1/partner/developer-docs",
        "GET /api/v1/partner/changelog"
      ]
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    currentVersion: entries.find((entry) => entry.status === "current")?.version ?? "0.1.0",
    policy: {
      preOneDotZero:
        "Partner APIs are pre-1.0 and require OpenAPI, changelog, usage evidence, and owner approval review before production promotion.",
      deprecationNoticeDays: 90,
      breakingChangeRule:
        "Breaking partner API changes require a changelog entry, OpenAPI update, migration note, and owner-approved partner notification before rollout."
    },
    entries,
    nextActions: [
      "Review the current changelog before issuing or promoting partner keys.",
      "Use OpenAPI and the sandbox checklist to validate endpoint behavior for each partner environment.",
      "Capture partner evidence before adopting planned 0.2.0 response metadata or SDK packages."
    ]
  };
}

export function getWebhookSdkPackagePlan() {
  const packages: SdkPackage[] = [
    {
      language: "node",
      packageName: "@theseniorguru/webhooks",
      status: "planned",
      publicModule: "verifySeniorGuruWebhookSignature",
      responsibilities: [
        "Verify x-senior-guru-signature using HMAC-SHA256 and timing-safe digest comparison.",
        "Enforce timestamp tolerance before application JSON parsing.",
        "Return typed verification results with failure reasons for audit logging."
      ],
      releaseGate:
        "Publish only after npm organization ownership, package provenance, 2FA, README review, and signed release workflow are approved."
    },
    {
      language: "python",
      packageName: "theseniorguru-webhooks",
      status: "planned",
      publicModule: "verify_senior_guru_webhook_signature",
      responsibilities: [
        "Verify x-senior-guru-signature using hmac.compare_digest.",
        "Keep raw-body verification separate from framework JSON parsing.",
        "Expose deterministic sample tests matching the live signing-guide payload."
      ],
      releaseGate:
        "Publish only after PyPI ownership, trusted publishing, README review, and signed release workflow are approved."
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "Webhook SDK Package Publishing Plan",
    objective:
      "Package the webhook signature verification examples into maintained SDK helpers without weakening raw-body verification, secret custody, or partner audit evidence.",
    status: "planned",
    packages,
    requiredSecurityControls: [
      "No SDK stores API keys or webhook signing secrets.",
      "Every helper accepts raw body, signature header, signing secret, and optional tolerance seconds from the caller.",
      "Digest comparison must remain timing-safe in each language runtime.",
      "Package release requires owner-approved registry credentials and 2FA or trusted publishing.",
      "Release artifacts must include deterministic tests generated from /api/v1/partner/webhooks/signing-guide."
    ],
    releaseChecklist: [
      "Reserve package names in npm and PyPI under owner-controlled accounts.",
      "Create package READMEs from the live signing guide and changelog.",
      "Add CI tests that recompute the deterministic sample signature.",
      "Document framework-specific raw-body capture examples without handling secrets.",
      "Publish a signed prerelease before linking packages from developer docs."
    ],
    ownerBlockers: [
      "Confirm npm organization and PyPI project ownership.",
      "Approve package names, support email, repository URL, and release signer.",
      "Approve whether SDK package publishing happens before or after the 0.2.0 partner evidence release."
    ],
    nextActions: [
      "Keep inline SDK examples as the production-safe integration path until registry ownership is approved.",
      "Prepare package READMEs and deterministic tests from the live signing-guide sample.",
      "Add owner approvals before publishing package URLs in public developer docs."
    ]
  };
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function getPartnerSandboxEvidenceExport() {
  const catalog = getOpenApiCatalog();
  const checklist = getPartnerSandboxOnboardingChecklist();
  const changelog = getPartnerApiChangelog();
  const sdkPackagePlan = getWebhookSdkPackagePlan();
  const linkHealth = getLinkHealthSummary();
  const partnerPaths = Object.keys(catalog.paths).filter((path) => path.startsWith("/api/v1/partner/")).sort();

  const rows = [
    ...checklist.steps.map((step) => ({
      evidenceType: "onboarding_step",
      subject: step.key,
      status: "required",
      owner: step.owner,
      endpoint: step.endpoint,
      summary: step.completionSignal,
      blocker: step.blocker
    })),
    ...partnerPaths.map((path) => ({
      evidenceType: "partner_endpoint",
      subject: path,
      status: "documented",
      owner: "partner_engineer",
      endpoint: path,
      summary: "Partner endpoint is present in the live OpenAPI catalog.",
      blocker: ""
    })),
    ...changelog.entries.map((entry) => ({
      evidenceType: "api_version",
      subject: entry.version,
      status: entry.status,
      owner: "partner_ops",
      endpoint: "GET /api/v1/partner/changelog",
      summary: entry.summary,
      blocker: entry.breakingChanges.length ? entry.breakingChanges.join(" ") : ""
    })),
    ...sdkPackagePlan.ownerBlockers.map((blocker, index) => ({
      evidenceType: "sdk_owner_blocker",
      subject: `sdk-blocker-${index + 1}`,
      status: "blocked_pending_owner_approval",
      owner: "platform_admin",
      endpoint: "GET /api/v1/partner/sdk-package-plan",
      summary: blocker,
      blocker
    }))
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "Partner Sandbox Evidence Export",
    status: linkHealth.status === "passed" ? "ready_for_partner_review" : "blocked_link_health",
    currentVersion: changelog.currentVersion,
    linkHealth: {
      status: linkHealth.status,
      total: linkHealth.total,
      invalid: linkHealth.invalidCount
    },
    totals: {
      rows: rows.length,
      onboardingSteps: checklist.steps.length,
      partnerEndpoints: partnerPaths.length,
      apiVersions: changelog.entries.length,
      ownerBlockers: sdkPackagePlan.ownerBlockers.length
    },
    reviewGates: [
      "Confirm sandbox API client, key custody, and required scopes before partner testing.",
      "Export usage analytics separately from /api/v1/partner/usage?format=csv with the partner key.",
      "Attach webhook replay evidence when webhooks are part of the partner promotion request.",
      "Resolve owner blockers before SDK package links or production-mode partner clients are published."
    ],
    rows
  };
}

export function exportPartnerSandboxEvidenceCsv() {
  const evidence = getPartnerSandboxEvidenceExport();
  const columns = ["evidenceType", "subject", "status", "owner", "endpoint", "summary", "blocker"] as const;
  const csv = [
    columns.join(","),
    ...evidence.rows.map((row) => columns.map((column) => csvValue(row[column])).join(","))
  ].join("\n");

  return {
    filename: `partner-sandbox-evidence-${evidence.currentVersion}.csv`,
    csv
  };
}

export function getPartnerResponseEnvelopeContract() {
  return {
    generatedAt: new Date().toISOString(),
    title: "Partner Response Envelope Contract",
    currentVersion: partnerResponseEnvelopeVersion,
    envelope: partnerResponseEnvelopeMeta(),
    requiredHeaders: [
      "x-senior-guru-envelope-version",
      "x-senior-guru-api-client",
      "x-senior-guru-sandbox",
      "x-ratelimit-limit",
      "x-ratelimit-window"
    ],
    successShape: {
      data: "The endpoint-specific payload. Arrays remain arrays; objects remain typed resource objects.",
      meta: {
        apiClientId: "Authenticated partner API client id.",
        sandboxMode: "Boolean flag showing whether the client is sandbox-only.",
        responseEnvelope: partnerResponseEnvelopeMeta()
      }
    },
    errorShape: {
      error: "Safe partner-facing error message.",
      headers: ["x-senior-guru-api-status", "x-senior-guru-envelope-version"]
    },
    versioningRules: [
      "Partner clients should read x-senior-guru-envelope-version on every authenticated response.",
      "Additive fields may appear inside meta without a breaking version change.",
      "Moving data, meta, or error paths requires a changelog entry, OpenAPI update, migration note, and owner-approved partner notification.",
      "CSV exports keep stable column headers and use content-disposition filenames for evidence capture."
    ],
    nextActions: [
      "Update partner smoke tests to assert the envelope header and meta.responseEnvelope.version.",
      "Use the changelog before adopting any future envelope version.",
      "Attach envelope-version evidence to sandbox promotion exports."
    ]
  };
}

export function getPartnerResponsePaginationContract() {
  return {
    generatedAt: new Date().toISOString(),
    title: "Partner Response Pagination Contract",
    status: "active",
    queryParameters: {
      page: {
        type: "integer",
        default: 1,
        min: 1,
        max: 10000
      },
      pageSize: {
        type: "integer",
        default: 50,
        min: 1,
        max: 100
      }
    },
    paginatedEndpoints: [
      "GET /api/v1/partner/providers",
      "GET /api/v1/partner/events",
      "GET /api/v1/partner/reviews",
      "GET /api/v1/partner/community/posts",
      "GET /api/v1/partner/ads/placements",
      "GET /api/v1/partner/campaigns"
    ],
    metaShape: {
      pagination: {
        page: "Current normalized page.",
        pageSize: "Current normalized page size.",
        total: "Total matching records before pagination.",
        pageCount: "Total page count for the current page size.",
        hasNextPage: "Whether a next page exists.",
        hasPreviousPage: "Whether a previous page exists.",
        nextPage: "Next page number or null.",
        previousPage: "Previous page number or null.",
        offset: "Zero-based row offset used to slice the result set."
      }
    },
    versioningRules: [
      "Pagination metadata is additive inside meta and follows the current response-envelope version.",
      "Clients should keep using data as the page payload and meta.pagination for traversal.",
      "Server-side maximum pageSize is 100 to protect production response sizes.",
      "Out-of-range page requests are normalized to the last available page."
    ],
    nextActions: [
      "Update partner smoke tests to request pageSize=2 and assert meta.pagination.",
      "Use page and pageSize for provider/event inventory sync jobs instead of assuming full dumps.",
      "Add cursor pagination only after production inventory volume and partner sync frequency justify it."
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
      requiredScopes: ["providers:read", "events:read", "reviews:read", "community:read", "ads:read", "campaigns:read", "usage:read", "webhooks:write"]
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
    changelog: getPartnerApiChangelog(),
    sdkPackagePlan: getWebhookSdkPackagePlan(),
    sandboxEvidence: getPartnerSandboxEvidenceExport(),
    responseEnvelope: getPartnerResponseEnvelopeContract(),
    responsePagination: getPartnerResponsePaginationContract(),
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
