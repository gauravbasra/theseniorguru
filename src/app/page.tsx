import Link from "next/link";
import Image from "next/image";
import { getAppFeed } from "@/lib/community/feed";

const heroImage =
  "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1600&q=85";

export default async function HomePage() {
  const feed = await getAppFeed();

  return (
    <main className="home-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">The Senior Guru</p>
          <h1>Senior care search without referral pressure.</h1>
          <p className="lede">
            A complete senior services directory, local community feed, events marketplace, and provider growth engine
            built around transparency.
          </p>
          <div className="actions">
            <Link className="button primary" href="/seniors">For seniors</Link>
            <Link className="button secondary" href="/operators">For operators</Link>
          </div>
        </div>
        <aside className="hero-media" aria-label="Senior family support preview">
          <Image
            src={heroImage}
            alt="A senior adult walking outside with family support"
            width={900}
            height={1080}
            priority
          />
          <div className="image-caption">
            <strong>Find help with dignity.</strong>
            <span>Local care, events, reviews, and community guidance in one place.</span>
          </div>
        </aside>
      </section>

      <section className="feed-preview">
        <div>
          <p className="eyebrow">Live app feed</p>
          <h2>Care options, events, and community guidance should feel alive.</h2>
        </div>
        <div className="feed-row">
          {feed.slice(0, 3).map((item) => (
            <article className="feed-card" key={item.id}>
              <span className="feed-type">{item.type.replaceAll("_", " ")}</span>
              <h3>{item.title}</h3>
              {item.subtitle ? <p>{item.subtitle}</p> : null}
              <small>{item.city}, {item.state}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-band">
        {["Free listings", "Direct contact", "No referral fees", "Sponsored labels"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="section-grid">
        <article>
          <p className="eyebrow">For families</p>
          <h2>See every local option, not just paid partners.</h2>
          <p>Search providers, save options, discover events, ask questions, and compare services before a crisis call.</p>
        </article>
        <article>
          <p className="eyebrow">For providers</p>
          <h2>Your listing is free. Your growth engine is paid.</h2>
          <p>Claim a profile, host events, manage reviews, publish campaigns, and buy clearly labeled local placements.</p>
        </article>
        <article>
          <p className="eyebrow">For the community</p>
          <h2>A senior life network that stays useful.</h2>
          <p>Local posts, resource guides, expert answers, and event discovery make the app worth opening again.</p>
        </article>
      </section>

      <section className="api-proof">
        <div>
          <p className="eyebrow">Backend live</p>
          <h2>Every surface is API-backed from day one.</h2>
        </div>
        <div className="api-links">
          <Link href="/api/v1/providers">Providers</Link>
          <Link href="/api/v1/events">Events</Link>
          <Link href="/api/v1/ads/placements/web.discover.top">Ads</Link>
          <Link href="/api/v1/policy/check">Policy</Link>
        </div>
      </section>
    </main>
  );
}
