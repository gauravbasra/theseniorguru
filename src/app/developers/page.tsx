import Link from "next/link";
import { getPartnerDeveloperDocs } from "@/lib/openapi/developer-docs";

export const metadata = {
  title: "Partner Developer Docs | The Senior Guru",
  description: "Partner API authentication, endpoints, webhook signing, usage analytics, and operational controls for The Senior Guru integrations."
};

export default function DevelopersPage() {
  const docs = getPartnerDeveloperDocs();

  return (
    <main className="audience-shell">
      <section className="audience-hero">
        <div>
          <p className="eyebrow">Partner developer platform</p>
          <h1>Build approved senior-care integrations with audited APIs and signed webhooks.</h1>
          <p className="lede">
            Use scoped API keys to read provider inventory, events, usage evidence, and webhook verification contracts.
            Every partner request is rate-limited, scoped, and auditable from the Open API operations console.
          </p>
          <div className="actions">
            <Link className="button primary" href="/api/v1/partner/developer-docs">View docs JSON</Link>
            <Link className="button secondary" href="/api/v1/openapi">OpenAPI catalog</Link>
          </div>
        </div>
        <article className="profile-card dashboard-primary">
          <p className="eyebrow">Base URL</p>
          <h2>{docs.baseUrl}</h2>
          <p>Authenticate with `{docs.authentication.header}` using a scoped sandbox or approved partner key.</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="profile-card">
          <p className="eyebrow">Authentication</p>
          <h2>{docs.authentication.type}</h2>
          <p>{docs.authentication.requiredScopes.join(", ")}</p>
        </article>
        <article className="profile-card">
          <p className="eyebrow">Webhook signing</p>
          <h2>{docs.webhooks.algorithm}</h2>
          <p>{docs.webhooks.signatureHeader} signs {docs.webhooks.signedContent} with {docs.webhooks.toleranceSeconds}s tolerance.</p>
        </article>
        <article className="profile-card">
          <p className="eyebrow">Events</p>
          <h2>{docs.webhooks.supportedEvents.length}</h2>
          <p>{docs.webhooks.supportedEvents.slice(0, 4).join(", ")}</p>
        </article>
      </section>

      <section className="operator-funnel">
        {docs.endpoints.map((endpoint) => (
          <article key={`${endpoint.method}-${endpoint.path}`}>
            <span>{endpoint.method}</span>
            <h2>{endpoint.path}</h2>
            <p>{endpoint.summary}</p>
          </article>
        ))}
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">Webhook verification contract</p>
          <h2>Verify the raw body before parsing JSON.</h2>
          <p>{docs.webhooks.verificationSteps.join(" ")}</p>
        </div>
        <article className="profile-card">
          <p className="eyebrow">Sample signature</p>
          <h2>{docs.webhooks.sampleSignature.slice(0, 24)}...</h2>
          <p>{docs.webhooks.sampleRawBody}</p>
        </article>
      </section>

      <section className="category-strip">
        <div>
          <p className="eyebrow">Operations controls</p>
          <h2>Partner access stays governed after launch.</h2>
        </div>
        <div className="category-grid">
          {docs.operationalControls.map((control) => (
            <span key={control}>
              <strong>{control}</strong>
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
