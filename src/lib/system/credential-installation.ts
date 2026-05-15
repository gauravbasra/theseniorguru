import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getDeploymentStatus } from "@/lib/system/deployment";
import { getSystemReadiness } from "@/lib/system/readiness";

export type CredentialRunbookFormat = "json" | "csv";

export type CredentialFamily = "supabase" | "auth" | "email" | "ads" | "cron";

export type CredentialRunbookItem = {
  key: string;
  family: CredentialFamily;
  label: string;
  destination: "vercel_production_env" | "supabase_project" | "provider_console";
  requiredFor: string;
  installed: boolean;
  secretHandling: string;
  validation: string;
  blocker?: string;
};

export type CredentialInstallationReviewInput = {
  actorId?: string;
  environment?: string;
  reviewedKeys?: string[];
  installationNotes?: string;
  ownerApproved?: boolean;
  secretsSubmitted?: boolean;
};

export type CredentialInstallationReview = {
  id: string;
  status: "review_recorded" | "blocked" | "ready_for_owner_install";
  actorId?: string;
  environment: string;
  reviewedKeys: string[];
  ownerApproved: boolean;
  blockers: string[];
  nextActions: string[];
  auditEvent: OperationalAuditEvent;
};

export type CredentialInstallationRunbook = {
  generatedAt: string;
  status: "ready_for_owner_install" | "blocked" | "installed";
  environment: string;
  activeDeploymentUrl?: string;
  commitSha?: string;
  items: CredentialRunbookItem[];
  latestReview?: CredentialInstallationReview;
  blockers: string[];
  nextActions: string[];
  csv?: string;
};

const reviewEventType = "credential_installation.review_recorded";

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function getStringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getBooleanPayload(payload: Record<string, unknown>, key: string) {
  return payload[key] === true;
}

function getStringArrayPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function hasSecretLikeContent(value?: string) {
  if (!value) return false;
  return /(sk_|eyJ|-----BEGIN|service_role|secret=|password=|token=)/i.test(value);
}

function itemsToCsv(runbook: CredentialInstallationRunbook) {
  const headers = ["section", "key", "family", "installed", "destination", "requiredFor", "validation", "blocker"];
  const rows = runbook.items.map((item) =>
    [
      "credential",
      item.key,
      item.family,
      item.installed ? "true" : "false",
      item.destination,
      item.requiredFor,
      item.validation,
      item.blocker ?? ""
    ]
      .map(csvEscape)
      .join(",")
  );
  const blockerRows = runbook.blockers.map((blocker) => ["blocker", "", "", "", "", "", "", blocker].map(csvEscape).join(","));
  const actionRows = runbook.nextActions.map((action) => ["next_action", "", "", "", "", "", "", action].map(csvEscape).join(","));

  return [headers.join(","), ...rows, ...blockerRows, ...actionRows].join("\n");
}

function mapReviewEvent(event: OperationalAuditEvent): CredentialInstallationReview {
  const payload = event.payload;
  const status = payload.status;

  return {
    id: event.id,
    status:
      status === "blocked" || status === "ready_for_owner_install" || status === "review_recorded"
        ? status
        : "review_recorded",
    actorId: event.actorId,
    environment: getStringPayload(payload, "environment") ?? "production",
    reviewedKeys: getStringArrayPayload(payload, "reviewedKeys"),
    ownerApproved: getBooleanPayload(payload, "ownerApproved"),
    blockers: getStringArrayPayload(payload, "blockers"),
    nextActions: getStringArrayPayload(payload, "nextActions"),
    auditEvent: event
  };
}

export async function getLatestCredentialInstallationReview() {
  const summary = await listAuditEvents({ eventType: reviewEventType, subjectType: "production_credentials", limit: 1 });
  const latest = summary.events[0];

  return latest ? mapReviewEvent(latest) : undefined;
}

function buildRunbookItems() {
  const readiness = getSystemReadiness();
  const groups = readiness.groups;

  const fromCheck = (
    family: CredentialFamily,
    key: string,
    destination: CredentialRunbookItem["destination"],
    requiredFor: string,
    validation: string
  ): CredentialRunbookItem => {
    const allChecks = [
      ...groups.supabase.checks,
      ...groups.email.checks,
      ...groups.ads.checks,
      ...groups.auth.checks,
      ...groups.hosting.checks
    ];
    const check = allChecks.find((item) => item.key === key);
    const installed = check?.status === "ready";

    return {
      key,
      family,
      label: check?.label ?? key,
      destination,
      requiredFor,
      installed,
      secretHandling: "Store in the provider console or Vercel Production environment only; never submit secret values to this API.",
      validation,
      blocker: installed ? undefined : check?.action ?? `${key} is not installed.`
    };
  };

  return [
    fromCheck("supabase", "NEXT_PUBLIC_SUPABASE_URL", "vercel_production_env", "Persistent reads/writes and public Supabase client wiring.", "GET /api/v1/system/persistence reports configured.supabaseUrl=true."),
    fromCheck("supabase", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "vercel_production_env", "Browser-safe Supabase client configuration.", "GET /api/v1/system/persistence reports configured.supabaseAnonKey=true."),
    fromCheck("supabase", "SUPABASE_SERVICE_ROLE_KEY", "vercel_production_env", "Server-only import, admin, audit, claim, and partner persistence.", "GET /api/v1/system/persistence reports configured.supabaseServiceRoleKey=true."),
    fromCheck("auth", "ADMIN_ACCESS_CODE", "vercel_production_env", "Owner command-center login.", "POST /api/v1/auth/login returns an admin session cookie."),
    fromCheck("auth", "ADMIN_SESSION_SECRET", "vercel_production_env", "Durable signed owner sessions.", "GET /api/v1/auth/session remains stable across requests."),
    fromCheck("auth", "WEBHOOK_SIGNING_ENCRYPTION_KEY", "vercel_production_env", "Encrypted partner webhook signing secrets.", "Partner webhook subscription smoke can create encrypted signing metadata."),
    fromCheck("cron", "CRON_SECRET", "vercel_production_env", "Protected Vercel Cron routes.", "Cron routes reject missing/invalid Authorization and accept the configured secret."),
    fromCheck("email", "MAILJET_API_KEY", "vercel_production_env", "Provider outreach and verification delivery readiness.", "Verification delivery readiness reports email channel configured."),
    fromCheck("email", "MAILJET_API_SECRET", "vercel_production_env", "Provider outreach and verification delivery readiness.", "Verification delivery readiness reports email channel configured."),
    fromCheck("email", "NEWSLETTER_MAILJET_SENDER_EMAIL", "provider_console", "Live newsletter delivery sender identity.", "Newsletter delivery preview reports sender configured."),
    fromCheck("email", "NEWSLETTER_MAILJET_SEND_MODE", "vercel_production_env", "Controlled live newsletter sends after approval.", "Newsletter send mode is live only after owner approval."),
    fromCheck("ads", "GOOGLE_ADS_CLIENT_ID", "provider_console", "Google ads or ad-manager backfill.", "GET /api/v1/admin/ad-readiness shows backfill credential readiness."),
    fromCheck("ads", "GOOGLE_ADS_CLIENT_SECRET", "provider_console", "Google ads or ad-manager backfill.", "GET /api/v1/admin/ad-readiness shows backfill credential readiness."),
    fromCheck("ads", "GOOGLE_ADS_DEVELOPER_TOKEN", "provider_console", "Google ads or ad-manager backfill.", "GET /api/v1/admin/ad-readiness shows backfill credential readiness.")
  ];
}

export async function getCredentialInstallationRunbook(format: CredentialRunbookFormat = "json"): Promise<CredentialInstallationRunbook> {
  const [deployment, latestReview] = await Promise.all([Promise.resolve(getDeploymentStatus()), getLatestCredentialInstallationReview()]);
  const items = buildRunbookItems();
  const blockers = items.filter((item) => !item.installed).map((item) => item.blocker ?? `${item.key} is not installed.`);
  const runbook: CredentialInstallationRunbook = {
    generatedAt: new Date().toISOString(),
    status: blockers.length ? "blocked" : latestReview?.ownerApproved ? "installed" : "ready_for_owner_install",
    environment: deployment.environment,
    activeDeploymentUrl: deployment.activeDeploymentUrl,
    commitSha: deployment.commitSha,
    items,
    latestReview,
    blockers,
    nextActions: [
      ...(blockers.length ? ["Install missing credentials in Vercel Production or the provider console; do not paste secrets into app APIs."] : []),
      "After each credential installation, redeploy or redeploy-free refresh as required by Vercel and rerun production smoke checks.",
      "Archive a credential installation review with reviewedKeys and owner notes before enabling live workers."
    ]
  };

  return format === "csv" ? { ...runbook, csv: itemsToCsv(runbook) } : runbook;
}

export async function recordCredentialInstallationReview(input: CredentialInstallationReviewInput): Promise<CredentialInstallationReview> {
  const runbook = await getCredentialInstallationRunbook();
  const reviewedKeys = input.reviewedKeys?.filter((key) => runbook.items.some((item) => item.key === key)) ?? [];
  const notesContainSecrets = hasSecretLikeContent(input.installationNotes);
  const blockers = [
    ...(input.secretsSubmitted ? ["Secret values must not be submitted to this API. Store them directly in Vercel or the provider console."] : []),
    ...(notesContainSecrets ? ["Installation notes appear to contain secret-like content and were blocked."] : []),
    ...(reviewedKeys.length ? [] : ["At least one reviewed credential key is required."]),
    ...runbook.blockers
  ];
  const status: CredentialInstallationReview["status"] = blockers.length
    ? "blocked"
    : input.ownerApproved
      ? "ready_for_owner_install"
      : "review_recorded";
  const nextActions = [
    ...(blockers.length ? ["Resolve credential blockers, then rerun the installation review without secret values."] : []),
    "Rerun /api/v1/system/credential-installation after Vercel/provider credential changes.",
    "Rerun production smoke checks for persistence, auth, cron, email, ads, and partner webhooks."
  ];

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: reviewEventType,
    subjectType: "production_credentials",
    subjectId: "live-credential-installation",
    payload: {
      status,
      environment: input.environment ?? runbook.environment,
      reviewedKeys,
      ownerApproved: input.ownerApproved === true,
      installationNotes: notesContainSecrets ? "[blocked-secret-like-content]" : input.installationNotes,
      blockers,
      nextActions,
      activeDeploymentUrl: runbook.activeDeploymentUrl,
      commitSha: runbook.commitSha,
      generatedFromRunbookAt: runbook.generatedAt
    }
  });

  return mapReviewEvent(auditEvent);
}
