import { listAuditEvents, recordAuditEvent } from "@/lib/audit-events";
import type { OperationalAuditEvent } from "@/lib/domain/audit";
import { getSupabaseLaunchReadiness } from "@/lib/system/supabase-launch-readiness";
import { getSupabaseMigrationBundle } from "@/lib/system/supabase-migration-bundle";

export type SupabaseActivationReviewInput = {
  actorId?: string;
  environment?: string;
  reviewedBundleSha256?: string;
  reviewedMigrationFiles?: string[];
  envKeysConfirmed?: string[];
  ownerApproved?: boolean;
  notes?: string;
  secretsSubmitted?: boolean;
};

export type SupabaseActivationReview = {
  id: string;
  status: "blocked" | "review_recorded" | "ready_for_persistent_imports";
  actorId?: string;
  environment: string;
  reviewedBundleSha256?: string;
  reviewedMigrationFiles: string[];
  envKeysConfirmed: string[];
  ownerApproved: boolean;
  launchDecision: string;
  blockers: string[];
  nextActions: string[];
  auditEvent: OperationalAuditEvent;
};

const reviewEventType = "supabase_activation.review_recorded";
const requiredEnvKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

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
  return /(sk_|eyJ|-----BEGIN|service_role|secret=|password=|token=|supabase\.co\/auth\/v1\/callback)/i.test(value);
}

function mapReviewEvent(event: OperationalAuditEvent): SupabaseActivationReview {
  const payload = event.payload;
  const status = payload.status;

  return {
    id: event.id,
    status:
      status === "blocked" || status === "ready_for_persistent_imports" || status === "review_recorded"
        ? status
        : "review_recorded",
    actorId: event.actorId,
    environment: getStringPayload(payload, "environment") ?? "production",
    reviewedBundleSha256: getStringPayload(payload, "reviewedBundleSha256"),
    reviewedMigrationFiles: getStringArrayPayload(payload, "reviewedMigrationFiles"),
    envKeysConfirmed: getStringArrayPayload(payload, "envKeysConfirmed"),
    ownerApproved: getBooleanPayload(payload, "ownerApproved"),
    launchDecision: getStringPayload(payload, "launchDecision") ?? "unknown",
    blockers: getStringArrayPayload(payload, "blockers"),
    nextActions: getStringArrayPayload(payload, "nextActions"),
    auditEvent: event
  };
}

export async function getLatestSupabaseActivationReview() {
  const summary = await listAuditEvents({ eventType: reviewEventType, subjectType: "supabase_activation", limit: 1 });
  const latest = summary.events[0];

  return latest ? mapReviewEvent(latest) : undefined;
}

export async function recordSupabaseActivationReview(
  input: SupabaseActivationReviewInput
): Promise<SupabaseActivationReview> {
  const [readiness, latestReview] = await Promise.all([
    getSupabaseLaunchReadiness(),
    getLatestSupabaseActivationReview()
  ]);
  const bundle = getSupabaseMigrationBundle();
  const existingMigrationFiles = bundle.files.filter((file) => file.exists).map((file) => file.file);
  const reviewedMigrationFiles =
    input.reviewedMigrationFiles?.filter((file) => existingMigrationFiles.includes(file)) ?? [];
  const envKeysConfirmed = input.envKeysConfirmed?.filter((key) => requiredEnvKeys.includes(key)) ?? [];
  const missingEnvConfirmations = requiredEnvKeys.filter((key) => !envKeysConfirmed.includes(key));
  const missingReviewedFiles = existingMigrationFiles.filter((file) => !reviewedMigrationFiles.includes(file));
  const bundleMatches = input.reviewedBundleSha256 === bundle.bundleSha256;
  const notesContainSecrets = hasSecretLikeContent(input.notes);
  const blockers = [
    ...(input.secretsSubmitted
      ? ["Secret values must not be submitted to this API. Store Supabase secrets directly in Vercel or Supabase."]
      : []),
    ...(notesContainSecrets ? ["Activation notes appear to contain secret-like content and were blocked."] : []),
    ...(bundleMatches ? [] : [`Reviewed bundle checksum must match ${bundle.bundleSha256}.`]),
    ...(missingEnvConfirmations.length
      ? [`Missing env-key review confirmations: ${missingEnvConfirmations.join(", ")}.`]
      : []),
    ...(missingReviewedFiles.length ? [`Missing migration file review confirmations: ${missingReviewedFiles.length}.`] : []),
    ...(input.ownerApproved === true ? [] : ["Owner approval is required before enabling persistent imports."]),
    ...(readiness.launchDecision === "ready_for_persistent_imports"
      ? []
      : [`Supabase launch readiness is ${readiness.launchDecision}.`])
  ];
  const status: SupabaseActivationReview["status"] = blockers.length
    ? "blocked"
    : readiness.launchDecision === "ready_for_persistent_imports"
      ? "ready_for_persistent_imports"
      : "review_recorded";
  const nextActions = [
    ...(blockers.length ? ["Resolve activation blockers, then rerun this review without secret values."] : []),
    "Rerun /api/v1/admin/supabase-readiness and /api/v1/system/persistence after env or migration changes.",
    "Run one dry-run source import and one claim/write smoke before enabling persistent launch workers."
  ];
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: "admin",
    eventType: reviewEventType,
    subjectType: "supabase_activation",
    subjectId: "production-supabase",
    payload: {
      status,
      environment: input.environment ?? "production",
      expectedBundleSha256: bundle.bundleSha256,
      reviewedBundleSha256: input.reviewedBundleSha256,
      reviewedMigrationFiles,
      envKeysConfirmed,
      ownerApproved: input.ownerApproved === true,
      launchDecision: readiness.launchDecision,
      migrationCount: bundle.migrationCount,
      latestReviewId: latestReview?.id,
      notes: notesContainSecrets ? "[blocked-secret-like-content]" : input.notes,
      blockers,
      nextActions,
      generatedFromReadinessAt: readiness.generatedAt,
      generatedFromBundleAt: bundle.generatedAt
    }
  });

  return mapReviewEvent(auditEvent);
}
