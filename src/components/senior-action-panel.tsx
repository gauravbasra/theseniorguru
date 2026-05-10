"use client";

import { useState } from "react";
import { HeartHandshake, MessageCircleQuestion, Save, UserPlus } from "lucide-react";

type SeniorActionResult = {
  label: string;
  ok: boolean;
  message: string;
  data?: unknown;
};

type SeniorActionPanelProps = {
  providerId?: string;
};

export function SeniorActionPanel({ providerId }: SeniorActionPanelProps) {
  const [results, setResults] = useState<SeniorActionResult[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const userKey = "demo-family-user";

  async function run(label: string, key: string, request: () => Promise<Response>) {
    setLoadingKey(key);
    const response = await request();
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);
    setResults((current) => [
      {
        label,
        ok: response.ok,
        message: response.ok ? "Success" : payload.error ?? "Request failed",
        data: payload.data
      },
      ...current.slice(0, 4)
    ]);
  }

  return (
    <section className="senior-actions">
      <div className="console-header">
        <div>
          <p className="eyebrow">Family app actions</p>
          <h2>Try the sticky mobile workflows</h2>
          <p>These actions call the same app APIs intended for the senior mobile experience.</p>
        </div>
      </div>
      <div className="senior-action-grid">
        <SeniorButton
          icon={<Save aria-hidden="true" />}
          label="Save provider"
          loading={loadingKey === "save"}
          disabled={!providerId}
          onClick={() =>
            run("Save provider", "save", () =>
              fetch("/api/v1/app/saved-providers", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  userKey,
                  providerId,
                  notes: "Discuss with family",
                  tags: ["shortlist", "tour"]
                })
              })
            )
          }
        />
        <SeniorButton
          icon={<HeartHandshake aria-hidden="true" />}
          label="Create care circle"
          loading={loadingKey === "circle"}
          onClick={() =>
            run("Create care circle", "circle", () =>
              fetch("/api/v1/app/care-circles", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  ownerUserKey: userKey,
                  name: "Mom care planning",
                  city: "Denver",
                  state: "CO",
                  goals: { priority: "compare options calmly" }
                })
              })
            )
          }
        />
        <SeniorButton
          icon={<UserPlus aria-hidden="true" />}
          label="Invite family"
          loading={loadingKey === "member"}
          onClick={() =>
            run("Invite family", "member", () =>
              fetch("/api/v1/app/care-circles/pending-care-circle-demo/members", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  displayName: "Anita",
                  email: "anita@example.com",
                  role: "family"
                })
              })
            )
          }
        />
        <SeniorButton
          icon={<MessageCircleQuestion aria-hidden="true" />}
          label="Ask community"
          loading={loadingKey === "post"}
          onClick={() =>
            run("Ask community", "post", () =>
              fetch("/api/v1/community/posts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  title: "What should we ask on a first tour?",
                  body: "We are comparing local options and want practical questions.",
                  postType: "question",
                  city: "Denver",
                  state: "CO"
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
              <pre>{JSON.stringify(result.data ?? {}, null, 2)}</pre>
            </article>
          ))
        ) : (
          <article className="console-result">
            <div>
              <strong>No family actions run yet</strong>
              <span>Use the buttons above to call backend workflows.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function SeniorButton({
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
    </button>
  );
}

