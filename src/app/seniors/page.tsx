import Link from "next/link";
import { getAppFeed } from "@/lib/community/feed";
import { audienceMessaging } from "@/lib/messaging/audiences";
import { listProviders } from "@/lib/providers";
import { SeniorActionPanel } from "@/components/senior-action-panel";

export default async function SeniorsPage() {
  const [feed, providers] = await Promise.all([getAppFeed(), listProviders()]);
  const copy = audienceMessaging.seniors;
  const featuredProvider = providers[0];

  return (
    <main className="audience-shell">
      <section className="audience-hero seniors-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p className="lede">{copy.subhead}</p>
          <div className="actions">
            <Link className="button primary" href="/discover">{copy.ctaPrimary}</Link>
            <Link className="button secondary" href="/api/v1/app/feed">{copy.ctaSecondary}</Link>
          </div>
        </div>
        <div className="audience-panel">
          {copy.principles.map((item) => (
            <div key={item}>
              <span>✓</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="feed-preview">
        <div>
          <p className="eyebrow">What families see</p>
          <h2>Care options, events, and community questions in one calm feed.</h2>
        </div>
        <div className="feed-row">
          {feed.slice(0, 3).map((item) => (
            <article className="feed-card" key={item.id}>
              <span className="feed-type">{item.type.replaceAll("_", " ")}</span>
              <h3>{item.title}</h3>
              {item.subtitle ? <p>{item.subtitle}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <SeniorActionPanel providerId={featuredProvider?.id} />
    </main>
  );
}
