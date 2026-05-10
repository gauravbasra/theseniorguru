import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="hero">
        <p className="eyebrow">The Senior Guru</p>
        <h1>Find trusted senior care, services, events, and local help without referral pressure.</h1>
        <p className="lede">
          Free listings. Free direct contact. A community-first platform for seniors, families, and providers.
        </p>
        <div className="actions">
          <Link href="/api/v1/providers">View provider API</Link>
          <Link href="/discover">Explore directory</Link>
        </div>
      </section>
    </main>
  );
}

