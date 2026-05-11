import Image from "next/image";
import Link from "next/link";
import { FamilyInquiryForm } from "@/components/family-inquiry-form";
import { FreeListingForm } from "@/components/free-listing-form";
import { OperatorDemoForm } from "@/components/operator-demo-form";
import { ProductVisual } from "@/components/product-visual";
import { listProviders } from "@/lib/providers";

const careTypes = [
  "Assisted Living",
  "Memory Care",
  "Independent Living",
  "Skilled Nursing",
  "Rehabilitation & Recovery",
  "Respite Care",
  "Senior Apartments",
  "Home Care Services"
];

const localSearchLinks = [
  ["Assisted Living in Denver", "/senior-care/co/denver/assisted-living"],
  ["Memory Care in Scottsdale", "/senior-care/az/scottsdale/memory-care"],
  ["Senior Living in Austin", "/senior-living/tx/austin"],
  ["Independent Living near Parker CO", "/senior-care/co/parker/independent-living"],
  ["Senior Living in Dallas", "/senior-living/ga/dallas"],
  ["Home Care in McKinney", "/senior-care/tx/mckinney/home-care"]
];

const operatorPain = [
  "Missed calls and slow inquiry response",
  "After-hours lead loss",
  "Fragmented marketing tools",
  "Low tour conversion",
  "Inconsistent follow-up",
  "Review and reputation gaps"
];

const growthFeatures = [
  ["AI Admissions Assistant", "24/7 inquiry engagement for website visitors and families who need answers quickly."],
  ["AI Voice & Call Automation", "Answer calls, capture lead details, qualify needs, and route families to the right person."],
  ["Tour Scheduling Automation", "Automate tour bookings, confirmations, reminders, and follow-up workflows."],
  ["Review & Reputation Management", "Generate first-party reviews, monitor feedback, and improve online trust."],
  ["AI Marketing Studio", "Create local SEO content, campaigns, landing pages, and family engagement workflows."],
  ["Occupancy Analytics", "Track response speed, inquiry performance, tours, and occupancy-focused conversion signals."]
];

export default async function HomePage() {
  const providers = await listProviders();
  const featuredProviders = providers.slice(0, 6);

  return (
    <main className="home-shell">
      <section className="top-contact-bar" aria-label="Contact information">
        <span>Phone: +1 (720) 881-1543</span>
        <span>Email: contact@theseniorguru.com</span>
        <span>Helping families and senior living communities nationwide</span>
      </section>

      <nav className="home-nav" aria-label="Primary navigation">
        <Link className="brand-mark" href="/">
          <span>SG</span>
          <strong>The Senior Guru</strong>
        </Link>
        <div>
          <Link href="/discover">Search Communities</Link>
          <Link href="/operators/free-listing">List Free</Link>
          <Link href="/operators">For Operators</Link>
          <Link href="/operators/ai-occupancy-platform">AI Occupancy</Link>
          <Link href="/articles">Guides</Link>
          <Link href="/login">Login</Link>
        </div>
      </nav>

      <section className="hero dual-hero">
        <div className="hero-copy">
          <p className="eyebrow">Senior living discovery + occupancy growth</p>
          <h1>Find the right senior living community with confidence</h1>
          <p className="lede">
            Explore assisted living, memory care, independent living, and senior care communities across the United
            States. Compare options, reviews, amenities, pricing insights, and availability in one trusted place.
          </p>
          <div className="actions">
            <Link className="button primary" href="/discover">Search communities</Link>
            <Link className="button secondary" href="/operators/free-listing">List your community free</Link>
          </div>
          <div className="hero-stats" aria-label="Marketplace signals">
            <span><strong>{providers.length}</strong> launch listings</span>
            <span><strong>$0</strong> free public listings</span>
            <span><strong>24/7</strong> AI engagement path</span>
          </div>
        </div>
        <ProductVisual
          className="hero-visual"
          src="/assets/seniorguru/family-decision-support.svg"
          alt="Family care circle comparing senior living communities, tour notes, reviews, and direct inquiries in The Senior Guru"
          eyebrow="Family decision support"
          title="From stressful search to a shared shortlist."
          copy="Families compare care type, budget, reviews, notes, and direct next steps without a referral-fee wall."
          priority
        />
      </section>

      <section className="trust-section">
        <div>
          <p className="eyebrow">Trusted senior care discovery for families</p>
          <h2>Helping families find the right senior care community.</h2>
        </div>
        <p>
          TheSeniorGuru helps families discover and compare senior living communities with transparent information,
          personalized guidance, and AI-powered search tools designed to simplify the senior care journey.
        </p>
        <p>
          Whether you are searching for assisted living, memory care, independent living, home care, or specialized
          senior support services, the platform helps you make informed decisions with confidence.
        </p>
      </section>

      <section className="category-strip">
        <div>
          <p className="eyebrow">Discover senior living communities nationwide</p>
          <h2>Browse care types families search for every day.</h2>
        </div>
        <div className="category-grid">
          {careTypes.map((category) => (
            <Link href={`/discover?category=${encodeURIComponent(category)}`} key={category}>
              <span>{category}</span>
              <strong>Compare</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="how-section">
        <div>
          <p className="eyebrow">AI-powered senior care search</p>
          <h2>Search smarter with local context and family-focused comparisons.</h2>
        </div>
        <div className="how-grid">
          {[
            ["Personalized recommendations", "Match by care type, location, timeline, budget, and family priorities."],
            ["Affordability insights", "Give families a clearer starting point before calls and tours begin."],
            ["Guided discovery", "Turn stress into a shortlist with notes, comparisons, reviews, and direct inquiries."]
          ].map(([title, copy], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="visual-story-section">
        <ProductVisual
          src="/assets/seniorguru/senior-living-tour.svg"
          alt="Senior living tour plan with checklist for meals, safety questions, pricing, availability, and family notes"
          eyebrow="Tour preparation"
          title="Families arrive with the right questions."
          copy="Saved priorities turn search results into prepared community visits, clearer follow-up, and less guesswork."
        />
        <ProductVisual
          src="/assets/seniorguru/care-circle-mobile-app.svg"
          alt="Senior-friendly mobile care circle showing saved tours, notes, and shared family planning"
          eyebrow="Care circle app"
          title="The decision stays organized after the first search."
          copy="A mobile-friendly care circle keeps seniors and caregivers aligned around saved communities, events, and next steps."
        />
      </section>

      <section className="featured-listings">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Featured community templates</p>
            <h2>Community pages are built to convert family research into direct inquiries.</h2>
          </div>
          <Link className="button secondary" href="/discover">View all listings</Link>
        </div>
        <div className="listing-grid">
          {featuredProviders.map((provider) => (
            <Link className="listing-card" href={`/providers/${provider.slug}`} key={provider.id}>
              {provider.imageUrl ? (
                <Image src={provider.imageUrl} alt={provider.name} width={620} height={420} />
              ) : null}
              <div>
                <span className="feed-type">{provider.categories[0] ?? "Senior Care"}</span>
                <h3>{provider.name}</h3>
                <p>{provider.address ? `${provider.address}, ` : ""}{provider.city}, {provider.state}</p>
                {provider.priceLabel ? <strong className="price-label">{provider.priceLabel}</strong> : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="local-search-section">
        <div>
          <p className="eyebrow">Local search architecture</p>
          <h2>City and care-type pages become the SEO moat.</h2>
          <p>
            Families search locally. TheSeniorGuru is structured around city + care-type pages that collect listings,
            reviews, events, FAQs, and inquiry capture in one search-friendly experience.
          </p>
        </div>
        <div className="local-link-grid">
          {localSearchLinks.map(([label, href]) => (
            <Link href={href} key={label}>{label}</Link>
          ))}
        </div>
        <ProductVisual
          className="local-search-visual"
          src="/assets/seniorguru/local-search-map.svg"
          alt="Local senior care search map with assisted living, memory care, sponsored event labels, and direct contact paths"
          eyebrow="Local discovery"
          title="City and care pages with honest labels."
          copy="Organic listings, sponsored placements, and direct contact stay visually distinct for family trust."
        />
      </section>

      <section className="split-cta">
        <div>
          <p className="eyebrow">Need help now?</p>
          <h2>Tell us what your family is looking for.</h2>
          <p>
            Capture the basic care need, city, and timeline so TheSeniorGuru can help families move from searching to
            a useful shortlist.
          </p>
        </div>
        <FamilyInquiryForm compact />
      </section>

      <section className="operator-band">
        <div>
          <p className="eyebrow">Own or manage a senior living community?</p>
          <h2>Claim your free community listing and start receiving family inquiries.</h2>
          <p>
            Public profile pages, amenities, photos, inquiry forms, review visibility, SEO indexing, local discovery,
            lead capture, and basic analytics all begin with a free listing.
          </p>
          <div className="actions">
            <Link className="button primary" href="/operators/free-listing">Claim free listing</Link>
            <Link className="button secondary" href="/operators">See operator path</Link>
          </div>
        </div>
        <FreeListingForm />
      </section>

      <section className="pain-section">
        <div>
          <p className="eyebrow">Occupancy growth</p>
          <h2>Senior living communities lose occupancy when inquiries are missed.</h2>
          <p>
            TheSeniorGuru helps communities engage families faster and convert more inquiries into scheduled tours
            without turning the marketplace into a referral-fee gate.
          </p>
        </div>
        <div className="pain-grid">
          {operatorPain.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <ProductVisual
          className="occupancy-response-visual"
          src="/assets/seniorguru/operator-occupancy-response.svg"
          alt="Senior living operator dashboard routing missed calls and family inquiries into admissions follow-up and tour opportunities"
          eyebrow="Operator response"
          title="Missed inquiries become visible recovery work."
          copy="Operators see the occupancy impact of slow response and can route families to the right next step."
        />
      </section>

      <section className="growth-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AI occupancy growth platform</p>
            <h2>Helping senior living communities increase occupancy with AI-powered engagement.</h2>
          </div>
          <Link className="button secondary" href="/operators/ai-occupancy-platform">Explore platform</Link>
        </div>
        <div className="section-grid">
          {growthFeatures.map(([title, copy]) => (
            <article key={title}>
              <p className="eyebrow">Growth tool</p>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="split-cta final-cta">
        <div>
          <p className="eyebrow">Built for the future of senior living engagement</p>
          <h2>Start with a free community listing. Upgrade when you are ready to grow.</h2>
          <p>
            TheSeniorGuru combines trusted senior care discovery with modern engagement tools that improve
            responsiveness, streamline communication, strengthen reputation, and create more occupancy opportunities.
          </p>
          <div className="actions">
            <Link className="button primary" href="/operators/free-listing">Claim free listing</Link>
            <Link className="button secondary" href="/operators/reputation">Review tools</Link>
          </div>
        </div>
        <OperatorDemoForm compact requestedProduct="full_platform" />
      </section>
    </main>
  );
}
