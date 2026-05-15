"use client";

import { useState } from "react";
import {
  CheckCheck,
  FileCheck2,
  GitMerge,
  Inbox,
  ListChecks,
  Loader2,
  MessageSquareWarning,
  PlayCircle,
  Radar,
  Send,
  SquareStack,
  ShieldAlert
} from "lucide-react";

type OperationResult = {
  label: string;
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
  summary: string;
};

const launchRecords = [
  {
    name: "Boulder Adult Day Support",
    city: "Boulder",
    state: "CO",
    websiteUrl: "https://example.com/boulder-adult-day",
    categories: ["Adult Day Care"],
    confidenceScore: 0.78
  },
  {
    name: "Missing Location Listing",
    websiteUrl: "https://example.com/missing-location"
  }
];

export function AdminOperationsConsole() {
  const [results, setResults] = useState<OperationResult[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  async function runOperation(label: string, key: string, request: () => Promise<Response>) {
    setLoadingKey(key);
    const response = await request();
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);
    setResults((current) => [
      {
        label,
        ok: response.ok,
        status: response.status,
        data: payload.data,
        error: payload.error,
        summary: summarizeOperation(key, payload.data)
      },
      ...current.slice(0, 7)
    ]);
  }

  return (
    <section className="ops-console">
      <div className="ops-grid">
        <OpsButton
          icon={<Radar aria-hidden="true" />}
          label="Run import dry run"
          loading={loadingKey === "import"}
          onClick={() =>
            runOperation("Import dry run", "import", () =>
              fetch("/api/v1/admin/import-batches/pending-admin-import/run", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, records: launchRecords })
              })
            )
          }
        />
        <OpsButton
          icon={<SquareStack aria-hidden="true" />}
          label="Preview real listings"
          loading={loadingKey === "current-preview"}
          onClick={() =>
            runOperation("Preview real listings", "current-preview", () =>
              fetch("/api/v1/admin/public-source-acquisition/current-site-preview", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ maxRecords: 25 })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Stage real listings"
          loading={loadingKey === "current-run"}
          onClick={() =>
            runOperation("Stage real listings", "current-run", () =>
              fetch("/api/v1/admin/public-source-acquisition/current-site-run", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ maxRecords: 25, dryRun: false })
              })
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Score duplicate match"
          loading={loadingKey === "match"}
          onClick={() =>
            runOperation("Score duplicate match", "match", () =>
              fetch("/api/v1/admin/extracted-entities/seed-extracted-denver-care/match", { method: "POST" })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Review queue"
          loading={loadingKey === "entity-review-queue"}
          onClick={() =>
            runOperation("Extracted entity review queue", "entity-review-queue", () =>
              fetch("/api/v1/admin/extracted-entities/review-queue?status=all&limit=25")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Merge readiness"
          loading={loadingKey === "merge-readiness"}
          onClick={() =>
            runOperation("Extracted entity merge readiness", "merge-readiness", () =>
              fetch("/api/v1/admin/extracted-entities/seed-extracted-denver-care/merge-readiness", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ actorId: "admin-console", recordAudit: true })
              })
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Assign review"
          loading={loadingKey === "entity-review-assignment"}
          onClick={() =>
            runOperation("Assign extracted entity review", "entity-review-assignment", () =>
              fetch("/api/v1/admin/extracted-entities/seed-extracted-denver-care/assignment", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  assignedTo: "launch-ops",
                  assignedBy: "admin-console",
                  notes: "Admin console review ownership smoke assignment"
                })
              })
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Escalations"
          loading={loadingKey === "entity-escalations"}
          onClick={() =>
            runOperation("Extracted entity escalations", "entity-escalations", () =>
              fetch("/api/v1/admin/extracted-entities/escalations?limit=25")
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Escalation delivery"
          loading={loadingKey === "entity-escalation-delivery"}
          onClick={() =>
            runOperation("Import escalation delivery readiness", "entity-escalation-delivery", () =>
              fetch("/api/v1/admin/extracted-entities/escalations/delivery-readiness")
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Notify escalations"
          loading={loadingKey === "entity-escalation-notify"}
          onClick={() =>
            runOperation("Notify import escalations", "entity-escalation-notify", () =>
              fetch("/api/v1/admin/extracted-entities/escalations/notify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, actorId: "admin-console", deliveryProvider: "manual_export" })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Approve entity"
          loading={loadingKey === "approve"}
          onClick={() =>
            runOperation("Approve extracted entity", "approve", () =>
              fetch("/api/v1/admin/extracted-entities/seed-extracted-denver-care/approve", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ adminNotes: "Admin console smoke approval" })
              })
            )
          }
        />
        <OpsButton
          icon={<CheckCheck aria-hidden="true" />}
          label="Create verification"
          loading={loadingKey === "verify"}
          onClick={() =>
            runOperation("Create claim verification", "verify", () =>
              fetch("/api/v1/admin/provider-claims/pending-claim-admin/verification-attempts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  method: "business_email",
                  target: "operator@example.com",
                  attemptPayload: { source: "admin_console" }
                })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Verification queue"
          loading={loadingKey === "verification-queue"}
          onClick={() =>
            runOperation("Provider verification queue", "verification-queue", () =>
              fetch("/api/v1/admin/provider-verification-queue")
            )
          }
        />
        <OpsButton
          icon={<Radar aria-hidden="true" />}
          label="Verification SLA"
          loading={loadingKey === "verification-sla"}
          onClick={() =>
            runOperation("Provider verification SLA", "verification-sla", () =>
              fetch("/api/v1/admin/provider-verification-sla")
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="SLA alert"
          loading={loadingKey === "verification-sla-alert"}
          onClick={() =>
            runOperation("Provider verification SLA alert", "verification-sla-alert", () =>
              fetch("/api/v1/admin/provider-verification-sla/notify", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, deliveryProvider: "manual_export" })
              })
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Delivery readiness"
          loading={loadingKey === "verification-delivery-readiness"}
          onClick={() =>
            runOperation("Provider verification delivery readiness", "verification-delivery-readiness", () =>
              fetch("/api/v1/admin/provider-verification-delivery-readiness")
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Queue outreach"
          loading={loadingKey === "outreach"}
          onClick={() =>
            runOperation("Queue provider outreach", "outreach", () =>
              fetch("/api/v1/admin/provider-outreach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  providerId: "seed-cottages-dayton-place",
                  recipient: "operator@example.com"
                })
              })
            )
          }
        />
        <OpsButton
          icon={<Inbox aria-hidden="true" />}
          label="Load lead queue"
          loading={loadingKey === "leads"}
          onClick={() => runOperation("Lead intake queue", "leads", () => fetch("/api/v1/admin/leads"))}
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Provider onboarding"
          loading={loadingKey === "provider-onboarding"}
          onClick={() =>
            runOperation("Provider onboarding readiness", "provider-onboarding", () =>
              fetch("/api/v1/admin/provider-onboarding-readiness?providerId=seed-cottages-dayton-place")
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Profile edits"
          loading={loadingKey === "profile-edits"}
          onClick={() =>
            runOperation("Provider profile edit queue", "profile-edits", () =>
              fetch("/api/v1/admin/provider-profile-updates")
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Aggregation readiness"
          loading={loadingKey === "aggregation-readiness"}
          onClick={() =>
            runOperation("Aggregation readiness", "aggregation-readiness", () =>
              fetch("/api/v1/admin/aggregation-readiness")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Import adapters"
          loading={loadingKey === "import-adapters"}
          onClick={() =>
            runOperation("Import adapter readiness", "import-adapters", () =>
              fetch("/api/v1/admin/import-adapters")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Source runners"
          loading={loadingKey === "source-adapter-imports"}
          onClick={() =>
            runOperation("Source adapter import readiness", "source-adapter-imports", () =>
              fetch("/api/v1/admin/source-adapter-imports")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Source worker"
          loading={loadingKey === "source-adapter-worker"}
          onClick={() =>
            runOperation("Source adapter scheduled worker", "source-adapter-worker", () =>
              fetch("/api/v1/admin/source-adapter-imports/worker", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, payloads: [] })
              })
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Source manifests"
          loading={loadingKey === "source-adapter-manifests"}
          onClick={() =>
            runOperation("Source adapter file manifests", "source-adapter-manifests", () =>
              fetch("/api/v1/admin/source-adapter-manifests")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Storage readiness"
          loading={loadingKey === "source-adapter-storage-readiness"}
          onClick={() =>
            runOperation("Source manifest storage readiness", "source-adapter-storage-readiness", () =>
              fetch("/api/v1/admin/source-adapter-manifests/storage-readiness")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Fetch manifest"
          loading={loadingKey === "source-adapter-manifest-fetch"}
          onClick={() =>
            runOperation("Source manifest signed object fetch", "source-adapter-manifest-fetch", async () => {
              const readinessResponse = await fetch("/api/v1/admin/source-adapter-manifests/storage-readiness");
              const readinessPayload = await readinessResponse.json().catch(() => ({}));
              const fetchReadyManifest = readinessPayload?.data?.manifests?.find(
                (manifest: { status?: string; manifestId?: string }) => manifest.status === "fetch_ready" && manifest.manifestId
              );

              if (!fetchReadyManifest) {
                return new Response(
                  JSON.stringify({ error: "No fetch-ready HTTPS source manifest is available. Register and approve one first." }),
                  { status: 409, headers: { "content-type": "application/json" } }
                );
              }

              return fetch("/api/v1/admin/source-adapter-manifests/fetch", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, manifestId: fetchReadyManifest.manifestId })
              });
            })
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Fetch worker"
          loading={loadingKey === "source-adapter-manifest-fetch-worker"}
          onClick={() =>
            runOperation("Source manifest signed object fetch worker", "source-adapter-manifest-fetch-worker", () =>
              fetch("/api/v1/admin/source-adapter-manifests/fetch/worker", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, maxManifests: 10 })
              })
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Vendor feeds"
          loading={loadingKey === "vendor-feeds"}
          onClick={() =>
            runOperation("Vendor feed readiness", "vendor-feeds", () =>
              fetch("/api/v1/admin/vendor-feed-connections")
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Vendor worker"
          loading={loadingKey === "vendor-worker"}
          onClick={() =>
            runOperation("Vendor feed scheduled worker", "vendor-worker", () =>
              fetch("/api/v1/admin/vendor-feed-imports/worker", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, feeds: [] })
              })
            )
          }
        />
        <OpsButton
          icon={<GitMerge aria-hidden="true" />}
          label="Website parser"
          loading={loadingKey === "provider-website-parser"}
          onClick={() =>
            runOperation("Provider website parser readiness", "provider-website-parser", () =>
              fetch("/api/v1/admin/provider-website-parser")
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Parser rules"
          loading={loadingKey === "provider-website-parser-rules"}
          onClick={() =>
            runOperation("Provider website parser rules", "provider-website-parser-rules", () =>
              fetch("/api/v1/admin/provider-website-parser/rules")
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Rule audit"
          loading={loadingKey === "provider-website-parser-rule-audit"}
          onClick={() =>
            runOperation("Provider website parser rule audit", "provider-website-parser-rule-audit", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/audit")
            )
          }
        />
        <OpsButton
          icon={<Radar aria-hidden="true" />}
          label="Rule impact"
          loading={loadingKey === "provider-website-parser-rule-impact"}
          onClick={() =>
            runOperation("Provider website parser rule impact", "provider-website-parser-rule-impact", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/impact", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Impact export"
          loading={loadingKey === "provider-website-parser-rule-impact-export"}
          onClick={() =>
            runOperation("Provider website parser rule impact export", "provider-website-parser-rule-impact-export", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/impact/export")
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Attach impact"
          loading={loadingKey === "provider-website-parser-rule-impact-attach"}
          onClick={() =>
            runOperation("Provider website parser rule impact attachment", "provider-website-parser-rule-impact-attach", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/impact/attach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true })
              })
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Rollback rules"
          loading={loadingKey === "provider-website-parser-rule-rollback"}
          onClick={() =>
            runOperation("Provider website parser rule rollback", "provider-website-parser-rule-rollback", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/rollback", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true })
              })
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Replace rules"
          loading={loadingKey === "provider-website-parser-rule-replace"}
          onClick={() =>
            runOperation("Provider website parser rule replacement", "provider-website-parser-rule-replace", () =>
              fetch("/api/v1/admin/provider-website-parser/rules/replace", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true })
              })
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Retry escalations"
          loading={loadingKey === "escalation-retry-scheduler"}
          onClick={() =>
            runOperation("Import escalation retry scheduler", "escalation-retry-scheduler", () =>
              fetch("/api/v1/admin/extracted-entities/escalations/retry-scheduler", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, limit: 25 })
              })
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Deliver retries"
          loading={loadingKey === "escalation-retry-delivery"}
          onClick={() =>
            runOperation("Import escalation retry delivery", "escalation-retry-delivery", () =>
              fetch("/api/v1/admin/extracted-entities/escalations/retry-delivery", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, limit: 25 })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Audit export"
          loading={loadingKey === "audit-export"}
          onClick={() =>
            runOperation("Audit event export", "audit-export", () =>
              fetch("/api/v1/admin/audit-events/export?format=json&limit=25")
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Audit retention"
          loading={loadingKey === "audit-retention"}
          onClick={() =>
            runOperation("Audit retention controls", "audit-retention", () =>
              fetch("/api/v1/admin/audit-events/retention", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, limit: 25 })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Policy reviewers"
          loading={loadingKey === "policy-review-assignments"}
          onClick={() =>
            runOperation("Policy review assignments", "policy-review-assignments", () =>
              fetch("/api/v1/admin/policy-review-assignments", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, limit: 25 })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Worker health"
          loading={loadingKey === "worker-health"}
          onClick={() =>
            runOperation("Scheduled worker health", "worker-health", () =>
              fetch("/api/v1/admin/scheduled-worker-health")
            )
          }
        />
        <OpsButton
          icon={<CheckCheck aria-hidden="true" />}
          label="Cutover readiness"
          loading={loadingKey === "production-cutover"}
          onClick={() =>
            runOperation("Production cutover readiness", "production-cutover", () =>
              fetch("/api/v1/system/production-cutover")
            )
          }
        />
        <OpsButton
          icon={<CheckCheck aria-hidden="true" />}
          label="DNS approval"
          loading={loadingKey === "dns-cutover-approval"}
          onClick={() =>
            runOperation("DNS cutover approval", "dns-cutover-approval", () =>
              fetch("/api/v1/system/dns-cutover-approval", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  ownerApproved: false,
                  targetDomain: "https://theseniorguru.com",
                  rollbackAcknowledged: false,
                  approvalNotes: "Admin console DNS cutover readiness review; owner approval still required before DNS change."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="DNS smoke"
          loading={loadingKey === "dns-cutover-smoke-checklist"}
          onClick={() =>
            runOperation("DNS cutover smoke checklist", "dns-cutover-smoke-checklist", () =>
              fetch("/api/v1/system/dns-cutover-smoke-checklist", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  dryRun: true,
                  notes: "Admin console DNS cutover smoke checklist archive."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Credential runbook"
          loading={loadingKey === "credential-installation"}
          onClick={() =>
            runOperation("Credential installation runbook", "credential-installation", () =>
              fetch("/api/v1/system/credential-installation", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  reviewedKeys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
                  ownerApproved: false,
                  installationNotes: "Admin console credential installation readiness review; no secret values submitted."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Credential smoke"
          loading={loadingKey === "credential-smoke-evidence"}
          onClick={() =>
            runOperation("Credential smoke evidence", "credential-smoke-evidence", () =>
              fetch("/api/v1/system/credential-smoke-evidence", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  dryRun: true,
                  notes: "Admin console credential smoke evidence archive."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Credential retention"
          loading={loadingKey === "credential-evidence-retention"}
          onClick={() =>
            runOperation("Credential evidence retention", "credential-evidence-retention", () =>
              fetch("/api/v1/system/credential-evidence-retention", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  dryRun: true,
                  retentionDays: 2555,
                  limit: 50,
                  notes: "Admin console credential evidence retention review."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<Radar aria-hidden="true" />}
          label="Cutover monitor"
          loading={loadingKey === "post-cutover-monitor"}
          onClick={() =>
            runOperation("Post-cutover monitor", "post-cutover-monitor", () =>
              fetch("/api/v1/system/post-cutover-monitor", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  dryRun: true,
                  notes: "Admin console post-cutover synthetic monitor preview."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<Send aria-hidden="true" />}
          label="Monitor alert"
          loading={loadingKey === "post-cutover-monitor-alerts"}
          onClick={() =>
            runOperation("Post-cutover monitor alert", "post-cutover-monitor-alerts", () =>
              fetch("/api/v1/system/post-cutover-monitor-alerts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "admin-console",
                  dryRun: true,
                  deliveryProvider: "manual_export",
                  notes: "Admin console post-cutover monitor alert preview."
                })
              })
            )
          }
        />
        <OpsButton
          icon={<FileCheck2 aria-hidden="true" />}
          label="Rollback evidence"
          loading={loadingKey === "rollback-evidence"}
          onClick={() =>
            runOperation("Production rollback evidence", "rollback-evidence", () =>
              fetch("/api/v1/system/rollback-evidence")
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Worker alerts"
          loading={loadingKey === "worker-alerts"}
          onClick={() =>
            runOperation("Scheduled worker alerts", "worker-alerts", () =>
              fetch("/api/v1/admin/scheduled-worker-alerts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, deliveryProvider: "manual_export", actorId: "admin-console" })
              })
            )
          }
        />
        <OpsButton
          icon={<ListChecks aria-hidden="true" />}
          label="Import launch plan"
          loading={loadingKey === "import-plan"}
          onClick={() =>
            runOperation("Import launch plan", "import-plan", () =>
              fetch("/api/v1/admin/import-launch-plan?targetListings=5000&batchSize=500")
            )
          }
        />
        <OpsButton
          icon={<PlayCircle aria-hidden="true" />}
          label="Execute launch batch"
          loading={loadingKey === "launch-execution"}
          onClick={() =>
            runOperation("Launch import execution", "launch-execution", () =>
              fetch("/api/v1/admin/import-launch-execution", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ dryRun: true, maxRecords: 25, starterBatchSize: 125 })
              })
            )
          }
        />
        <OpsButton
          icon={<SquareStack aria-hidden="true" />}
          label="Ad readiness"
          loading={loadingKey === "ad-readiness"}
          onClick={() => runOperation("Ad readiness", "ad-readiness", () => fetch("/api/v1/admin/ad-readiness"))}
        />
        <OpsButton
          icon={<MessageSquareWarning aria-hidden="true" />}
          label="Create report"
          loading={loadingKey === "report"}
          onClick={() =>
            runOperation("Create community report", "report", () =>
              fetch("/api/v1/community/reports", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  subjectType: "community_post",
                  subjectId: "seed-caregiver-question",
                  reason: "needs_review",
                  details: "Admin console report test"
                })
              })
            )
          }
        />
        <OpsButton
          icon={<ShieldAlert aria-hidden="true" />}
          label="Moderate post"
          loading={loadingKey === "moderate"}
          onClick={() =>
            runOperation("Moderate community post", "moderate", () =>
              fetch("/api/v1/admin/community/posts/seed-caregiver-question/moderate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status: "hidden", reason: "Admin console moderation" })
              })
            )
          }
        />
      </div>

      <div className="ops-results" aria-live="polite">
        {results.length ? (
          results.map((result, index) => (
            <article className={result.ok ? "ops-result ok" : "ops-result error"} key={`${result.label}-${index}`}>
              <div>
                <strong>{result.label}</strong>
                <span>{result.ok ? `HTTP ${result.status}` : result.error ?? `HTTP ${result.status}`}</span>
              </div>
              <p>{result.ok ? result.summary : result.error ?? "Action needs attention before it can finish."}</p>
            </article>
          ))
        ) : (
          <article className="ops-result">
            <div>
              <strong>No operations run yet</strong>
              <span>Choose an action to review launch operations.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function summarizeOperation(key: string, data: unknown) {
  const record = isRecord(data) ? data : {};

  if (key === "import") {
    return `${String(record.stagedRecords ?? 0)} listings staged, ${String(record.skippedRecords ?? 0)} skipped, ${String(record.rejectedRecords ?? 0)} rejected, and ${String(record.totalRecords ?? 0)} reviewed.`;
  }

  if (key === "current-preview") {
    return `${String(record.parsedRecords ?? 0)} production listings parsed from ${String(record.discoveredListings ?? 0)} discovered current-site records.`;
  }

  if (key === "current-run") {
    return `${String(record.stagedRecords ?? 0)} real listings staged, ${String(record.skippedRecords ?? 0)} skipped as existing, ${String(record.rejectedRecords ?? 0)} rejected, and ${String(record.errorRecords ?? 0)} errors recorded.`;
  }

  if (key === "match") {
    return `${String(record.candidateCount ?? 0)} possible duplicate matches scored before publishing.`;
  }

  if (key === "approve") {
    return `Listing approval completed and inventory can move forward.`;
  }

  if (key === "verify") {
    return `Claim verification step created for operator review.`;
  }

  if (key === "verification-queue") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.claims ?? 0)} claims reviewed, ${String(totals?.readyForAdminReview ?? 0)} ready for admin review, ${String(totals?.pendingDelivery ?? 0)} waiting on delivery, and ${String(totals?.failedOrExpired ?? 0)} failed or expired.`;
  }

  if (key === "verification-sla") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.overdue ?? 0)} overdue, ${String(totals?.dueSoon ?? 0)} due soon, ${String(totals?.pendingDelivery ?? 0)} awaiting delivery, and ${String(totals?.readyForAdminReview ?? 0)} ready for review.`;
  }

  if (key === "verification-sla-alert") {
    const preview = record.payloadPreview as Record<string, unknown> | undefined;
    return `${String(preview?.alertCount ?? 0)} SLA alert items prepared for ${String(record.deliveryProvider ?? "manual_export")} with status ${String(record.status ?? "ready")}.`;
  }

  if (key === "verification-delivery-readiness") {
    const channels = Array.isArray(record.channels) ? record.channels : [];
    return `${channels.length} verification delivery channels checked with status ${String(record.status ?? "manual_only")}.`;
  }

  if (key === "worker-alerts") {
    const preview = record.payloadPreview as Record<string, unknown> | undefined;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `${String(preview?.alertCount ?? 0)} scheduled-worker alert item${preview?.alertCount === 1 ? "" : "s"} prepared for ${String(record.deliveryProvider ?? "manual_export")}, ${String(blockers)} blocker${blockers === 1 ? "" : "s"}, status ${String(record.status ?? "ready")}.`;
  }

  if (key === "outreach") {
    return `Provider claim outreach was queued with policy checks.`;
  }

  if (key === "leads") {
    const leads = Array.isArray(data) ? data.length : Array.isArray(record.items) ? record.items.length : 0;
    return `${leads} lead intake items are available for owner follow-up.`;
  }

  if (key === "provider-onboarding") {
    return `Provider onboarding readiness was refreshed for claim, reputation, and growth setup.`;
  }

  if (key === "profile-edits") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.pendingReview ?? 0)} provider profile edits are pending review, ${String(totals?.applied ?? 0)} applied, and ${String(totals?.rejected ?? 0)} rejected.`;
  }

  if (key === "aggregation-readiness") {
    return `Inventory launch readiness was refreshed across sources, imports, crawling, and data quality.`;
  }

  if (key === "import-adapters") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.ready ?? 0)} ready, ${String(totals?.manualReady ?? 0)} manual-ready, and ${String(totals?.blocked ?? 0)} blocked import adapters.`;
  }

  if (key === "source-adapter-imports") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.runnable ?? 0)} runnable CMS/state/manual source adapters, ${String(totals?.blocked ?? 0)} blocked, and ${String(totals?.unsupported ?? 0)} routed to source-specific runners.`;
  }

  if (key === "source-adapter-worker") {
    return `${String(record.executedAdapters ?? 0)} source adapters executed, ${String(record.skippedAdapters ?? 0)} skipped for missing payloads, and ${String(record.blockedAdapters ?? 0)} blocked by readiness gates.`;
  }

  if (key === "source-adapter-manifests") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.ready ?? 0)} source manifests ready, ${String(totals?.blocked ?? 0)} blocked, and ${String(totals?.verifiedStorage ?? 0)} verified storage checks.`;
  }

  if (key === "source-adapter-storage-readiness") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.fetchReady ?? 0)} source manifests fetch-ready, ${String(totals?.manualReady ?? 0)} manual-ready, ${String(totals?.blocked ?? 0)} blocked, and ${String(totals?.ownerCredentialRequired ?? 0)} require owner credentials.`;
  }

  if (key === "source-adapter-manifest-fetch") {
    return `${String(record.recordsFetched ?? 0)} records fetched from the signed manifest object, checksum ${String(record.checksumSha256 ?? "pending").slice(0, 12)}, dry-run ${String(record.dryRun ?? true)}.`;
  }

  if (key === "source-adapter-manifest-fetch-worker") {
    return `${String(record.executedManifests ?? 0)} fetch-ready manifests executed, ${String(record.skippedManifests ?? 0)} skipped, and ${String(record.blockedManifests ?? 0)} blocked by signed-object fetch gates.`;
  }

  if (key === "provider-website-parser") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.ready ?? 0)} ready provider website parser sources, ${String(totals?.blocked ?? 0)} blocked, and ${String(totals?.stagedPages ?? 0)} staged crawl pages.`;
  }

  if (key === "provider-website-parser-rules") {
    const totals = record.totals as Record<string, unknown> | undefined;
    const overrides = Array.isArray(record.overrides) ? record.overrides.length : 0;
    return `${String(totals?.stageableCandidates ?? 0)} provider website candidates stageable, ${String(totals?.candidatePages ?? 0)} candidate pages reviewed, ${String(overrides)} source override${overrides === 1 ? "" : "s"} active or recorded, and ${String(totals?.blocked ?? 0)} sources need rule tuning.`;
  }

  if (key === "provider-website-parser-rule-audit") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.auditEvents ?? 0)} parser rule audit event${totals?.auditEvents === 1 ? "" : "s"}, including ${String(totals?.impactAuditEvents ?? 0)} impact comparison event${totals?.impactAuditEvents === 1 ? "" : "s"} and ${String(totals?.impactAttachmentEvents ?? 0)} attachment event${totals?.impactAttachmentEvents === 1 ? "" : "s"}, ${String(totals?.activeOverrides ?? 0)} active override${totals?.activeOverrides === 1 ? "" : "s"}, and ${String(totals?.unauditedOverrides ?? 0)} override${totals?.unauditedOverrides === 1 ? "" : "s"} missing audit evidence.`;
  }

  if (key === "provider-website-parser-rule-impact") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    const totals = record.totals as Record<string, unknown> | undefined;
    return totals
      ? `${String(totals.pagesCompared ?? 0)} parser page${totals.pagesCompared === 1 ? "" : "s"} compared, default stageable ${String(totals.defaultStageable ?? 0)}, active stageable ${String(totals.activeStageable ?? "n/a")}, replacement stageable ${String(totals.replacementStageable ?? "n/a")}.`
      : `${String(candidates)} provider website parser rule impact candidate${candidates === 1 ? "" : "s"} found for comparison.`;
  }

  if (key === "provider-website-parser-rule-impact-export") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.events ?? 0)} parser impact evidence event${totals?.events === 1 ? "" : "s"} exported, ${String(totals?.pagesCompared ?? 0)} page${totals?.pagesCompared === 1 ? "" : "s"} compared, and ${String(totals?.replacementStageable ?? 0)} replacement-stageable candidate${totals?.replacementStageable === 1 ? "" : "s"} retained.`;
  }

  if (key === "provider-website-parser-rule-impact-attach") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    const attached = Array.isArray(record.attachedImpactEventIds) ? record.attachedImpactEventIds.length : 0;
    return `${String(candidates)} parser impact attachment candidate${candidates === 1 ? "" : "s"} reviewed, ${String(attached)} impact evidence event${attached === 1 ? "" : "s"} selected, status ${String(record.status ?? "preview")}.`;
  }

  if (key === "provider-website-parser-rule-rollback") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    return `${String(candidates)} active parser rule override rollback candidate${candidates === 1 ? "" : "s"} found, dry-run ${String(record.dryRun)}.`;
  }

  if (key === "provider-website-parser-rule-replace") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    return `${String(candidates)} active parser rule override replacement candidate${candidates === 1 ? "" : "s"} found, dry-run ${String(record.dryRun)}.`;
  }

  if (key === "escalation-retry-scheduler") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    return `${String(candidates)} import escalation delivery retry candidate${candidates === 1 ? "" : "s"} found, ${String(record.scheduled ?? 0)} scheduled, dry-run ${String(record.dryRun)}.`;
  }

  if (key === "escalation-retry-delivery") {
    const batches = Array.isArray(record.batches) ? record.batches.length : 0;
    return `${String(batches)} import escalation retry delivery batch${batches === 1 ? "" : "es"} pending, ${String(record.executed ?? 0)} executed, dry-run ${String(record.dryRun)}.`;
  }

  if (key === "vendor-feeds") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.ready ?? 0)} ready vendor feeds, ${String(totals?.blocked ?? 0)} blocked, and ${String(totals?.credentialsVerified ?? 0)} verified credential references.`;
  }

  if (key === "vendor-worker") {
    return `${String(record.executedFeeds ?? 0)} vendor feeds executed, ${String(record.skippedFeeds ?? 0)} skipped for missing payloads, and ${String(record.blockedFeeds ?? 0)} blocked by readiness gates.`;
  }

  if (key === "entity-review-queue") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.approveReady ?? 0)} ready to approve, ${String(totals?.humanReview ?? 0)} need human review, ${String(totals?.unassigned ?? 0)} unassigned, and ${String(totals?.overdue ?? 0)} overdue.`;
  }

  if (key === "entity-review-assignment") {
    return `Extracted entity review was assigned to ${String(record.assignedTo ?? "the review owner")} with an SLA due date.`;
  }

  if (key === "merge-readiness") {
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    const updates = record.proposedUpdates && typeof record.proposedUpdates === "object" ? Object.keys(record.proposedUpdates).length : 0;
    return `Merge readiness is ${String(record.status ?? "unknown")} with ${String(blockers)} blocker${blockers === 1 ? "" : "s"} and ${String(updates)} proposed missing-field update${updates === 1 ? "" : "s"}.`;
  }

  if (key === "policy-review-assignments") {
    const candidates = Array.isArray(record.candidates) ? record.candidates.length : 0;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `${String(candidates)} policy review assignment candidate${candidates === 1 ? "" : "s"} found, ${String(blockers)} blocker${blockers === 1 ? "" : "s"}, status ${String(record.status ?? "preview")}.`;
  }

  if (key === "audit-export") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.events ?? 0)} audit event${totals?.events === 1 ? "" : "s"} exported, ${String(totals?.retentionCandidates ?? 0)} retention candidate${totals?.retentionCandidates === 1 ? "" : "s"} flagged.`;
  }

  if (key === "audit-retention") {
    const totals = record.totals as Record<string, unknown> | undefined;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `${String(totals?.retentionCandidates ?? 0)} audit retention candidate${totals?.retentionCandidates === 1 ? "" : "s"} found, ${String(blockers)} blocker${blockers === 1 ? "" : "s"}, status ${String(record.status ?? "preview")}.`;
  }

  if (key === "entity-escalations") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.overdue ?? 0)} overdue, ${String(totals?.dueSoon ?? 0)} due soon, ${String(totals?.unassigned ?? 0)} unassigned, and ${String(totals?.blockedRoutes ?? 0)} blocked routes.`;
  }

  if (key === "entity-escalation-notify") {
    const preview = record.payloadPreview as Record<string, unknown> | undefined;
    return `${String(preview?.escalationCount ?? 0)} escalation item${preview?.escalationCount === 1 ? "" : "s"} prepared for ${String(record.deliveryProvider ?? "manual export")} with status ${String(record.status ?? "ready")}.`;
  }

  if (key === "entity-escalation-delivery") {
    const channels = Array.isArray(record.channels) ? record.channels : [];
    return `${channels.length} import escalation delivery channels checked with status ${String(record.status ?? "manual_only")}.`;
  }

  if (key === "worker-health") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.healthy ?? 0)} workers healthy, ${String(totals?.stale ?? 0)} stale, ${String(totals?.failing ?? 0)} failing, and ${String(totals?.neverRun ?? 0)} never run.`;
  }

  if (key === "production-cutover") {
    const checks = Array.isArray(record.checks) ? record.checks.length : 0;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    const ownerActions = Array.isArray(record.ownerActions) ? record.ownerActions.length : 0;
    return `Cutover status ${String(record.status ?? "unknown")} across ${String(checks)} checks with ${String(blockers)} blocker${blockers === 1 ? "" : "s"} and ${String(ownerActions)} owner action${ownerActions === 1 ? "" : "s"}.`;
  }

  if (key === "rollback-evidence") {
    const steps = Array.isArray(record.rollbackSteps) ? record.rollbackSteps.length : 0;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `Rollback evidence is ${String(record.status ?? "unknown")} with ${String(steps)} recovery step${steps === 1 ? "" : "s"} and ${String(blockers)} blocker${blockers === 1 ? "" : "s"}.`;
  }

  if (key === "dns-cutover-approval") {
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `DNS cutover approval record is ${String(record.status ?? "unknown")} with ${String(blockers)} blocker${blockers === 1 ? "" : "s"} archived to audit evidence.`;
  }

  if (key === "dns-cutover-smoke-checklist") {
    const steps = Array.isArray(record.steps) ? record.steps.length : 0;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `DNS cutover smoke checklist is ${String(record.status ?? "unknown")} across ${String(steps)} step${steps === 1 ? "" : "s"} with ${String(blockers)} blocker${blockers === 1 ? "" : "s"}.`;
  }

  if (key === "credential-installation") {
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    const reviewedKeys = Array.isArray(record.reviewedKeys) ? record.reviewedKeys.length : 0;
    return `Credential installation review is ${String(record.status ?? "unknown")} for ${String(reviewedKeys)} key${reviewedKeys === 1 ? "" : "s"} with ${String(blockers)} blocker${blockers === 1 ? "" : "s"}.`;
  }

  if (key === "credential-smoke-evidence") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `Credential smoke evidence is ${String(record.status ?? "unknown")} across ${String(totals?.credentials ?? 0)} credential${totals?.credentials === 1 ? "" : "s"} with ${String(totals?.blocked ?? 0)} blocked.`;
  }

  if (key === "credential-evidence-retention") {
    const totals = record.totals as Record<string, unknown> | undefined;
    return `${String(totals?.archivedEvents ?? 0)} credential evidence archive${totals?.archivedEvents === 1 ? "" : "s"} reviewed, ${String(totals?.retentionCandidates ?? 0)} retention candidate${totals?.retentionCandidates === 1 ? "" : "s"}, status ${String(record.status ?? "preview")}.`;
  }

  if (key === "post-cutover-monitor") {
    const probes = Array.isArray(record.probes) ? record.probes.length : 0;
    const blockers = Array.isArray(record.blockers) ? record.blockers.length : 0;
    return `Post-cutover monitor is ${String(record.status ?? "unknown")} across ${String(probes)} probe${probes === 1 ? "" : "s"} with ${String(blockers)} blocker${blockers === 1 ? "" : "s"}.`;
  }

  if (key === "post-cutover-monitor-alerts") {
    return `Post-cutover monitor alert is ${String(record.status ?? "unknown")} for ${String(record.alertCount ?? 0)} alert item${record.alertCount === 1 ? "" : "s"} through ${String(record.deliveryProvider ?? "manual_export")}.`;
  }

  if (key === "import-plan") {
    return `Launch import plan is ready for the 5,000-listing target.`;
  }

  if (key === "launch-execution") {
    return `${String(record.executedBatches ?? 0)} launch batch${record.executedBatches === 1 ? "" : "es"} executed, ${String(record.blockedBatches ?? 0)} blocked for source adapters, and ${String((record.totals as Record<string, unknown> | undefined)?.stagedRecords ?? 0)} records staged in this run.`;
  }

  if (key === "ad-readiness") {
    return `Advertising readiness was checked for placements, disclosures, and backfill setup.`;
  }

  if (key === "report") {
    return `Community report was created for moderation review.`;
  }

  if (key === "moderate") {
    return `Community moderation decision was recorded.`;
  }

  return "Operation completed and the launch workspace was updated.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function OpsButton({
  icon,
  label,
  loading,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button className="ops-button" type="button" disabled={loading} onClick={onClick}>
      {loading ? <Loader2 className="spin-icon" aria-hidden="true" /> : icon}
      <span>{loading ? "Running..." : label}</span>
    </button>
  );
}
