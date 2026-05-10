import { listProviders } from "@/lib/providers";
import { getAdPlacement } from "@/lib/ads/ads";

export default async function DiscoverPage() {
  const [providers, topPlacement] = await Promise.all([listProviders(), getAdPlacement("web.discover.top")]);

  return (
    <main className="discover-shell">
      <section className="discover-header">
        <p className="eyebrow">Senior services directory</p>
        <h1>Search every local option, not just paid referral partners.</h1>
        <div className="search-panel">
          <span>Assisted living, memory care, home care</span>
          <span>Denver, CO</span>
          <button>Search</button>
        </div>
      </section>
      <section className="ad-slot">
        <span>{topPlacement.disclosureLabel}</span>
        <strong>Local providers can feature events and services here without hiding organic results.</strong>
      </section>
      <section className="provider-list">
        {providers.map((provider) => (
          <article key={provider.id} className="provider-card">
            <div>
              <p className="status">{provider.status.replaceAll("_", " ")}</p>
              <h2>{provider.name}</h2>
              <p>{provider.city}, {provider.state}</p>
              <p>{provider.categories.join(" • ")}</p>
              <small>
                Source: {provider.source.name} · Confidence {Math.round(provider.confidenceScore * 100)}%
              </small>
            </div>
            <div className="card-actions">
              <a href={provider.websiteUrl}>Website</a>
              <a href={`/providers/${provider.slug}`}>Profile</a>
              <a href={`/api/v1/providers/${provider.id}`}>API</a>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
