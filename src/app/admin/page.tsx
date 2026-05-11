import Link from "next/link";
import type { CSSProperties } from "react";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { LaunchChecklistPanel } from "@/components/launch-checklist-panel";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard-metrics";
import type { ImportRecordInput } from "@/lib/domain/imports";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getProductMap } from "@/lib/system/product-map";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [product, launchChecklist, dashboardMetrics, listingPreview] = await Promise.all([
    getProductMap(),
    getLaunchChecklist(),
    getAdminDashboardMetrics(),
    previewCurrentSiteRealListings({ maxRecords: 12 })
  ]);
  const readinessGroups = Object.entries(product.readiness.groups);
  const maxEngineRoutes = Math.max(...dashboardMetrics.productEngines.map((item) => item.routes), 1);
  const readyCount = dashboardMetrics.readiness.find((item) => item.label === "Ready")?.value ?? 0;
  const totalReadiness = dashboardMetrics.readiness.reduce((sum, item) => sum + item.value, 0);
  const acquisitionTarget = 5000;

  return (
    <main className="admin-shell">
      <section className="command-dashboard">
        <div className="command-topbar">
          <div>
            <p className="eyebrow">Owner command center</p>
            <h1>TheSeniorGuru operations dashboard</h1>
          </div>
          <div className="actions">
            <Link className="button primary" href="/provider">Provider console</Link>
            <Link className="button secondary" href="/discover">View marketplace</Link>
            <form action="/api/v1/auth/logout" method="post">
              <button className="button secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        <div className="command-kpi-grid">
          <article className="command-kpi primary">
            <span>Real listings discovered</span>
            <strong>{listingPreview.discoveredListings}</strong>
            <small>{listingPreview.parsedRecords} parsed in preview</small>
          </article>
          <article className="command-kpi">
            <span>Listing target</span>
            <strong>{percentOf(listingPreview.discoveredListings, acquisitionTarget)}%</strong>
            <small>{listingPreview.discoveredListings} / {acquisitionTarget}</small>
          </article>
          <article className="command-kpi">
            <span>Image coverage</span>
            <strong>{listingPreview.imageCoverage.listingsWithThreeImages}/{listingPreview.parsedRecords}</strong>
            <small>3+ source images</small>
          </article>
          <article className="command-kpi">
            <span>Lead queue</span>
            <strong>{dashboardMetrics.headlineNumbers.totalLeads}</strong>
            <small>family + operator demand</small>
          </article>
          <article className="command-kpi">
            <span>Route health</span>
            <strong>{dashboardMetrics.routeHealth.percentValid}%</strong>
            <small>{dashboardMetrics.routeHealth.total} checks</small>
          </article>
        </div>

        <div className="command-screen-grid">
          <article className="dashboard-panel launch-ring-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Launch readiness</p>
                <h2>{launchChecklist.status.replaceAll("_", " ")}</h2>
              </div>
              <DonutChart
                label={`${readyCount}/${totalReadiness}`}
                value={readyCount}
                total={totalReadiness}
              />
            </div>
            <div className="compact-bars">
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

          <article className="dashboard-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">5,000-listing launch</p>
                <h2>Inventory pipeline</h2>
              </div>
              <strong className="panel-stat">{listingPreview.discoveredListings}</strong>
            </div>
            <div className="compact-bars">
              <HorizontalBar label="Current-site discovered" value={listingPreview.discoveredListings} total={acquisitionTarget} tone="green" />
              <HorizontalBar label="Parsed preview" value={listingPreview.parsedRecords} total={listingPreview.requestedRecords} tone="blue" />
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

          <article className="dashboard-panel">
            <p className="eyebrow">Lead funnel</p>
            <h2>Demand</h2>
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

          <article className="dashboard-panel">
            <p className="eyebrow">Advertising</p>
            <h2>Monetization</h2>
            <div className="metric-chip-grid">
              {dashboardMetrics.monetization.map((item) => (
                <span className={`metric-chip ${item.tone}`} key={item.label}>
                  <strong>{item.value}</strong>
                  {item.label}
                </span>
              ))}
            </div>
          </article>

          <article className="dashboard-panel listing-preview-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Real listing preview</p>
                <h2>{listingPreview.parsedRecords} parsed records</h2>
              </div>
              <Link className="button secondary" href="/api/v1/admin/dashboard-metrics">Metrics</Link>
            </div>
            <ListingPreviewTable records={listingPreview.records.slice(0, 8)} />
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

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Backend engine depth</p>
            <h2>Routes and tables by product pillar.</h2>
          </div>
        </div>
        <article className="chart-panel chart-panel-full">
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

function ListingPreviewTable({ records }: { records: ImportRecordInput[] }) {
  return (
    <div className="listing-preview-table">
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Market</th>
            <th>Category</th>
            <th>Images</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.sourceRecordId ?? record.sourceUrl ?? record.name}>
              <td>
                <strong>{record.name}</strong>
                <span>{record.phone || record.websiteUrl || "contact pending"}</span>
              </td>
              <td>{displayRecordMarket(record)}</td>
              <td>{record.categories?.[0] ?? "Senior services"}</td>
              <td>{record.imageAssets?.length ?? 0}</td>
              <td>
                {record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noreferrer">Open</a> : "saved"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function displayRecordMarket(record: ImportRecordInput) {
  if (record.city && record.state && /^[A-Z]{2}$/.test(record.state)) return `${record.city}, ${record.state}`;
  if (record.city || record.state) return "location review";
  return "pending";
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
