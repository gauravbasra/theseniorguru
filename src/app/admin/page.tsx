import Link from "next/link";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { getProductMap } from "@/lib/system/product-map";

export default async function AdminPage() {
  const product = await getProductMap();
  const readinessGroups = Object.entries(product.readiness.groups);

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Platform command center</p>
          <h1>Build and operate The Senior Guru from the FRD, not from random screens.</h1>
          <p className="lede">{product.thesis}</p>
          <div className="actions">
            <Link className="button primary" href="/api/v1/system/product-map">Product map API</Link>
            <Link className="button secondary" href="/api/v1/system/link-health">Link health</Link>
            <Link className="button secondary" href="/api/v1/openapi">OpenAPI</Link>
            <form action="/api/v1/auth/logout" method="post">
              <button className="button secondary" type="submit">Sign out</button>
            </form>
          </div>
        </div>
        <aside className="admin-status-card">
          <p className="eyebrow">Launch health</p>
          <h2>{product.operationalSummary.readinessStatus.replaceAll("_", " ")}</h2>
          <p>
            Links: {product.linkHealth.status} · Data sources: {product.operationalSummary.dataSources} · Import
            batches: {product.operationalSummary.importBatches}
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
        <div className="section-heading">
          <div>
            <p className="eyebrow">Executable operations</p>
            <h2>Run launch workflows against backend routes, including the new lead intake queue.</h2>
          </div>
        </div>
        <AdminOperationsConsole />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRD product pillars</p>
            <h2>Every website surface must map to one of these backend workflows.</h2>
          </div>
        </div>
        <div className="pillar-grid">
          {product.pillars.map((pillar) => (
            <article className="pillar-card" key={pillar.key}>
              <div>
                <span className={`status-pill ${pillar.status}`}>{pillar.status}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.objective}</p>
                <small>{pillar.audience}</small>
              </div>
              <div>
                <strong>Backend routes</strong>
                <ul>
                  {pillar.backendRoutes.slice(0, 6).map((route) => (
                    <li key={route}>{route}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Next backend work</strong>
                <ul>
                  {pillar.nextBackendWork.map((item) => (
                    <li key={item}>{item}</li>
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
          <h2>Owner-dependent work stays visible while backend development continues.</h2>
        </div>
        <div className="readiness-grid">
          {readinessGroups.map(([name, group]) => (
            <article className="profile-card" key={name}>
              <p className="eyebrow">{name.replaceAll(/([A-Z])/g, " $1")}</p>
              <h3>{group.status.replaceAll("_", " ")}</h3>
              <ul>
                {group.checks.map((check) => (
                  <li key={check.key}>
                    <strong>{check.label}</strong>
                    <span>{check.status}</span>
                    {check.action ? <small>{check.action}</small> : null}
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
