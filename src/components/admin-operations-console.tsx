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
  Radar,
  Send,
  ShieldAlert
} from "lucide-react";

type OperationResult = {
  label: string;
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
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
        error: payload.error
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
          label="Aggregation readiness"
          loading={loadingKey === "aggregation-readiness"}
          onClick={() =>
            runOperation("Aggregation readiness", "aggregation-readiness", () =>
              fetch("/api/v1/admin/aggregation-readiness")
            )
          }
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
              <pre>{JSON.stringify(result.data ?? { error: result.error }, null, 2)}</pre>
            </article>
          ))
        ) : (
          <article className="ops-result">
            <div>
              <strong>No operations run yet</strong>
              <span>Choose an action to exercise launch operations.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
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
