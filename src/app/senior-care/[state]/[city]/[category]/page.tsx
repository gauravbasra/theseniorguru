import Link from "next/link";
import { getLocalSeoPage } from "@/lib/seo/local-pages";

export default async function LocalSeoPage({
  params
}: {
  params: Promise<{ state: string; city: string; category: string }>;
}) {
  const { state, city, category } = await params;
  const page = await getLocalSeoPage(state, city, category);

  return (
    <main className="local-page-shell">
      <section className="local-hero">
        <p className="eyebrow">Transparent local guide</p>
        <h1>{page.categoryName} in {page.cityName}, {page.stateCode}</h1>
        <p className="lede">
          Compare local options with free direct contact, source transparency, events, reviews, and clearly labeled sponsored placements.
        </p>
      </section>

      <section className="profile-sponsored">
        <span>{page.placement.disclosureLabel}</span>
        <strong>Sponsored placements are available, but organic listings remain visible.</strong>
      </section>

      <section className="local-content-grid">
        <div className="local-list">
          <p className="eyebrow">Listings</p>
          {page.providers.map((provider) => (
            <article className="provider-card" key={provider.id}>
              <div>
                <p className="status">{provider.status.replaceAll("_", " ")}</p>
                <h2>{provider.name}</h2>
                <p>{provider.city}, {provider.state} · {provider.categories.join(" • ")}</p>
                <small>Source confidence {Math.round(provider.confidenceScore * 100)}%</small>
              </div>
              <div className="card-actions">
                <Link href={`/providers/${provider.slug}`}>Profile</Link>
              </div>
            </article>
          ))}
        </div>
        <aside className="local-sidebar">
          <article className="profile-card">
            <p className="eyebrow">Local events</p>
            <h2>{page.events.length ? `${page.events.length} nearby events` : "Events coming soon"}</h2>
            <p>Provider events help families learn before they choose.</p>
          </article>
          <article className="profile-card">
            <p className="eyebrow">Questions families ask</p>
            {page.faq.map((item) => (
              <div className="faq-item" key={item.question}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
            ))}
          </article>
        </aside>
      </section>
    </main>
  );
}

