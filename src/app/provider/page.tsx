import Link from "next/link";
import type { CSSProperties } from "react";
import { ProviderActionConsole } from "@/components/provider-action-console";
import { getProviderDashboard } from "@/lib/provider-dashboard/dashboard";

export default async function ProviderDashboardPage() {
  const dashboard = await getProviderDashboard();

  return (
    <main className="provider-dashboard-shell">
      <section className="local-hero">
        <p className="eyebrow">Provider growth cockpit</p>
        <h1>Your free listing is the start. Growth is the paid engine.</h1>
        <p className="lede">
          Claim your profile, publish events, manage reviews, run AI campaigns, and use labeled sponsored placements
          without paying referral fees.
        </p>
      </section>

      <section className="dashboard-grid">
        <article className="profile-card dashboard-primary">
          <p className="eyebrow">Current listing</p>
          <h2>{dashboard.provider?.name ?? "No provider selected"}</h2>
          <p>
            {dashboard.provider
              ? `${dashboard.provider.city}, ${dashboard.provider.state} · ${dashboard.provider.categories.join(" • ")}`
              : "Provider data will appear after inventory is connected."}
          </p>
          {dashboard.provider ? (
            <Link className="button primary" href={`/providers/${dashboard.provider.slug}`}>View public profile</Link>
          ) : null}
        </article>

        <article className="profile-card">
          <p className="eyebrow">Claim status</p>
          <h2>{dashboard.stats.claimStatus.replaceAll("_", " ")}</h2>
          <p>Verified providers can update their listing and access growth tools.</p>
        </article>

        <article className="profile-card">
          <p className="eyebrow">Campaigns</p>
          <h2>{dashboard.stats.campaigns}</h2>
          <p>AI SEO, social, event, review, chat, and voice campaigns will live here.</p>
        </article>

        <article className="profile-card">
          <p className="eyebrow">Events</p>
          <h2>{dashboard.stats.events}</h2>
          <p>Events create community value and monetizable local promotion inventory.</p>
        </article>
      </section>

      {dashboard.visibilityReport ? (
        <section className="visibility-report">
          <div className="visibility-score-card">
            <p className="eyebrow">Visibility report</p>
            <h2>{dashboard.visibilityReport.overallScore}%</h2>
            <p>
              Search readiness, family trust, reputation, and growth signals for {dashboard.visibilityReport.providerName}.
            </p>
          </div>
          <div className="visibility-metrics">
            {dashboard.visibilityReport.metrics.map((metric) => (
              <article className={`visibility-metric ${metric.status}`} key={metric.label}>
                <div>
                  <span>{metric.label}</span>
                  <strong>{metric.value}/{metric.total}</strong>
                </div>
                <i style={{ "--value": `${Math.round((metric.value / Math.max(metric.total, 1)) * 100)}%` } as CSSProperties} />
              </article>
            ))}
          </div>
          <div className="visibility-actions">
            <p className="eyebrow">Next best actions</p>
            {dashboard.visibilityReport.nextBestActions.map((action) => (
              <Link className={`visibility-action ${action.priority}`} href={action.href} key={action.label}>
                <span>{action.priority}</span>
                <strong>{action.label}</strong>
                <small>{action.reason}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="task-list">
        <p className="eyebrow">Recommended growth path</p>
        {dashboard.growthTasks.map((task) => (
          <article className="provider-card" key={task.title}>
            <div>
              <p className="status">{task.status}</p>
              <h2>{task.title}</h2>
            </div>
            <div className="card-actions">
              <Link href={task.href}>{providerTaskAction(task.title)}</Link>
            </div>
          </article>
        ))}
      </section>

      <ProviderActionConsole providerId={dashboard.provider?.id} />
    </main>
  );
}

function providerTaskAction(title: string) {
  const normalized = title.toLowerCase();

  if (normalized.includes("claim")) return "Start claim";
  if (normalized.includes("reputation") || normalized.includes("review")) return "Review reputation";
  if (normalized.includes("event")) return "Promote event";
  if (normalized.includes("campaign")) return "Create campaign";
  if (normalized.includes("growth")) return "View growth plan";

  return "Continue";
}
