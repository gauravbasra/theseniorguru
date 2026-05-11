import Link from "next/link";
import type { CSSProperties } from "react";
import { AcquisitionPipelineConsole } from "@/components/acquisition-pipeline-console";
import { AdRevenueConsole } from "@/components/ad-revenue-console";
import { ClaimVerificationConsole } from "@/components/claim-verification-console";
import { EventsCommunityConsole } from "@/components/events-community-console";
import { NewsroomConsole } from "@/components/newsroom-console";
import { OpenApiConsole } from "@/components/open-api-console";
import { ReviewReputationConsole } from "@/components/review-reputation-console";
import { SourceGovernanceConsole } from "@/components/source-governance-console";
import { SupabaseReadinessConsole } from "@/components/supabase-readiness-console";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { listCrawlJobs } from "@/lib/aggregation/crawl-jobs";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard-metrics";
import { listAdPlacements } from "@/lib/ads/ads";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import { listCommunityPosts } from "@/lib/community/feed";
import { listExpertProfiles } from "@/lib/community/experts";
import { listCommunityGroups } from "@/lib/community/groups";
import { listDataSources } from "@/lib/data-sources";
import type { ProviderClaimRecord } from "@/lib/domain/claims";
import type { ImportRecordInput } from "@/lib/domain/imports";
import type { LeadQueueSummary } from "@/lib/domain/leads";
import { listEvents } from "@/lib/events/events";
import { listImportBatches } from "@/lib/import-batches";
import { listLeadQueue } from "@/lib/leads";
import { listNewsItems } from "@/lib/newsroom/newsroom";
import { listApiAuditEvents, listApiClients, listWebhookDeliveries, listWebhookSubscriptions } from "@/lib/openapi/platform";
import { listProviders } from "@/lib/providers";
import { listReviewModerationQueue } from "@/lib/reviews/reviews";
import { listScheduledWorkerRuns } from "@/lib/scheduler/runs";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getSupabaseLaunchReadiness } from "@/lib/system/supabase-launch-readiness";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [
    launchChecklist,
    dashboardMetrics,
    listingPreview,
    leadQueue,
    claims,
    importBatches,
    newsroomItems,
    adPlacements,
    reviewQueue,
    dataSources,
    scheduledRuns,
    crawlJobs,
    providers,
    supabaseReadiness,
    apiClients,
    webhookSubscriptions,
    webhookDeliveries,
    apiAuditEvents,
    events,
    communityGroups,
    expertProfiles,
    communityPosts
  ] = await Promise.all([
    getLaunchChecklist(),
    getAdminDashboardMetrics(),
    previewCurrentSiteRealListings({ maxRecords: 12 }),
    listLeadQueue(),
    listProviderClaims(),
    listImportBatches(),
    listNewsItems(),
    listAdPlacements(),
    listReviewModerationQueue({ status: "pending_moderation" }),
    listDataSources(),
    listScheduledWorkerRuns({ limit: 20 }),
    listCrawlJobs(),
    listProviders(),
    getSupabaseLaunchReadiness(),
    listApiClients(),
    listWebhookSubscriptions(),
    listWebhookDeliveries(),
    listApiAuditEvents(),
    listEvents(),
    listCommunityGroups(),
    listExpertProfiles({ status: "verified" }),
    listCommunityPosts()
  ]);
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

          <article className="dashboard-panel source-quality-panel">
            <div className="panel-title-row">
              <div>
                <p className="eyebrow">Acquisition quality</p>
                <h2>Source coverage</h2>
              </div>
              <strong className="panel-stat">
                {percentOf(listingPreview.sourceCoverage.productionGradeRecords, listingPreview.sourceCoverage.totalRecords)}%
              </strong>
            </div>
            <div className="compact-bars">
              <HorizontalBar
                label="Source URLs"
                value={listingPreview.sourceCoverage.withSourceUrl}
                total={listingPreview.sourceCoverage.totalRecords}
                tone="green"
              />
              <HorizontalBar
                label="Record IDs"
                value={listingPreview.sourceCoverage.withSourceRecordId}
                total={listingPreview.sourceCoverage.totalRecords}
                tone="blue"
              />
              <HorizontalBar
                label="Terms reviewed"
                value={listingPreview.sourceCoverage.withLicenseTermsStatus}
                total={listingPreview.sourceCoverage.totalRecords}
                tone="gold"
              />
              <HorizontalBar
                label="3+ images"
                value={listingPreview.sourceCoverage.imageReadyRecords}
                total={listingPreview.sourceCoverage.totalRecords}
                tone="rose"
              />
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live operations</p>
            <h2>Work queues</h2>
          </div>
        </div>
        <div className="admin-live-grid">
          <LeadQueuePanel queue={leadQueue} />
          <ClaimQueuePanel claims={claims} />
          <ImportQueuePanel batches={importBatches} listingPreview={listingPreview} />
          <NewsroomQueuePanel items={newsroomItems} />
          <ReviewQueuePanel reviews={reviewQueue} />
          <AdPlacementPanel placements={adPlacements} />
        </div>
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Supabase production readiness</p>
            <h2>Track persistent backend storage and migration coverage</h2>
          </div>
        </div>
        <SupabaseReadinessConsole initialReadiness={supabaseReadiness} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Governed automation</p>
            <h2>Source approvals and scheduled workers</h2>
          </div>
        </div>
        <SourceGovernanceConsole initialSources={dataSources} initialRuns={scheduledRuns} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acquisition execution</p>
            <h2>Run approved inventory jobs</h2>
          </div>
        </div>
        <AcquisitionPipelineConsole
          initialSources={dataSources}
          initialBatches={importBatches}
          initialCrawlJobs={crawlJobs}
        />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Claim verification</p>
            <h2>Move operators from claim to approved profile</h2>
          </div>
        </div>
        <ClaimVerificationConsole initialClaims={claims} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Authority engine</p>
            <h2>Run newsroom publishing and repurposing</h2>
          </div>
        </div>
        <NewsroomConsole />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reputation revenue</p>
            <h2>Operate reviews, responses, and request campaigns</h2>
          </div>
        </div>
        <ReviewReputationConsole initialProviders={providers} initialReviews={reviewQueue} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Advertising revenue</p>
            <h2>Operate sponsored placements and ad reporting</h2>
          </div>
        </div>
        <AdRevenueConsole initialPlacements={adPlacements} initialProviders={providers} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Events and community</p>
            <h2>Run provider events, local groups, expert trust, and moderation</h2>
          </div>
        </div>
        <EventsCommunityConsole
          initialEvents={events}
          initialGroups={communityGroups}
          initialExperts={expertProfiles}
          initialPosts={communityPosts}
        />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Open API operations</p>
            <h2>Manage partner access, keys, webhooks, and audits</h2>
          </div>
        </div>
        <OpenApiConsole
          initialClients={apiClients}
          initialSubscriptions={webhookSubscriptions}
          initialDeliveries={webhookDeliveries}
          initialAuditEvents={apiAuditEvents}
        />
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
    </main>
  );
}

function LeadQueuePanel({ queue }: { queue: LeadQueueSummary }) {
  return (
    <article className="admin-live-panel admin-live-panel-wide">
      <PanelHeader eyebrow="Lead inbox" title={`${queue.total} open`} meta={queue.source.replace("_", " ")} />
      <div className="queue-stat-row">
        <QueueStat label="Families" value={queue.byType.family_inquiry} />
        <QueueStat label="Free listings" value={queue.byType.free_listing} />
        <QueueStat label="Demos" value={queue.byType.operator_demo} />
      </div>
      <QueueTable
        emptyLabel="No inbound leads yet"
        rows={queue.items.slice(0, 5).map((item) => ({
          key: item.id,
          primary: item.displayName,
          secondary: item.sourceLabel,
          status: item.status,
          href: "/api/v1/admin/leads"
        }))}
      />
    </article>
  );
}

function ClaimQueuePanel({ claims }: { claims: ProviderClaimRecord[] }) {
  const openClaims = claims.filter((claim) => !["approved", "rejected"].includes(claim.status));

  return (
    <article className="admin-live-panel">
      <PanelHeader eyebrow="Claims" title={`${openClaims.length} pending`} meta={`${claims.length} total`} />
      <QueueTable
        emptyLabel="No provider claims pending"
        rows={openClaims.slice(0, 5).map((claim) => ({
          key: claim.id,
          primary: claim.claimantName,
          secondary: claim.businessDomain ?? claim.claimantEmail,
          status: claim.status,
          href: `/api/v1/admin/provider-claims/${claim.id}/verification-attempts`
        }))}
      />
    </article>
  );
}

function ImportQueuePanel({
  batches,
  listingPreview
}: {
  batches: Awaited<ReturnType<typeof listImportBatches>>;
  listingPreview: Awaited<ReturnType<typeof previewCurrentSiteRealListings>>;
}) {
  const rows = batches.length
    ? batches.slice(0, 5).map((batch) => ({
        key: batch.id,
        primary: batch.name,
        secondary: `${batch.importedRecords}/${batch.totalRecords} staged`,
        status: batch.status,
        href: `/api/v1/admin/import-batches/${batch.id}/run`
      }))
    : [{
        key: "current-site-preview",
        primary: "Current TheSeniorGuru public listings",
        secondary: `${listingPreview.parsedRecords}/${listingPreview.discoveredListings} parsed for staging`,
        status: listingPreview.sourcePolicies[0]?.robotsDecision ?? "review",
        href: "/api/v1/admin/public-source-acquisition/current-site-preview?maxRecords=50"
      }];

  return (
    <article className="admin-live-panel">
      <PanelHeader
        eyebrow="Inventory"
        title={batches.length ? `${batches.length} batches` : `${listingPreview.discoveredListings} discovered`}
        meta="real source"
      />
      <QueueTable
        emptyLabel="No import batches yet"
        rows={rows}
      />
    </article>
  );
}

function NewsroomQueuePanel({ items }: { items: Awaited<ReturnType<typeof listNewsItems>> }) {
  return (
    <article className="admin-live-panel">
      <PanelHeader eyebrow="Newsroom" title={`${items.length} source items`} meta="editorial" />
      <QueueTable
        emptyLabel="No newsroom items queued"
        rows={items.slice(0, 5).map((item) => ({
          key: item.id,
          primary: item.title,
          secondary: item.sourceName ?? item.sourceUrl ?? "source saved",
          status: item.status,
          href: "/api/v1/admin/newsroom/inbox"
        }))}
      />
    </article>
  );
}

function ReviewQueuePanel({ reviews }: { reviews: Awaited<ReturnType<typeof listReviewModerationQueue>> }) {
  return (
    <article className="admin-live-panel">
      <PanelHeader eyebrow="Reviews" title={`${reviews.length} pending`} meta="moderation" />
      <QueueTable
        emptyLabel="No reviews waiting"
        rows={reviews.slice(0, 5).map((review) => ({
          key: review.id,
          primary: review.title ?? `${review.rating}-star review`,
          secondary: review.reviewerName,
          status: review.status,
          href: `/api/v1/admin/reviews/${review.id}/moderate`
        }))}
      />
    </article>
  );
}

function AdPlacementPanel({ placements }: { placements: Awaited<ReturnType<typeof listAdPlacements>> }) {
  return (
    <article className="admin-live-panel">
      <PanelHeader eyebrow="Ad inventory" title={`${placements.length} placements`} meta="revenue" />
      <QueueTable
        emptyLabel="No ad placements configured"
        rows={placements.slice(0, 5).map((placement) => ({
          key: placement.placementKey,
          primary: placement.name,
          secondary: placement.surface,
          status: placement.isActive ? "active" : "paused",
          href: "/api/v1/admin/ads/placements"
        }))}
      />
    </article>
  );
}

function PanelHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return (
    <div className="panel-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span className="queue-meta">{meta}</span>
    </div>
  );
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong>{value}</strong>
      {label}
    </span>
  );
}

function QueueTable({
  rows,
  emptyLabel
}: {
  rows: Array<{ key: string; primary: string; secondary: string; status: string; href: string }>;
  emptyLabel: string;
}) {
  if (!rows.length) {
    return <p className="queue-empty">{emptyLabel}</p>;
  }

  return (
    <div className="queue-table">
      {rows.map((row) => (
        <a href={row.href} key={row.key}>
          <span>
            <strong>{row.primary}</strong>
            <small>{row.secondary}</small>
          </span>
          <b>{row.status.replaceAll("_", " ")}</b>
        </a>
      ))}
    </div>
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
