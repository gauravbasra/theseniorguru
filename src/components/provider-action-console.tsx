"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, FileCheck2, ListChecks, Megaphone, Send, ShieldCheck, Sparkles, Star } from "lucide-react";

type ActionResult = {
  label: string;
  ok: boolean;
  message: string;
  data?: unknown;
  summary: string;
};

type ProviderActionConsoleProps = {
  providerId?: string;
};

export function ProviderActionConsole({ providerId }: ProviderActionConsoleProps) {
  const [results, setResults] = useState<ActionResult[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const disabled = !providerId;
  const tomorrow = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + 14);
    start.setHours(16, 0, 0, 0);
    const end = new Date(start);
    end.setHours(17, 30, 0, 0);
    return { start, end };
  }, []);

  async function runAction(label: string, key: string, request: () => Promise<Response>) {
    setLoadingKey(key);
    const response = await request();
    const payload = await response.json();
    setLoadingKey(null);
    setResults((current) => [
      {
        label,
        ok: response.ok,
        message: response.ok ? "Success" : payload.error ?? "Request failed",
        data: payload.data,
        summary: summarizeProviderAction(key, payload.data)
      },
      ...current.slice(0, 4)
    ]);

    if (response.ok && key === "claim" && payload.data?.id) {
      setClaimId(String(payload.data.id));
    }
  }

  return (
    <section className="action-console">
      <div className="console-header">
        <div>
          <p className="eyebrow">Provider actions</p>
          <h2>Manage your listing and growth tools</h2>
          <p>Use these actions to claim the listing, create events, start campaigns, and check reputation readiness.</p>
        </div>
      </div>

      <div className="console-actions">
        <ConsoleButton
          icon={<ShieldCheck aria-hidden="true" />}
          disabled={disabled}
          loading={loadingKey === "claim"}
          label="Submit claim"
          onClick={() =>
            runAction("Submit claim", "claim", () =>
              fetch(`/api/v1/providers/${providerId}/claim`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  claimantName: "Demo Operator",
                  claimantEmail: "operator@example.com",
                  claimantRole: "Executive Director",
                  businessDomain: "example.com"
                })
              })
            )
          }
        />
        <ConsoleButton
          icon={<ListChecks aria-hidden="true" />}
          disabled={!claimId}
          loading={loadingKey === "claim-status"}
          label="Check claim status"
          onClick={() =>
            runAction("Check claim status", "claim-status", () =>
              fetch(`/api/v1/provider-portal/claims/${claimId}/status`)
            )
          }
        />
        <ConsoleButton
          icon={<FileCheck2 aria-hidden="true" />}
          disabled={!claimId}
          loading={loadingKey === "claim-evidence"}
          label="Submit evidence"
          onClick={() =>
            runAction("Submit claim evidence", "claim-evidence", () =>
              fetch(`/api/v1/provider-portal/claims/${claimId}/verification-evidence`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  evidence: {
                    evidenceType: "business_email",
                    submittedBy: "Demo Operator",
                    emailDomain: "example.com",
                    note: "Demo provider console evidence submission",
                    attestationAccepted: true
                  }
                })
              })
            )
          }
        />
        <ConsoleButton
          icon={<CalendarPlus aria-hidden="true" />}
          disabled={disabled}
          loading={loadingKey === "event"}
          label="Create event"
          onClick={() =>
            runAction("Create event", "event", () =>
              fetch("/api/v1/provider/events", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  providerId,
                  title: "Care Planning Open House",
                  eventType: "open_house",
                  startsAt: tomorrow.start.toISOString(),
                  endsAt: tomorrow.end.toISOString(),
                  city: "Denver",
                  state: "CO",
                  publish: true
                })
              })
            )
          }
        />
        <ConsoleButton
          icon={<Sparkles aria-hidden="true" />}
          disabled={disabled}
          loading={loadingKey === "subscribe"}
          label="Create growth contract"
          onClick={() =>
            runAction("Create growth contract", "subscribe", () =>
              fetch("/api/v1/provider/growth-subscriptions", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  providerId,
                  planKey: "growth_starter",
                  termMonths: 6,
                  autoRenews: true,
                  contractPayload: { source: "provider_console" }
                })
              })
            )
          }
        />
        <ConsoleButton
          icon={<Star aria-hidden="true" />}
          disabled={disabled}
          loading={loadingKey === "reputation"}
          label="Check reputation"
          onClick={() =>
            runAction("Check reputation readiness", "reputation", () =>
              fetch(`/api/v1/provider/reputation-readiness?providerId=${providerId}`)
            )
          }
        />
        <ConsoleButton
          icon={<Megaphone aria-hidden="true" />}
          disabled={disabled}
          loading={loadingKey === "campaign"}
          label="Launch SEO campaign"
          onClick={() =>
            runAction("Launch SEO campaign", "campaign", () =>
              fetch("/api/v1/provider/campaigns", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  providerId,
                  campaignType: "local_seo",
                  name: "Local SEO growth push",
                  channels: ["seo", "social"]
                })
              })
            )
          }
        />
      </div>

      <div className="console-results" aria-live="polite">
        {results.length ? (
          results.map((result, index) => (
            <article className={result.ok ? "console-result ok" : "console-result error"} key={`${result.label}-${index}`}>
              <div>
                <strong>{result.label}</strong>
                <span>{result.message}</span>
              </div>
              <p>{result.summary}</p>
            </article>
          ))
        ) : (
          <article className="console-result">
            <div>
              <strong>No actions run yet</strong>
              <span>Choose a provider action to see the result here.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function summarizeProviderAction(key: string, data: unknown) {
  const record = isRecord(data) ? data : {};

  if (key === "claim") {
    return `Claim ${String(record.status ?? "submitted")} and ready for verification.`;
  }

  if (key === "claim-status") {
    const checklist = Array.isArray(record.checklist) ? record.checklist.length : 0;
    return `Claim status is ${String(record.status ?? "in review")} with ${checklist} verification steps.`;
  }

  if (key === "claim-evidence") {
    return `Verification evidence was saved and moved into review.`;
  }

  if (key === "event") {
    return `Event ${String(record.status ?? "created")} for families to discover and RSVP.`;
  }

  if (key === "subscribe") {
    return `Growth contract ${String(record.status ?? "created")} for a ${String(record.termMonths ?? 6)} month term.`;
  }

  if (key === "reputation") {
    return `Reputation status: ${String(record.status ?? "review")} with review and response readiness checked.`;
  }

  if (key === "campaign") {
    return `Campaign ${String(record.status ?? "created")} and ready for the next growth step.`;
  }

  return "Action completed and the provider workspace was updated.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ConsoleButton({
  icon,
  label,
  loading,
  disabled,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="console-button" type="button" disabled={disabled || loading} onClick={onClick}>
      {icon}
      <span>{loading ? "Running..." : label}</span>
      <Send aria-hidden="true" />
    </button>
  );
}
