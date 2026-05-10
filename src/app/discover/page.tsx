import { listProviders } from "@/lib/providers";

export default function DiscoverPage() {
  const providers = listProviders();

  return (
    <main className="discover-shell">
      <section className="discover-header">
        <p className="eyebrow">Senior services directory</p>
        <h1>Search every local option, not just paid referral partners.</h1>
      </section>
      <section className="provider-list">
        {providers.map((provider) => (
          <article key={provider.id} className="provider-card">
            <p className="status">{provider.status.replaceAll("_", " ")}</p>
            <h2>{provider.name}</h2>
            <p>
              {provider.city}, {provider.state}
            </p>
            <p>{provider.categories.join(" • ")}</p>
            <small>
              Source: {provider.source.name} · Confidence {Math.round(provider.source.confidence * 100)}%
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}

