import Link from "next/link";
import { ProductVisual } from "@/components/product-visual";
import { getAppFeed } from "@/lib/community/feed";
import { audienceMessaging } from "@/lib/messaging/audiences";
import { visualAssets } from "@/lib/visual-assets";

export default async function SeniorsPage() {
  const feed = await getAppFeed();
  const copy = audienceMessaging.seniors;

  return (
    <main className="audience-shell">
      <section className="audience-hero seniors-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.headline}</h1>
          <p className="lede">{copy.subhead}</p>
          <div className="actions">
            <Link className="button primary" href="/discover">{copy.ctaPrimary}</Link>
            <Link className="button secondary" href="/discover">{copy.ctaSecondary}</Link>
          </div>
        </div>
        <ProductVisual
          className="audience-visual"
          asset={visualAssets.careCircleMobileApp}
          priority
        />
      </section>

      <section className="principle-strip">
        {copy.principles.map((item) => (
          <span key={item}>{item}</span>
        ))}
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
    </main>
  );
}
