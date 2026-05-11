import Link from "next/link";
import { FreeListingForm } from "@/components/free-listing-form";
import { OperatorDemoForm } from "@/components/operator-demo-form";
import { ProductVisual } from "@/components/product-visual";
import { getProviderDashboard } from "@/lib/provider-dashboard/dashboard";

export default async function OperatorsPage() {
  const dashboard = await getProviderDashboard();

  return (
    <main className="audience-shell">
      <section className="audience-hero operators-hero">
        <div>
          <p className="eyebrow">Senior living occupancy growth</p>
          <h1>Fill the inquiry gaps that cost communities occupancy.</h1>
          <p className="lede">
            TheSeniorGuru gives operators a free discovery listing first, then shows missed-opportunity metrics and
            offers AI engagement tools that help convert family interest into tours.
          </p>
          <div className="actions">
            <Link className="button primary" href="/operators/free-listing">Claim free listing</Link>
            <Link className="button secondary" href="/operators/ai-occupancy-platform">See AI occupancy platform</Link>
          </div>
        </div>
        <ProductVisual
          className="audience-visual"
          src="/assets/seniorguru/operator-occupancy-response.svg"
          alt="Senior living operator occupancy response board with missed calls, new inquiries, and tour opportunity analytics"
          eyebrow="Occupancy response"
          title="Show the missed opportunity, then route the next action."
          copy="Free listings feed inquiry analytics before operators upgrade into chat, voice, tours, reviews, and campaigns."
          priority
        />
      </section>

      <section className="principle-strip">
        {[
          "Free public listing and direct inquiry capture",
          "Inquiry analytics before upsell pressure",
          "AI engagement trial for missed opportunities",
          "Reviews, SEO, events, and campaign automation"
        ].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="operator-funnel">
        {[
          ["1", "Free listing", "Get indexed in local senior care search and receive family inquiries."],
          ["2", "Inquiry analytics", "See response speed, missed calls, contact sources, and tour opportunities."],
          ["3", "AI engagement trial", "Add chat, voice, scheduling, review generation, and follow-up workflows."],
          ["4", "Recurring growth", "Turn the listing into a senior living occupancy growth engine."]
        ].map(([step, title, copy]) => (
          <article key={title}>
            <span>{step}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
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

      <section className="operator-band">
        <div>
          <p className="eyebrow">Free listing onboarding</p>
          <h2>Start with visibility. Upgrade only when growth tools make sense.</h2>
          <p>
            Free listings include public profile pages, inquiry forms, review visibility, SEO indexing, local discovery,
            lead capture, and basic analytics.
          </p>
        </div>
        <FreeListingForm />
      </section>

      <section className="split-cta">
        <div>
          <p className="eyebrow">AI engagement upsell</p>
          <h2>Show the missed opportunities, then solve them.</h2>
          <p>
            The paid path is not generic software. It is a senior living engagement layer for faster family response,
            stronger reputation, better local SEO, and more scheduled tours.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/operators/reputation">Review tools</Link>
            <Link className="button secondary" href="/provider">Provider console</Link>
          </div>
        </div>
        <OperatorDemoForm compact requestedProduct="full_platform" />
      </section>
    </main>
  );
}
