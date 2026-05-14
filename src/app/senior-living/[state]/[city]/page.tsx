import Link from "next/link";
import { FamilyInquiryForm } from "@/components/family-inquiry-form";
import { ProductVisual } from "@/components/product-visual";
import { listProviders } from "@/lib/providers";
import { visualAssets } from "@/lib/visual-assets";

function titleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CitySeniorLivingPage({
  params
}: {
  params: Promise<{ state: string; city: string }>;
}) {
  const { state, city } = await params;
  const stateCode = state.toUpperCase();
  const cityName = titleCase(city);
  const providers = await listProviders();
  const cityProviders = providers.filter((provider) => {
    return provider.city.toLowerCase().replaceAll(" ", "-") === city && provider.state.toLowerCase() === state;
  });
  const visibleProviders = cityProviders.length ? cityProviders : providers.slice(0, 8);

  return (
    <main className="local-page-shell">
      <section className="local-hero">
        <p className="eyebrow">Senior living in {cityName}, {stateCode}</p>
        <h1>Find senior living communities in {cityName} with confidence</h1>
        <p className="lede">
          Compare assisted living, memory care, independent living, senior apartments, and local support services near
          {` ${cityName}`}. Start with transparent listings, direct inquiries, and family-focused guidance.
        </p>
        <div className="actions">
          <Link className="button primary" href="/discover">Search communities</Link>
          <Link className="button secondary" href="/operators/free-listing">List your community free</Link>
        </div>
      </section>

      <section className="local-content-grid">
        <div className="local-list">
          <p className="eyebrow">Local community options</p>
          {visibleProviders.map((provider) => (
            <article className="provider-card" key={provider.id}>
              <div>
                <p className="status">{provider.status.replaceAll("_", " ")}</p>
                <h2>{provider.name}</h2>
                <p>{provider.city}, {provider.state} · {provider.categories.join(" • ")}</p>
                <small>Source confidence {Math.round(provider.confidenceScore * 100)}%</small>
              </div>
              <div className="card-actions">
                <Link href={`/providers/${provider.slug}`}>View community</Link>
              </div>
            </article>
          ))}
        </div>
        <aside className="local-sidebar">
          <FamilyInquiryForm compact defaultCity={cityName} defaultState={stateCode} defaultCareType="Senior Living" />
          <article className="profile-card">
            <p className="eyebrow">Popular searches</p>
            {["Assisted Living", "Memory Care", "Independent Living", "Senior Apartments"].map((careType) => (
              <Link
                className="local-search-link"
                href={`/senior-care/${state}/${city}/${careType.toLowerCase().replaceAll(" ", "-")}`}
                key={careType}
              >
                {careType} in {cityName}
              </Link>
            ))}
          </article>
          <article className="profile-card">
            <p className="eyebrow">Family checklist</p>
            <p>Compare care levels, pricing, amenities, reviews, availability, nearby hospitals, and tour timing.</p>
          </article>
          <ProductVisual
            asset={visualAssets.trustSafetyVerification}
          />
        </aside>
      </section>
    </main>
  );
}
