import Image from "next/image";
import Link from "next/link";
import { PartnerRequestForm } from "@/components/partner-request-form";

const appScreens = [
  {
    image: "/assets/app-screens/today.png",
    alt: "TheSeniorGuru mobile today screen with medication, visit, family message, activity, and SOS cards.",
    eyebrow: "Daily support",
    title: "A calmer way to manage the day.",
    body:
      "TheSeniorGuru brings the daily details of senior life into one clear place: medication reminders, appointments, transportation, family messages, activities, and emergency help. Seniors see what matters now without sorting through complicated menus.",
    points: ["Medication reminders", "Appointment context", "Emergency help access"]
  },
  {
    image: "/assets/app-screens/help-requests.png",
    alt: "TheSeniorGuru help screen with ride, medication, meals, cleaning, essentials, and companionship requests.",
    eyebrow: "Ask for help",
    title: "Everyday needs become simple requests.",
    body:
      "A senior or caregiver can ask for the support they need in plain language. Ride help, meals, medication support, cleaning, essentials, and companionship are presented as familiar choices with voice input available when typing is not convenient.",
    points: ["Ride and meal help", "Medication and essentials", "Voice-friendly requests"]
  },
  {
    image: "/assets/app-screens/guru-assistant-ride.png",
    alt: "Guru Assistant chat showing transportation options for a doctor appointment.",
    eyebrow: "Guru Assistant",
    title: "Guided help that feels conversational.",
    body:
      "Guru Assistant helps seniors move from a need to the next useful action. A request for a ride can become matched transportation options, pricing ranges, availability, and a direct booking path without making the user start over.",
    points: ["Conversational intake", "Transportation matching", "Clear booking actions"]
  },
  {
    image: "/assets/app-screens/services.png",
    alt: "TheSeniorGuru services marketplace with transportation, meals, home help, health, and personal care providers.",
    eyebrow: "Trusted services",
    title: "A senior-focused services marketplace.",
    body:
      "Families need more than a directory. TheSeniorGuru organizes trusted local help around the tasks seniors actually need: transportation, meals, home help, health support, and personal care, with reviews, availability, and saved providers.",
    points: ["Background-checked services", "Local provider discovery", "Family decision support"]
  },
  {
    image: "/assets/app-screens/companion.png",
    alt: "TheSeniorGuru companion screen with mood check-in, chat, relaxation, and daily inspiration.",
    eyebrow: "Companionship",
    title: "Connection, reassurance, and emotional support.",
    body:
      "The companion experience is designed for the quieter moments too. Mood check-ins, chat, guided relaxation, and daily inspiration help seniors feel seen while giving families another signal that someone is paying attention.",
    points: ["Mood check-ins", "Guided relaxation", "Companion chat"]
  },
  {
    image: "/assets/app-screens/community-feed.png",
    alt: "TheSeniorGuru community feed with resident posts, events, comments, likes, and sharing.",
    eyebrow: "Community",
    title: "A community feed built for belonging.",
    body:
      "TheSeniorGuru keeps seniors connected to people, events, and moments around them. Community posts, event updates, family-friendly sharing, and activity highlights create a social layer without turning the product into a noisy social network.",
    points: ["Community posts", "Event sharing", "Family visibility"]
  },
  {
    image: "/assets/app-screens/events-cards.png",
    alt: "TheSeniorGuru events screen with chair yoga, health talk, movie night, and painting class.",
    eyebrow: "Activities and events",
    title: "Local activities are easy to discover and join.",
    body:
      "Events help seniors stay active and engaged. The app presents activities by timing, place, interest, and attendance so a resident can quickly find something meaningful and join with confidence.",
    points: ["Activity discovery", "Simple event joining", "Community participation"]
  }
];

const audiences = [
  ["Seniors", "Maintain independence while staying connected, supported, and confident day to day."],
  ["Families", "Gain peace of mind through visibility, communication, and practical care coordination."],
  ["Senior living communities", "Improve resident engagement, wellness, communication, and satisfaction."],
  ["Service providers", "Reach seniors and families actively seeking trusted support services."]
];

const needs = [
  "Medication Management",
  "Transportation & Rides",
  "Meals & Grocery Assistance",
  "Housekeeping & Laundry",
  "AI Companion",
  "Emergency SOS",
  "Community Activities",
  "Family Communication",
  "Wellness Tracking",
  "Trusted Circle"
];

const steps = [
  "Create your profile",
  "Build your trusted circle",
  "Connect services and preferences",
  "Receive support when needed",
  "Stay active, engaged, and connected"
];

const partnerTypes = [
  "Transportation companies",
  "Meal providers",
  "Pharmacies",
  "Home care agencies",
  "Wellness providers",
  "Telehealth companies",
  "Senior living communities"
];

const faqs = [
  [
    "What is TheSeniorGuru?",
    "TheSeniorGuru is a mobile-first senior support platform for daily help, family connection, trusted services, community engagement, companionship, and emergency access."
  ],
  [
    "Who can use it?",
    "The platform is designed for seniors, family members, caregivers, senior living communities, home care organizations, and trusted service providers."
  ],
  [
    "How does the AI Companion work?",
    "Guru Assistant helps turn everyday needs into guided next steps, such as requesting a ride, finding help, checking in emotionally, or discovering activities."
  ],
  [
    "How do providers participate?",
    "Providers can request a partnership conversation to discuss service area, category fit, pilot opportunities, and how their services can support seniors and families."
  ]
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="TheSeniorGuru home">
          <span>SG</span>
          <strong>TheSeniorGuru</strong>
        </Link>
        <nav aria-label="Page sections">
          <a href="#who-we-help">Who we help</a>
          <a href="#services">Services</a>
          <a href="#partners">Partners</a>
          <a href="#founder">Founder</a>
          <a href="#booking">Book</a>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <h1>Helping seniors live independently, safely, and connected.</h1>
          <p>
            A mobile-first platform connecting seniors, families, communities, caregivers, and service providers in one
            simple experience.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#booking">Join early access</a>
            <a className="secondary-action" href="#booking">Schedule a demo</a>
            <a className="secondary-action" href="#partners">Become a partner</a>
          </div>
        </div>
        <div className="hero-phone" aria-label="TheSeniorGuru app preview">
          <Image
            src="/assets/app-screens/today.png"
            alt="TheSeniorGuru daily overview mobile app screen."
            width={863}
            height={1822}
            priority
          />
        </div>
      </section>

      <section className="store-strip" aria-label="Mobile app availability">
        <p>Coming soon on</p>
        <div>
          <span>iOS App Store</span>
          <span>Google Play Store</span>
        </div>
      </section>

      <section className="audience-band" id="who-we-help" aria-label="Who TheSeniorGuru helps">
        {audiences.map(([title, copy]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="intro-section" id="daily-life">
        <div>
          <h2>Everything seniors need in one place.</h2>
        </div>
        <div>
          <p>
            TheSeniorGuru brings together daily care, family visibility, community engagement, trusted local services,
            transportation, medication support, companionship, and emergency access. The goal is not another complicated
            portal. It is a calm, useful layer that meets seniors where they are.
          </p>
          <ul className="need-grid">
            {needs.map((need) => (
              <li key={need}>{need}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="story-stack" id="services">
        {appScreens.map((screen) => (
          <section className="story-section" key={screen.title}>
            <figure className="phone-frame">
              <Image src={screen.image} alt={screen.alt} width={863} height={1824} />
            </figure>
            <div className="story-copy">
              <span>{screen.eyebrow}</span>
              <h2>{screen.title}</h2>
              <p>{screen.body}</p>
              <ul>
                {screen.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <section className="how-section" aria-label="How TheSeniorGuru works">
        <div>
          <span>How it works</span>
          <h2>A simple path from profile to support.</h2>
        </div>
        <ol>
          {steps.map((step, index) => (
            <li key={step}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <p>{step}.</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="partner-section" id="partners">
        <div className="partner-copy">
          <span>For service providers</span>
          <h2>Partner with TheSeniorGuru.</h2>
          <p>
            We are actively seeking partnerships with trusted organizations that help seniors live independently,
            safely, and connected.
          </p>
          <div className="partner-grid">
            {partnerTypes.map((partnerType) => (
              <span key={partnerType}>{partnerType}</span>
            ))}
          </div>
        </div>
        <PartnerRequestForm />
      </section>

      <section className="pilot-section">
        <div>
          <span>Community pilot program</span>
          <h2>Seeking senior living communities, home care organizations, and resident councils.</h2>
        </div>
        <div className="pilot-benefits">
          {["Early access", "Influence product roadmap", "Priority support", "Pilot pricing"].map((benefit) => (
            <p key={benefit}>{benefit}</p>
          ))}
        </div>
        <a className="primary-action" href="#partners">Apply for pilot program</a>
      </section>

      <section className="founder-section" id="founder">
        <div className="founder-copy">
          <span>Founder</span>
          <h2>Founded by Gaurav Basra.</h2>
          <p>
            Gaurav Basra is the Founder and CEO of Basra Consulting Services and the founder behind TheSeniorGuru. He
            brings 20+ years of leadership across AI, security, cloud, enterprise software, healthcare technology,
            senior living, startup innovation, and executive operating teams.
          </p>
          <p>
            His work connects product strategy, ethical AI, customer engagement, operational systems, and go-to-market
            execution for businesses that need technology to become real user value.
          </p>
        </div>
        <div className="founder-card">
          <Image
            src="/assets/founder/gaurav-basra.jpeg"
            alt="Gaurav Basra, founder of TheSeniorGuru."
            width={360}
            height={540}
          />
          <div>
            <strong>Gaurav Basra</strong>
            <p>AI strategist, technology executive, startup advisor, angel investor, and Founder & CEO of BCS.</p>
            <Link href="https://basraconsultingservices.com/#gaurav-basra">View BCS founder profile</Link>
          </div>
        </div>
      </section>

      <section className="booking-section" id="booking">
        <div>
          <h2>Book a strategy meeting.</h2>
          <p>
            For partnerships, senior living communities, service providers, investor conversations, and strategic
            collaboration, schedule a consultation through Basra Consulting Services or contact Gaurav directly.
          </p>
        </div>
        <div className="booking-actions">
          <Link className="primary-action" href="https://basraconsultingservices.com/#schedule">
            Book meeting
          </Link>
          <Link className="secondary-action" href="mailto:gaurav@basraconsultingservices.com">
            gaurav@basraconsultingservices.com
          </Link>
        </div>
      </section>

      <section className="faq-section">
        <div>
          <span>FAQ</span>
          <h2>Common questions about TheSeniorGuru.</h2>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <article key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <strong>The future of independent aging is connected.</strong>
        <span>Request a demo, become a partner, or join early access.</span>
      </footer>
    </main>
  );
}
