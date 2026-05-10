import Link from "next/link";
import { FreeListingForm } from "@/components/free-listing-form";

const benefits = [
  "Public community profile page",
  "Community photos and amenities",
  "Inquiry forms and direct family contact",
  "Reviews and reputation visibility",
  "SEO indexing and Google discovery optimization",
  "Lead capture dashboard and basic analytics"
];

export default function FreeListingPage() {
  return (
    <main className="audience-shell">
      <section className="audience-hero operators-hero">
        <div>
          <p className="eyebrow">Free community listings</p>
          <h1>Be discoverable where families are searching for senior care.</h1>
          <p className="lede">
            Claim or add your community for free. TheSeniorGuru uses listings as the operator acquisition path, not a
            referral-fee wall between families and communities.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/operators/ai-occupancy-platform">See growth upgrades</Link>
            <Link className="button secondary" href="/discover">View directory</Link>
          </div>
        </div>
        <div className="audience-panel">
          {benefits.map((benefit) => (
            <div key={benefit}>
              <span>✓</span>
              <strong>{benefit}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">Verification flow</p>
          <h2>Free listing requests become verified community profiles.</h2>
          <p>
            We capture the community details, policy-check the submission, queue verification, and prepare the listing
            for profile enrichment, family inquiries, reviews, events, and growth tools.
          </p>
        </div>
        <FreeListingForm />
      </section>
    </main>
  );
}
