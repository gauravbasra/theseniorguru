import Link from "next/link";
import { getAppFeed } from "@/lib/community/feed";

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
            <Link className="button primary" href="/discover">Explore local options</Link>
            <Link className="button secondary" href="/api/v1/app/feed">View app feed API</Link>
          </div>
        </div>
        <aside className="phone-panel" aria-label="Mobile app preview">
          <div className="phone-top">
            <span>Today near you</span>
            <strong>Denver</strong>
          </div>
          <div className="feed-stack">
            {feed.slice(0, 3).map((item) => (
              <article className="feed-card" key={item.id}>
                <span className="feed-type">{item.type.replaceAll("_", " ")}</span>
                <h2>{item.title}</h2>
                {item.subtitle ? <p>{item.subtitle}</p> : null}
                <small>{item.city}, {item.state}</small>
              </article>
            ))}
          </div>
        </aside>
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
