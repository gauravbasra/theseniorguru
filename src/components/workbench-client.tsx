"use client";

import { useState } from "react";
import { Activity, CheckCircle2, DatabaseZap, Loader2, Play, ShieldCheck, Sparkles } from "lucide-react";

type DemoResponse = {
  ranAt: string;
  readiness: {
    overallStatus: string;
  };
  plans: Array<{
    name: string;
    monthlyPriceCents: number;
  }>;
  importDryRun: {
    totalRecords: number;
    stagedRecords: number;
    rejectedRecords: number;
  };
  matchResult: {
    topScore: number;
    candidateCount: number;
  };
  savedProvider: {
    providerId: string;
    tags: string[];
  };
  careCircle: {
    name: string;
  };
  subscription: {
    status: string;
    termMonths: number;
  };
  entitlement: {
    allowed: boolean;
    reason: string;
  };
  campaign: {
    name: string;
    status: string;
  };
  eventPromotion: {
    status: string;
    disclosureLabel: string;
    budgetCents: number;
  };
  eventAnalytics: {
    rsvps: { total: number };
    ads: { impressions: number; clicks: number };
  };
};

const checks = [
  "Import worker validates listings and rejects bad records",
  "Entity matching flags possible duplicates before publishing",
  "Mobile stickiness saves providers and creates care circles",
  "Growth subscriptions create contract-first paid access",
  "Entitlements gate paid campaigns and event promotions",
  "Event analytics reports RSVPs and ad performance"
];

export function WorkbenchClient() {
  const [result, setResult] = useState<DemoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDemo() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/v1/workbench/demo-run", { method: "POST" });
    const payload = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(payload.error ?? "Demo run failed");
      return;
    }

    setResult(payload.data);
  }

  return (
    <section className="workbench-grid">
      <article className="workbench-panel workbench-runner">
        <div>
          <p className="eyebrow">Executable workflow</p>
          <h2>Run the platform proof</h2>
          <p>
            This run moves through the real operating flow: inventory review, matching, saved communities, care
            circles, growth plan access, campaigns, event promotion, and analytics.
          </p>
        </div>
        <button className="button primary icon-button" type="button" onClick={runDemo} disabled={loading}>
          {loading ? <Loader2 aria-hidden="true" className="spin-icon" /> : <Play aria-hidden="true" />}
          {loading ? "Running" : "Run workflow"}
        </button>
        {error ? <p className="workbench-error">{error}</p> : null}
      </article>

      <article className="workbench-panel">
        <p className="eyebrow">What it proves</p>
        <div className="proof-list">
          {checks.map((check) => (
            <div key={check}>
              <CheckCircle2 aria-hidden="true" />
              <span>{check}</span>
            </div>
          ))}
        </div>
      </article>

      {result ? (
        <>
          <MetricCard icon={<DatabaseZap aria-hidden="true" />} label="Import dry run" value={`${result.importDryRun.stagedRecords}/${result.importDryRun.totalRecords}`} detail={`${result.importDryRun.rejectedRecords} rejected`} />
          <MetricCard icon={<ShieldCheck aria-hidden="true" />} label="Match score" value={`${Math.round(result.matchResult.topScore * 100)}%`} detail={`${result.matchResult.candidateCount} candidates`} />
          <MetricCard icon={<Sparkles aria-hidden="true" />} label="Entitlement" value={result.entitlement.allowed ? "Allowed" : "Blocked"} detail={result.entitlement.reason.replaceAll("_", " ")} />
          <MetricCard icon={<Activity aria-hidden="true" />} label="Campaign" value={result.campaign.status} detail={result.campaign.name} />

          <article className="workbench-panel workbench-wide">
            <p className="eyebrow">Run results</p>
            <div className="result-table">
              <ResultRow label="Readiness" value={result.readiness.overallStatus} />
              <ResultRow label="Growth plans" value={`${result.plans.length} available`} />
              <ResultRow label="Saved provider" value={`${result.savedProvider.providerId} (${result.savedProvider.tags.join(", ")})`} />
              <ResultRow label="Care circle" value={result.careCircle.name} />
              <ResultRow label="Subscription" value={`${result.subscription.status}, ${result.subscription.termMonths} months`} />
              <ResultRow label="Event promotion" value={`${result.eventPromotion.status}, ${result.eventPromotion.disclosureLabel}, $${result.eventPromotion.budgetCents / 100}`} />
              <ResultRow label="Event analytics" value={`${result.eventAnalytics.rsvps.total} RSVPs, ${result.eventAnalytics.ads.impressions} impressions`} />
              <ResultRow label="Ran at" value={new Date(result.ranAt).toLocaleString()} />
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="workbench-panel metric-card">
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <h3>{value}</h3>
      <span>{detail}</span>
    </article>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
