import Image from "next/image";
import { ProductVisual } from "@/components/product-visual";
import { listProviders } from "@/lib/providers";
import { getAdPlacement } from "@/lib/ads/ads";
import { visualAssets } from "@/lib/visual-assets";

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
      <section className="discover-visual-band">
        <ProductVisual
          asset={visualAssets.localSearchMap}
          priority
        />
      </section>
      <section className="provider-list">
        {providers.map((provider) => (
          <article key={provider.id} className="provider-card">
            {provider.imageUrl ? (
              <Image src={provider.imageUrl} alt={provider.name} width={360} height={240} />
            ) : null}
            <div>
              <p className="status">{provider.status.replaceAll("_", " ")}</p>
              <h2>{provider.name}</h2>
              <p>{provider.address ? `${provider.address}, ` : ""}{provider.city}, {provider.state}</p>
              {provider.priceLabel ? <strong className="price-label">{provider.priceLabel}</strong> : null}
              <p>{provider.categories.join(" • ")}</p>
              {provider.summary ? <p>{provider.summary}</p> : null}
              <small>
                Source: {provider.source.name} · Confidence {Math.round(provider.confidenceScore * 100)}%
              </small>
            </div>
            <div className="card-actions">
              <a href={provider.websiteUrl}>Website</a>
              <a href={`/providers/${provider.slug}`}>Profile</a>
              {provider.phone ? <a href={`tel:${provider.phone}`}>Call</a> : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
