import Link from "next/link";
import { OperatorDemoForm } from "@/components/operator-demo-form";
import { ProductVisual } from "@/components/product-visual";
import { visualAssets } from "@/lib/visual-assets";

const features = [
  ["AI Admissions Assistant", "Answers common family questions and captures inquiry context around the clock."],
  ["AI Voice & Call Automation", "Responds instantly when calls are missed, qualifies needs, and routes next steps."],
  ["Tour Scheduling Automation", "Books tours, sends reminders, and follows up after family visits."],
  ["AI Marketing Studio", "Creates local SEO pages, campaigns, social posts, and family education content."],
  ["Multi-Channel Follow-Up", "Keeps communication moving across chat, SMS, email, voice, and reminders."],
  ["Occupancy Analytics", "Shows response speed, inquiry sources, tour conversion, and missed opportunity signals."]
];

export default function AiOccupancyPlatformPage() {
  return (
    <main className="audience-shell">
      <section className="audience-hero operators-hero">
        <div>
          <p className="eyebrow">AI occupancy growth platform</p>
          <h1>Help more families reach the right team at the right moment.</h1>
          <p className="lede">
            TheSeniorGuru upgrades a free community listing into an engagement platform for senior living operators:
            faster response, better follow-up, stronger local visibility, and more tour opportunities.
          </p>
          <div className="actions">
            <Link className="button primary" href="/operators/free-listing">Start with free listing</Link>
            <Link className="button secondary" href="/operators/reputation">Review management</Link>
          </div>
        </div>
        <OperatorDemoForm compact requestedProduct="ai_occupancy" />
      </section>

      <section className="growth-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Built for senior living</p>
            <h2>Not generic SaaS. An occupancy growth layer around real family intent.</h2>
          </div>
        </div>
        <div className="section-grid">
          {features.map(([title, copy]) => (
            <article key={title}>
              <p className="eyebrow">Platform capability</p>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="visual-story-section single">
        <ProductVisual
          asset={visualAssets.operatorOccupancyResponse}
        />
      </section>
    </main>
  );
}
