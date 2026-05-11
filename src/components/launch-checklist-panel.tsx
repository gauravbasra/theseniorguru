"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleSlash, RefreshCw } from "lucide-react";
import type { LaunchChecklist, LaunchChecklistItem } from "@/lib/system/launch-checklist";

type ChecklistPayload = {
  data?: LaunchChecklist;
  error?: string;
};

export function LaunchChecklistPanel({ initialChecklist }: { initialChecklist: LaunchChecklist }) {
  const [checklist, setChecklist] = useState(initialChecklist);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function refreshChecklist() {
    setRefreshing(true);
    setError("");

    const response = await fetch("/api/v1/system/launch-checklist");
    const payload = await response.json().catch(() => ({} as ChecklistPayload));

    setRefreshing(false);

    if (!response.ok || !payload.data) {
      setError(payload.error ?? "Unable to refresh launch checklist.");
      return;
    }

    setChecklist(payload.data);
  }

  const primaryBlockers = checklist.blockers.slice(0, 8);
  const nextActions = checklist.nextActions.slice(0, 8);

  return (
    <section className="launch-checklist-panel">
      <div className="launch-checklist-header">
        <div>
          <p className="eyebrow">Launch checklist</p>
          <h2>One signed-in view for what is ready, blocked, and ready for owner action.</h2>
          <p>
            Tracks marketplace readiness across inventory, provider onboarding, ads, newsroom, reputation, and
            launch-critical owner items.
          </p>
        </div>
        <div className={`launch-status ${checklist.status}`}>
          <StatusIcon status={checklist.status} />
          <strong>{checklist.status.replaceAll("_", " ")}</strong>
          <span>{new Date(checklist.generatedAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="launch-actions">
        <button className="button primary" disabled={refreshing} onClick={refreshChecklist} type="button">
          <RefreshCw className={refreshing ? "spin-icon" : ""} aria-hidden="true" />
          {refreshing ? "Refreshing..." : "Refresh launch status"}
        </button>
      </div>

      {error ? <p className="login-error">{error}</p> : null}

      <div className="launch-check-grid">
        {checklist.checklist.map((item) => (
          <ChecklistCard item={item} key={item.key} />
        ))}
      </div>

      <div className="launch-work-grid">
        <article>
          <h3>Primary blockers</h3>
          <ul>
            {primaryBlockers.length ? primaryBlockers.map((blocker) => <li key={blocker}>{displayLaunchAction(blocker)}</li>) : <li>No blockers reported.</li>}
          </ul>
        </article>
        <article>
          <h3>Next actions</h3>
          <ul>
            {nextActions.length ? nextActions.map((action) => <li key={action}>{displayLaunchAction(action)}</li>) : <li>No next actions reported.</li>}
          </ul>
        </article>
      </div>
    </section>
  );
}

function ChecklistCard({ item }: { item: LaunchChecklistItem }) {
  return (
    <article className={`launch-check-card ${item.status}`}>
      <div>
        <StatusIcon status={item.status} />
        <span>{item.status.replaceAll("_", " ")}</span>
      </div>
      <h3>{displayLaunchLabel(item.label)}</h3>
      <p>
        {item.blockers.length
          ? `${item.blockers.length} blocker${item.blockers.length === 1 ? "" : "s"}`
          : "No blockers"}
      </p>
      {item.metrics ? (
        <dl>
          {Object.entries(item.metrics).slice(0, 4).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}

function displayLaunchLabel(label: string) {
  return label
    .replace("Internal route and API link health", "Site navigation and workflow health")
    .replace("AI newsroom publishing engine", "Newsroom publishing engine");
}

function displayLaunchAction(action: string) {
  return action
    .replaceAll("API key", "access key")
    .replaceAll("API secret", "access secret")
    .replaceAll("APIs", "operations")
    .replaceAll("API", "operation");
}

function StatusIcon({ status }: { status: LaunchChecklistItem["status"] | LaunchChecklist["status"] }) {
  if (status === "ready") {
    return <CheckCircle2 aria-hidden="true" />;
  }

  if (status === "blocked") {
    return <CircleSlash aria-hidden="true" />;
  }

  return <AlertTriangle aria-hidden="true" />;
}
