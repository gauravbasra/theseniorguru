import Link from "next/link";
import Image from "next/image";
import { getAppFeed } from "@/lib/community/feed";
import { listProviders } from "@/lib/providers";

const heroImage =
  "https://images.unsplash.com/photo-1576765608866-5b51f0049b2c?auto=format&fit=crop&w=1800&q=86";

const categories = [
  "Housing",
  "Home Health & Hospice",
  "Resources & Services",
  "Senior Living",
  "Jobs"
];

export default async function HomePage() {
  const [feed, providers] = await Promise.all([getAppFeed(), listProviders()]);
  const featuredProviders = providers.slice(0, 6);

  return (
    <main className="home-shell">
      <section className="top-contact-bar" aria-label="Contact information">
        <span>Phone: +1 (720) 881-1543</span>
        <span>Email: contact@theseniorguru.com</span>
        <span>Operating Hours: 08:00am to 06:00pm</span>
      </section>

      <nav className="home-nav" aria-label="Primary navigation">
        <Link className="brand-mark" href="/">
          <span>SG</span>
          <strong>The Senior Guru</strong>
        </Link>
        <div>
          <Link href="/discover">Directory</Link>
          <Link href="/seniors">For Seniors</Link>
          <Link href="/operators">Operators</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Empowering seniors in the digital age</p>
          <h1>Find senior care, housing, and trusted local help without referral pressure.</h1>
          <p className="lede">
            Search real listings, save options, ask family questions, and contact providers directly. Listings stay free;
            sponsored placements stay clearly labeled.
          </p>
          <div className="actions">
            <Link className="button primary" href="/discover">Explore listings</Link>
            <Link className="button secondary" href="/seniors">Family app</Link>
            <Link className="button secondary" href="/operators">List your community</Link>
          </div>
          <div className="hero-stats" aria-label="Marketplace signals">
            <span><strong>{providers.length}</strong> listed services</span>
            <span><strong>5</strong> ways to start</span>
            <span><strong>$0</strong> referral pressure</span>
          </div>
        </div>
        <aside className="hero-media" aria-label="Senior family support preview">
          <Image
            src={heroImage}
            alt="A caregiver helping an older adult with warmth and patience"
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

      <section className="category-strip">
        <div>
          <p className="eyebrow">Discover our diverse offerings</p>
          <h2>Start with the kind of help you need.</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link href="/discover" key={category}>
              <span>{category}</span>
              <strong>Explore</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div>
          <p className="eyebrow">Making navigation easy</p>
          <h2>How The Senior Guru helps families move from worry to a shortlist.</h2>
        </div>
        <div className="how-grid">
          {[
            ["Search locally", "Compare senior living, home care, housing, resources, and services near the family."],
            ["Save and discuss", "Build a care circle, invite relatives, and keep notes before calls become urgent."],
            ["Contact directly", "Reach providers without a referral-fee gate or hidden pay-to-play directory wall."]
          ].map(([title, copy], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="featured-listings">
        <div className="section-heading">
          <p className="eyebrow">Our service offerings</p>
          <h2>Explore highlighted listings from the current marketplace.</h2>
          <Link className="button secondary" href="/discover">View all listings</Link>
        </div>
        <div className="listing-grid">
          {featuredProviders.map((provider) => (
            <article className="listing-card" key={provider.id}>
              {provider.imageUrl ? (
                <Image src={provider.imageUrl} alt={provider.name} width={620} height={420} />
              ) : null}
              <div>
                <span className="feed-type">{provider.categories[0]}</span>
                <h3>{provider.name}</h3>
                <p>{provider.address ? `${provider.address}, ` : ""}{provider.city}, {provider.state}</p>
                {provider.priceLabel ? <strong className="price-label">{provider.priceLabel}</strong> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="care-story">
        <Image
          src="https://images.unsplash.com/photo-1581579438747-104c53d7fbc4?auto=format&fit=crop&w=1200&q=84"
          alt="A senior couple reviewing care options together"
          width={780}
          height={620}
        />
        <div>
          <p className="eyebrow">Why choose The Senior Guru?</p>
          <h2>Compassionate guidance, direct access, and a marketplace families can understand.</h2>
          <p>
            Senior care decisions are emotional, expensive, and often rushed. The Senior Guru is built to slow the moment
            down: show the options, make contact easy, invite family into the conversation, and keep sponsored listings
            clearly marked.
          </p>
          <div className="trust-band">
            {["Free listings", "Direct contact", "No referral fees", "Sponsored labels"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
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

      <section className="api-proof">
        <div>
          <p className="eyebrow">For local providers</p>
          <h2>Be found before families are in crisis, and be trusted when they compare.</h2>
        </div>
        <div className="api-links">
          <Link href="/operators">Grow your profile</Link>
          <Link href="/provider">Provider tools</Link>
          <Link href="/discover">See directory</Link>
        </div>
      </section>
    </main>
  );
}
