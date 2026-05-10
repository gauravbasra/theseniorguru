import Link from "next/link";
import { getProviderDashboard } from "@/lib/provider-dashboard/dashboard";
import { audienceMessaging } from "@/lib/messaging/audiences";

export default async function OperatorsPage() {
  const dashboard = await getProviderDashboard();
  const copy = audienceMessaging.operators;

  return (
    <main className="audience-shell">
      <section className="audience-hero operators-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p className="lede">{copy.subhead}</p>
          <div className="actions">
            <Link className="button primary" href="/provider">{copy.ctaPrimary}</Link>
            <Link className="button secondary" href="/api/v1/provider/campaigns">{copy.ctaSecondary}</Link>
          </div>
        </div>
        <div className="audience-panel">
          {copy.principles.map((item) => (
            <div key={item}>
              <span>✓</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="profile-card dashboard-primary">
          <p className="eyebrow">Growth cockpit preview</p>
          <h2>{dashboard.provider?.name ?? "Provider profile"}</h2>
          <p>Claim status: {dashboard.stats.claimStatus.replaceAll("_", " ")}</p>
        </article>
        <article className="profile-card">
          <p className="eyebrow">Campaigns</p>
          <h2>{dashboard.stats.campaigns}</h2>
          <p>AI SEO, social, review, chat, voice, event, and sponsored content campaigns.</p>
        </article>
        <article className="profile-card">
          <p className="eyebrow">Events</p>
          <h2>{dashboard.stats.events}</h2>
          <p>Events become community value and monetizable local promotion inventory.</p>
        </article>
      </section>
    </main>
  );
}

