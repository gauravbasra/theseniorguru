import Link from "next/link";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { LaunchChecklistPanel } from "@/components/launch-checklist-panel";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getProductMap } from "@/lib/system/product-map";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [product, launchChecklist] = await Promise.all([getProductMap(), getLaunchChecklist()]);
  const readinessGroups = Object.entries(product.readiness.groups);

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
          ["Imported listings", product.launchTargets.importedListings],
          ["Enriched listings", product.launchTargets.enrichedListings],
          ["Claimed listings", product.launchTargets.claimedListings],
          ["Paid beta providers", product.launchTargets.paidBetaProviders]
        ].map(([label, value]) => (
          <article className="profile-card" key={label}>
            <p className="eyebrow">{label}</p>
            <h2>{value}</h2>
          </article>
        ))}
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
