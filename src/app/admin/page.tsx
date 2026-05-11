import Link from "next/link";
import type { CSSProperties } from "react";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { LaunchChecklistPanel } from "@/components/launch-checklist-panel";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard-metrics";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getProductMap } from "@/lib/system/product-map";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [product, launchChecklist, dashboardMetrics] = await Promise.all([
    getProductMap(),
    getLaunchChecklist(),
    getAdminDashboardMetrics()
  ]);
  const readinessGroups = Object.entries(product.readiness.groups);
  const maxEngineRoutes = Math.max(...dashboardMetrics.productEngines.map((item) => item.routes), 1);

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Platform command center</p>
          <h1>Run The Senior Guru like a real senior living marketplace.</h1>
          <p className="lede">
            Monitor launch readiness, review incoming leads, prepare inventory, verify community claims, and activate
            the growth tools that turn free listings into paid operator relationships.
          </p>
          <div className="actions">
            <Link className="button primary" href="/provider">Provider console</Link>
            <Link className="button secondary" href="/discover">View marketplace</Link>
            <Link className="button secondary" href="/articles">Review content hub</Link>
            <form action="/api/v1/auth/logout" method="post">
              <button className="button secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <aside className="admin-status-card">
          <p className="eyebrow">Launch health</p>
          <h2>{product.operationalSummary.readinessStatus.replaceAll("_", " ")}</h2>
          <p>
            Site checks: {product.linkHealth.status} · Data sources: {product.operationalSummary.dataSources} ·
            Import batches: {product.operationalSummary.importBatches}
          </p>
        </aside>
      </section>

      <section className="admin-promises">
        <article>
          <p className="eyebrow">Consumer promise</p>
          <h2>{product.slogans.consumer}</h2>
        </article>
        <article>
          <p className="eyebrow">Provider promise</p>
          <h2>{product.slogans.provider}</h2>
        </article>
        <article>
          <p className="eyebrow">Market promise</p>
          <h2>{product.slogans.market}</h2>
        </article>
      </section>

      <section className="admin-metrics">
        {[
          ["Live providers", dashboardMetrics.headlineNumbers.totalProviders],
          ["Lead queue", dashboardMetrics.headlineNumbers.totalLeads],
          ["Backend workflows", dashboardMetrics.headlineNumbers.backendRoutes],
          ["Required tables", dashboardMetrics.headlineNumbers.requiredTables]
        ].map(([label, value]) => (
          <article className="profile-card" key={label}>
            <p className="eyebrow">{label}</p>
            <h2>{value}</h2>
          </article>
        ))}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Visual command center</p>
            <h2>Charts for launch readiness, inventory growth, leads, and monetization.</h2>
          </div>
          <Link className="button secondary" href="/api/v1/admin/dashboard-metrics">Metrics API</Link>
        </div>
        <div className="admin-chart-grid">
          <article className="chart-panel chart-panel-large">
            <div className="chart-panel-header">
              <div>
                <p className="eyebrow">Launch readiness</p>
                <h3>{launchChecklist.status.replaceAll("_", " ")}</h3>
              </div>
              <DonutChart
                label={`${dashboardMetrics.readiness.find((item) => item.label === "Ready")?.value ?? 0}/${dashboardMetrics.readiness.reduce((sum, item) => sum + item.value, 0)}`}
                value={dashboardMetrics.readiness.find((item) => item.label === "Ready")?.value ?? 0}
                total={dashboardMetrics.readiness.reduce((sum, item) => sum + item.value, 0)}
              />
            </div>
            <div className="stacked-bars">
              {dashboardMetrics.readiness.map((item) => (
                <HorizontalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  total={dashboardMetrics.readiness.reduce((sum, row) => sum + row.value, 0)}
                  tone={item.tone}
                />
              ))}
            </div>
          </article>

          <article className="chart-panel">
            <div className="chart-panel-header">
              <div>
                <p className="eyebrow">Route health</p>
                <h3>{dashboardMetrics.routeHealth.percentValid}% valid</h3>
              </div>
              <DonutChart
                label={`${dashboardMetrics.routeHealth.valid}/${dashboardMetrics.routeHealth.total}`}
                value={dashboardMetrics.routeHealth.valid}
                total={dashboardMetrics.routeHealth.total}
              />
            </div>
            <p className="chart-note">{dashboardMetrics.routeHealth.invalid} invalid links or API contracts.</p>
          </article>

          <article className="chart-panel chart-panel-wide">
            <p className="eyebrow">5,000-listing launch target</p>
            <h3>Inventory pipeline</h3>
            <div className="progress-list">
              {dashboardMetrics.inventoryProgress.map((item) => (
                <HorizontalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  total={item.total ?? 1}
                  tone={item.tone}
                />
              ))}
            </div>
          </article>

          <article className="chart-panel">
            <p className="eyebrow">Lead funnel</p>
            <h3>Inbound demand by audience</h3>
            <div className="mini-column-chart">
              {dashboardMetrics.leadFunnel.map((item) => (
                <VerticalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  total={Math.max(...dashboardMetrics.leadFunnel.map((row) => row.value), 1)}
                  tone={item.tone}
                />
              ))}
            </div>
          </article>

          <article className="chart-panel">
            <p className="eyebrow">Advertising</p>
            <h3>Monetization activity</h3>
            <div className="metric-chip-grid">
              {dashboardMetrics.monetization.map((item) => (
                <span className={`metric-chip ${item.tone}`} key={item.label}>
                  <strong>{item.value}</strong>
                  {item.label}
                </span>
              ))}
            </div>
          </article>

          <article className="chart-panel chart-panel-full">
            <p className="eyebrow">Backend engine depth</p>
            <h3>Routes and tables by product pillar</h3>
            <div className="engine-chart">
              {dashboardMetrics.productEngines.map((item) => (
                <div className="engine-row" key={item.label}>
                  <span>{item.label}</span>
                  <div>
                    <i style={{ "--value": `${percentOf(item.routes, maxEngineRoutes)}%` } as CSSProperties} />
                    <b>{item.routes} workflows · {item.tables} tables</b>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="admin-section">
        <LaunchChecklistPanel initialChecklist={launchChecklist} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Executable operations</p>
            <h2>Operate the launch pipeline from one place.</h2>
          </div>
        </div>
        <AdminOperationsConsole />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Business engines</p>
            <h2>The platform is organized around the money-making and trust-building workflows.</h2>
          </div>
        </div>
        <div className="pillar-grid">
          {product.pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.key}>
              <div>
                <span className={`status-pill ${pillar.status}`}>{pillar.status}</span>
                <h3>{displayPillarTitle(pillar.title)}</h3>
                <p>{displayPillarObjective(pillar.objective)}</p>
                <small>{pillar.audience}</small>
              </div>
              <div>
                <strong>What this powers</strong>
                <ul>
                  {uniqueCapabilities(pillar.backendRoutes).slice(0, 6).map((capability) => (
                    <li key={`${pillar.key}-${capability}`}>{capability}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Next product work</strong>
                <ul>
                  {pillar.nextBackendWork.map((item) => (
                    <li key={item}>{item.replaceAll("API", "workflow").replaceAll("endpoint", "workflow")}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section readiness-section">
        <div>
          <p className="eyebrow">Readiness and blockers</p>
          <h2>Owner-dependent launch items stay visible until they are cleared.</h2>
        </div>
        <div className="readiness-grid">
          {readinessGroups.map(([name, group]) => (
            <article className="profile-card" key={name}>
              <p className="eyebrow">{name.replaceAll(/([A-Z])/g, " $1")}</p>
              <h3>{group.status.replaceAll("_", " ")}</h3>
              <ul>
                {group.checks.map((check) => (
                  <li key={check.key}>
                    <strong>{displayReadinessLabel(check.label)}</strong>
                    <span>{check.status}</span>
                    {check.action ? <small>{displayOwnerAction(check.action)}</small> : null}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function HorizontalBar({
  label,
  value,
  total,
  tone
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  return (
    <div className={`horizontal-bar ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}{total > value ? ` / ${total}` : ""}</strong>
      </div>
      <i style={{ "--value": `${percentOf(value, total)}%` } as CSSProperties} />
    </div>
  );
}

function VerticalBar({
  label,
  value,
  total,
  tone
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  return (
    <div className={`vertical-bar ${tone}`}>
      <i style={{ "--value": `${Math.max(percentOf(value, total), value > 0 ? 8 : 2)}%` } as CSSProperties} />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function DonutChart({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div
      className="donut-chart"
      style={{ "--value": `${percentOf(value, total)}%` } as CSSProperties}
      aria-label={`${label} ready`}
    >
      <strong>{label}</strong>
    </div>
  );
}

function percentOf(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

function uniqueCapabilities(routes: string[]) {
  return Array.from(new Set(routes.map(businessCapabilityFromRoute)));
}

function displayPillarTitle(title: string) {
  if (title === "Open API Platform") return "Partner Integration Platform";
  return title;
}

function displayPillarObjective(objective: string) {
  return objective
    .replace("APIs", "integrations")
    .replace("API", "integration")
    .replace("backend", "operations");
}

function displayReadinessLabel(label: string) {
  return label
    .replace("Supabase schema readiness endpoint", "Supabase database readiness")
    .replace("Owner backend access code", "Owner command center access code")
    .replace("API key", "access key")
    .replace("API secret", "access secret");
}

function displayOwnerAction(action: string) {
  if (action.includes("GET /api/v1/system/supabase-schema")) {
    return "Review database tables after production credentials are connected.";
  }

  return action
    .replaceAll("API key", "access key")
    .replaceAll("API secret", "access secret")
    .replaceAll("APIs", "operations")
    .replaceAll("API", "operation")
    .replaceAll("/api/v1", "the owner console")
    .replaceAll("endpoint", "check");
}

function businessCapabilityFromRoute(route: string) {
  const routeText = route.toLowerCase();

  if (routeText.includes("providers/{id}/contact") || routeText.includes("inquiries")) return "Family inquiry capture";
  if (routeText.includes("free-listing")) return "Free listing intake";
  if (routeText.includes("provider-claims") || routeText.includes("/claim")) return "Community claim verification";
  if (routeText.includes("verification")) return "Operator verification";
  if (routeText.includes("provider-outreach")) return "Claim outreach";
  if (routeText.includes("providers") || routeText.includes("categories") || routeText.includes("locations")) return "Marketplace discovery";
  if (routeText.includes("saved-providers")) return "Saved communities";
  if (routeText.includes("care-circles")) return "Care circle collaboration";
  if (routeText.includes("comparison-lists")) return "Community comparison";
  if (routeText.includes("care-notes")) return "Care planning notes";
  if (routeText.includes("tour-plans")) return "Tour planning";
  if (routeText.includes("events") && routeText.includes("analytics")) return "Event performance";
  if (routeText.includes("events") && routeText.includes("promotions")) return "Sponsored event promotion";
  if (routeText.includes("events") || routeText.includes("rsvp")) return "Community events";
  if (routeText.includes("growth-subscriptions") || routeText.includes("growth-plans")) return "Growth plan contracts";
  if (routeText.includes("entitlements")) return "Paid feature access";
  if (routeText.includes("campaigns")) return "Marketing campaigns";
  if (routeText.includes("review-request")) return "Review request campaigns";
  if (routeText.includes("reputation")) return "Reputation readiness";
  if (routeText.includes("reviews")) return "Reviews and responses";
  if (routeText.includes("ads") || routeText.includes("ad-")) return "Advertising placements";
  if (routeText.includes("import") || routeText.includes("extracted-entities")) return "Inventory import review";
  if (routeText.includes("crawl")) return "Approved source crawling";
  if (routeText.includes("data-quality")) return "Data quality review";
  if (routeText.includes("newsroom") || routeText.includes("articles")) return "Editorial publishing";
  if (routeText.includes("policy")) return "Trust and compliance guardrails";
  if (routeText.includes("auth")) return "Owner access control";
  if (routeText.includes("webhook") || routeText.includes("api-client") || routeText.includes("partner")) return "Partner integrations";
  if (routeText.includes("system") || routeText.includes("link-health")) return "Launch readiness checks";

  return "Operational workflow";
}
