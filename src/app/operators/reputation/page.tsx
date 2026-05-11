import Link from "next/link";
import { OperatorDemoForm } from "@/components/operator-demo-form";
import { ProductVisual } from "@/components/product-visual";

const reputationFlow = [
  "Request reviews from families and residents with consent",
  "Route responses through policy checks before publishing",
  "Monitor sentiment and common themes",
  "Improve local trust signals on community profiles",
  "Pair review growth with SEO, social, and follow-up campaigns"
];

export default function ReputationPage() {
  return (
    <main className="audience-shell">
      <section className="audience-hero operators-hero">
        <div>
          <p className="eyebrow">Reviews and reputation</p>
          <h1>Earn more trust before families schedule a tour.</h1>
          <p className="lede">
            Reputation is part of occupancy. TheSeniorGuru helps communities collect first-party reviews, respond with
            care, and strengthen the trust signals families use when comparing options.
          </p>
          <div className="actions">
            <Link className="button primary" href="/operators/free-listing">Claim free listing</Link>
            <Link className="button secondary" href="/operators/ai-occupancy-platform">AI engagement platform</Link>
          </div>
        </div>
        <ProductVisual
          className="audience-visual"
          src="/assets/seniorguru/reputation-local-search.svg"
          alt="Local senior care search listing with review sentiment, sponsored disclosure, organic trust signals, and reputation workflow"
          eyebrow="Trust signals"
          title="Reviews become search confidence."
          copy="Reputation work connects review requests, moderation, sentiment, and profile trust signals families can understand."
          priority
        />
      </section>

      <section className="principle-strip">
        {reputationFlow.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="split-cta">
        <div>
          <p className="eyebrow">Paid reputation add-on</p>
          <h2>Turn review growth into a measurable occupancy asset.</h2>
          <p>
            Review request campaigns, response workflows, moderation, and sentiment reporting connect back to the
            community listing and broader AI marketing engine.
          </p>
        </div>
        <OperatorDemoForm compact requestedProduct="reputation" />
      </section>
    </main>
  );
}
