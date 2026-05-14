export type VisualAssetKey =
  | "familyDecisionSupport"
  | "seniorLivingTour"
  | "careCircleMobileApp"
  | "localSearchMap"
  | "operatorOccupancyResponse"
  | "reputationLocalSearch"
  | "localEventTrust"
  | "newsroomCareGuide"
  | "trustSafetyVerification";

export type VisualAssetSurface =
  | "homepage"
  | "family_discovery"
  | "provider_growth"
  | "newsroom"
  | "local_events"
  | "trust_safety"
  | "seo_landing";

export type VisualAsset = {
  key: VisualAssetKey;
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  copy: string;
  audience: "families" | "seniors" | "operators";
  surfaces: VisualAssetSurface[];
  intent: string;
  source: {
    type: "owned_illustration";
    provenance: string;
    phiRisk: "none";
    approvedFor: string[];
  };
};

export const visualAssets: Record<VisualAssetKey, VisualAsset> = {
  familyDecisionSupport: {
    key: "familyDecisionSupport",
    src: "/assets/seniorguru/family-decision-support.svg",
    alt:
      "Family care circle comparing assisted living options with budget notes, tour readiness, source confidence, and direct inquiry steps in The Senior Guru",
    eyebrow: "Family decision support",
    title: "A shared shortlist with budget, care fit, and next steps.",
    copy:
      "Families compare care type, location, pricing questions, reviews, and source confidence without being pushed into a referral-fee funnel.",
    audience: "families",
    surfaces: ["homepage", "family_discovery", "seo_landing"],
    intent: "Turn high-stress senior living research into a transparent comparison workflow.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru family discovery surface; no external photo license.",
      phiRisk: "none",
      approvedFor: ["homepage hero", "family discovery marketing", "search onboarding"]
    }
  },
  seniorLivingTour: {
    key: "seniorLivingTour",
    src: "/assets/seniorguru/senior-living-tour.svg",
    alt:
      "Senior living tour preparation card with medication support, fall prevention, pricing, availability, and family question prompts",
    eyebrow: "Tour preparation",
    title: "Families arrive with the questions that change the visit.",
    copy:
      "Saved priorities become a tour checklist for care support, safety, pricing, availability, and follow-up with the community.",
    audience: "families",
    surfaces: ["homepage", "family_discovery"],
    intent: "Connect local search to prepared community visits and direct follow-up.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru tour planning content; no external photo license.",
      phiRisk: "none",
      approvedFor: ["homepage story section", "family guidance content"]
    }
  },
  careCircleMobileApp: {
    key: "careCircleMobileApp",
    src: "/assets/seniorguru/care-circle-mobile-app.svg",
    alt:
      "Senior-friendly mobile care circle showing saved tours, caregiver notes, local events, and family next steps",
    eyebrow: "Senior-friendly mobile",
    title: "Saved providers, family notes, and local events stay together.",
    copy:
      "The consumer app keeps seniors and caregivers aligned after the first search, from saved communities to reminders and shared questions.",
    audience: "seniors",
    surfaces: ["homepage", "family_discovery", "local_events"],
    intent: "Show post-search stickiness for seniors and caregivers.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru senior app surface; no external photo license.",
      phiRisk: "none",
      approvedFor: ["seniors page hero", "homepage story section", "mobile app positioning"]
    }
  },
  localSearchMap: {
    key: "localSearchMap",
    src: "/assets/seniorguru/local-search-map.svg",
    alt:
      "Local senior care search map showing organic assisted living and memory care results, sponsored event disclosure, source confidence, and direct contact paths",
    eyebrow: "Transparent local search",
    title: "Organic results, paid placements, and sources stay visible.",
    copy:
      "Families can compare local providers, see sponsorship labels, and keep direct access to calls, profiles, reviews, and tour requests.",
    audience: "families",
    surfaces: ["homepage", "family_discovery", "seo_landing"],
    intent: "Differentiate TheSeniorGuru from opaque referral marketplaces.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru local discovery and ad disclosure surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["discover page", "homepage local search section", "SEO landing pages"]
    }
  },
  operatorOccupancyResponse: {
    key: "operatorOccupancyResponse",
    src: "/assets/seniorguru/operator-occupancy-response.svg",
    alt:
      "Senior living operator response board recovering missed calls, routing family intent to admissions, and tracking tour opportunities",
    eyebrow: "Operator response",
    title: "Missed inquiries become admissions recovery work.",
    copy:
      "Operators see after-hours calls, family needs, response speed, source, and tour opportunity signals before choosing growth automation.",
    audience: "operators",
    surfaces: ["homepage", "provider_growth"],
    intent: "Position AI occupancy tools around senior living admissions outcomes, not generic CRM dashboards.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru operator growth surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["operator hero", "AI occupancy page", "homepage operator section"]
    }
  },
  reputationLocalSearch: {
    key: "reputationLocalSearch",
    src: "/assets/seniorguru/reputation-local-search.svg",
    alt:
      "Local memory care search listing with review sentiment, organic trust signals, sponsored disclosure, and profile confidence",
    eyebrow: "Trust signals",
    title: "Reviews become local search confidence.",
    copy:
      "Reputation workflows connect review requests, moderation, sentiment, and profile confidence in a way families can understand.",
    audience: "operators",
    surfaces: ["provider_growth", "trust_safety"],
    intent: "Show reputation as a measurable occupancy asset tied to provider profiles.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru reputation and local search surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["reputation page hero", "operator upsell", "profile trust education"]
    }
  },
  localEventTrust: {
    key: "localEventTrust",
    src: "/assets/seniorguru/local-event-trust.svg",
    alt:
      "Senior center local event card showing RSVP readiness, transportation notes, sponsor disclosure, caregiver reminder, and accessibility details in The Senior Guru",
    eyebrow: "Local event trust",
    title: "Events show the details seniors and caregivers need before they RSVP.",
    copy:
      "Local events carry accessibility, transportation, sponsorship, RSVP, and reminder context so community engagement feels useful instead of promotional.",
    audience: "seniors",
    surfaces: ["local_events", "homepage", "family_discovery"],
    intent: "Connect the community events marketplace to senior-friendly participation and transparent sponsor labeling.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru local event and community surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["events marketplace", "mobile feed", "homepage community section"]
    }
  },
  newsroomCareGuide: {
    key: "newsroomCareGuide",
    src: "/assets/seniorguru/newsroom-care-guide.svg",
    alt:
      "Editorial senior care guide visual showing reviewed memory care questions, source notes, family takeaways, and publish approval status",
    eyebrow: "Reviewed care guidance",
    title: "Newsroom guidance is tied to sources, approvals, and family takeaways.",
    copy:
      "Care guides are positioned as reviewed decision support with source notes, editorial approval, and practical next steps for families comparing senior care.",
    audience: "families",
    surfaces: ["newsroom", "trust_safety", "seo_landing"],
    intent: "Make AI-assisted senior care content visibly source-aware, approval-gated, and useful for real family decisions.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru newsroom, guide, and SEO content surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["article guides", "newsroom readiness", "SEO education pages"]
    }
  },
  trustSafetyVerification: {
    key: "trustSafetyVerification",
    src: "/assets/seniorguru/trust-safety-verification.svg",
    alt:
      "The Senior Guru trust and safety board showing provider verification, source freshness, sponsored label checks, audit trail, and approval gates",
    eyebrow: "Trust and safety",
    title: "Verification, source freshness, and paid labels are checked before families act.",
    copy:
      "Trust visuals explain how provider claims, source freshness, sponsorship disclosures, and policy approvals work together before listings or promotions publish.",
    audience: "families",
    surfaces: ["trust_safety", "family_discovery", "provider_growth"],
    intent: "Show compliance-minded marketplace governance without exposing PHI or relying on generic safety imagery.",
    source: {
      type: "owned_illustration",
      provenance: "Created in-repo for TheSeniorGuru trust, safety, verification, and disclosure surfaces; no external photo license.",
      phiRisk: "none",
      approvedFor: ["trust center", "provider verification education", "family discovery trust block"]
    }
  }
};

export function listVisualAssets(audience?: VisualAsset["audience"]) {
  const assets = Object.values(visualAssets);
  return audience ? assets.filter((asset) => asset.audience === audience) : assets;
}

export function listVisualAssetsBySurface(surface?: VisualAssetSurface, audience?: VisualAsset["audience"]) {
  const assets = listVisualAssets(audience);
  return surface ? assets.filter((asset) => asset.surfaces.includes(surface)) : assets;
}

export function getVisualAsset(key: VisualAssetKey) {
  return visualAssets[key];
}
