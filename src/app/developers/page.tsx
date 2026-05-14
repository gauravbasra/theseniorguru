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

      <section className="operator-funnel">
        {docs.sdkExamples.map((example) => (
          <article key={example.language}>
            <span>{example.language}</span>
            <h2>{example.title}</h2>
            <pre className="code-sample"><code>{example.code}</code></pre>
          </article>
        ))}
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">Sandbox onboarding</p>
          <h2>{docs.sandboxOnboarding.title}</h2>
          <p>{docs.sandboxOnboarding.objective}</p>
        </div>
        <article className="profile-card">
          <p className="eyebrow">Minimum scopes</p>
          <h2>{docs.sandboxOnboarding.minimumScopes.length}</h2>
          <p>{docs.sandboxOnboarding.minimumScopes.join(", ")}</p>
        </article>
      </section>

      <section className="operator-funnel">
        {docs.sandboxOnboarding.steps.map((step) => (
          <article key={step.key}>
            <span>{step.owner.replaceAll("_", " ")}</span>
            <h2>{step.title}</h2>
            <p><strong>{step.endpoint}</strong></p>
            <p>{step.completionSignal}</p>
            <p>{step.blocker}</p>
          </article>
        ))}
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">API changelog</p>
          <h2>Current partner API version: {docs.changelog.currentVersion}</h2>
          <p>{docs.changelog.policy.preOneDotZero}</p>
        </div>
        <article className="profile-card">
          <p className="eyebrow">Deprecation notice</p>
          <h2>{docs.changelog.policy.deprecationNoticeDays} days</h2>
          <p>{docs.changelog.policy.breakingChangeRule}</p>
        </article>
      </section>

      <section className="operator-funnel">
        {docs.changelog.entries.map((entry) => (
          <article key={entry.version}>
            <span>{entry.status}</span>
            <h2>{entry.version}</h2>
            <p>{entry.summary}</p>
            <p><strong>{entry.additions.join(" ")}</strong></p>
            <p>{entry.migrationNotes.join(" ")}</p>
          </article>
        ))}
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">SDK package plan</p>
          <h2>{docs.sdkPackagePlan.title}</h2>
          <p>{docs.sdkPackagePlan.objective}</p>
        </div>
        <article className="profile-card">
          <p className="eyebrow">Status</p>
          <h2>{docs.sdkPackagePlan.status}</h2>
          <p>{docs.sdkPackagePlan.nextActions[0]}</p>
        </article>
      </section>

      <section className="operator-funnel">
        {docs.sdkPackagePlan.packages.map((sdkPackage) => (
          <article key={sdkPackage.packageName}>
            <span>{sdkPackage.language}</span>
            <h2>{sdkPackage.packageName}</h2>
            <p><strong>{sdkPackage.publicModule}</strong></p>
            <p>{sdkPackage.responsibilities.join(" ")}</p>
            <p>{sdkPackage.releaseGate}</p>
          </article>
        ))}
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
