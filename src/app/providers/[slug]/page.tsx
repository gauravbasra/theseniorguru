import Link from "next/link";
import { notFound } from "next/navigation";
import { ProviderInquiryForm } from "@/components/provider-inquiry-form";
import { getProviderProfile } from "@/lib/profile/provider-profile";

export default async function ProviderProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getProviderProfile(slug);

  if (!profile) {
    notFound();
  }

  const { provider, events, reviews, placement, trustSignals } = profile;

  return (
    <main className="profile-shell">
      <section className="profile-hero">
        <div>
          <p className="eyebrow">{provider.categories.join(" • ")}</p>
          <h1>{provider.name}</h1>
          <p className="lede">
            {provider.city}, {provider.state} senior care listing with direct inquiries, reviews, events, pricing
            context, and source transparency for families comparing local options.
          </p>
          <div className="actions">
            {provider.phone ? <a className="button primary" href={`tel:${provider.phone}`}>Call provider</a> : null}
            {provider.websiteUrl ? <a className="button secondary" href={provider.websiteUrl}>Visit website</a> : null}
            <Link className="button secondary" href="/discover">Compare nearby options</Link>
          </div>
        </div>
        <aside className="claim-panel">
          <p className="eyebrow">Free listing</p>
          <h2>Claim this profile</h2>
          <p>Verify business ownership to update services, add events, manage reviews, and unlock growth campaigns.</p>
          <Link className="button primary" href="/operators/free-listing">Claim free listing</Link>
        </aside>
      </section>

      <section className="profile-conversion">
        <ProviderInquiryForm providerId={provider.id} providerName={provider.name} />
        <article className="profile-card">
          <p className="eyebrow">What families compare</p>
          <h2>Care level, availability, amenities, pricing, reviews, and location.</h2>
          <p>
            TheSeniorGuru listing template is built for the actual senior care decision journey: understand the fit,
            ask questions, save options, and schedule next steps with the community.
          </p>
          <div className="trust-band inline">
            {["Direct inquiry", "Reviews", "Events", "Source confidence"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="profile-grid">
        <article className="profile-card">
          <p className="eyebrow">Trust signals</p>
          <div className="signal-list">
            {trustSignals.map((signal) => (
              <div key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="profile-card">
          <p className="eyebrow">Source provenance</p>
          <h2>{provider.source.name}</h2>
          <p>Fetched {new Date(provider.source.fetchedAt).toLocaleDateString()} with {Math.round(provider.source.confidence * 100)}% source confidence.</p>
          {provider.source.url ? <a href={provider.source.url}>View source</a> : null}
        </article>

        <article className="profile-card">
          <p className="eyebrow">Reviews</p>
          <h2>{reviews.length ? `${reviews.length} published reviews` : "Reviews are being collected"}</h2>
          <p>First-party reviews enter moderation before publishing, and provider responses pass policy checks.</p>
          <Link href="/operators">Reputation tools for providers</Link>
        </article>

        <article className="profile-card">
          <p className="eyebrow">Events</p>
          <h2>{events.length ? `${events.length} upcoming events` : "No upcoming events yet"}</h2>
          <p>Providers can publish education sessions, open houses, support groups, and local resource events.</p>
          <Link href="/operators">Promote local events</Link>
        </article>
      </section>

      <section className="profile-sponsored">
        <span>{placement.disclosureLabel}</span>
        <strong>Sponsored placements are separated from organic trust signals.</strong>
        <p>This placement is registered through the ad engine and can track impressions/clicks without hiding paid intent.</p>
      </section>
    </main>
  );
}
