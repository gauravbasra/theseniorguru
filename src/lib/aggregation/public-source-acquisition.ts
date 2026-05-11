import { createImportBatch } from "@/lib/import-batches";
import { runImportBatch } from "@/lib/aggregation/import-worker";
import type { ImportBatchSourceCoverage, ImportRecordInput } from "@/lib/domain/imports";
import type { StagedListingAuditEvent, StagedListingImageRecord } from "@/lib/domain/entities";

type AdapterKind = "official_csv" | "official_api" | "open_directory_page" | "rss" | "manual_seed" | "current_site_json";

type PublicSourcePolicy = {
  sourceName: string;
  sourceUrl: string;
  adapterKind: AdapterKind;
  licenseTermsStatus: "approved_seed_sample" | "requires_owner_review" | "approved_open_data" | "owned_public_site" | "blocked";
  robotsDecision: "not_required_for_seeded_file" | "allowed" | "disallowed" | "requires_check";
  termsNotes: string;
};

type PublicSourceListingSeed = {
  sourceRecordId: string;
  name: string;
  categories: string[];
  careTypes: string[];
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  county: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  description?: string;
  amenities?: string[];
  services?: string[];
  pricingSignals?: Record<string, unknown>;
  licenseFields?: Record<string, unknown>;
  accreditationFields?: Record<string, unknown>;
  imageUrls?: string[];
};

type SeniorGuruSearchListing = {
  id?: number;
  title?: string;
  slug?: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  zip?: string | null;
  lati?: string | null;
  longi?: string | null;
  price?: string | number | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  reviewcount?: number;
  reviewsavg?: number;
  files?: Array<{ id?: number; filename?: string; created_at?: string; updated_at?: string }>;
  city?: { name?: string };
  state?: { name?: string };
  country?: { sortname?: string; name?: string };
  categories?: Array<{ id?: number; name?: string; slug?: string; parent_id?: number | null }>;
};

type AcquisitionAdapter = {
  policy: PublicSourcePolicy;
  load: () => Promise<PublicSourceListingSeed[]>;
};

type QualityGap = {
  sourceRecordId: string;
  name: string;
  gaps: string[];
};

export type PublicSourceAcquisitionRunResult = {
  generatedAt: string;
  batchId: string;
  status: string;
  dryRun: boolean;
  sourceCount: number;
  totalRecords: number;
  stagedRecords: number;
  skippedRecords: number;
  rejectedRecords: number;
  errorRecords: number;
  sourceCoverage: ImportBatchSourceCoverage;
  imageCoverage: {
    listingsWithThreeImages: number;
    listingsMissingThreeImages: number;
    averageImagesPerListing: number;
  };
  qualityGaps: QualityGap[];
  sourcePolicies: PublicSourcePolicy[];
  importErrors: Array<{ index: number; reason: string }>;
  nextActions: string[];
};

export type CurrentSiteRealListingPreviewResult = {
  generatedAt: string;
  sourceCount: number;
  discoveredListings: number;
  requestedRecords: number;
  parsedRecords: number;
  skippedRecords: number;
  imageCoverage: PublicSourceAcquisitionRunResult["imageCoverage"];
  qualityGaps: QualityGap[];
  sourcePolicies: PublicSourcePolicy[];
  records: ImportRecordInput[];
};

const currentSiteBaseUrl = "https://theseniorguru.com";
const userAgent = "TheSeniorGuruDataAcquisitionBot/0.1 (+https://theseniorguru.com)";
const stateAbbreviations: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY"
};

function nowIso() {
  return new Date().toISOString();
}

const fetchedAt = "2026-05-11T00:00:00.000Z";

const sampleDirectoryAdapter: AcquisitionAdapter = {
  policy: {
    sourceName: "Seeded Official Directory Sample",
    sourceUrl: "seed://public-source-friendly/official-directory-sample.csv",
    adapterKind: "official_csv",
    licenseTermsStatus: "approved_seed_sample",
    robotsDecision: "not_required_for_seeded_file",
    termsNotes:
      "Seed records exercise the CSV/API staging path only. Production use still requires approved source registry rows, terms review, and robots checks for each live source."
  },
  async load() {
    return [
      {
        sourceRecordId: "seed-official-co-001",
        name: "Sample Front Range Assisted Living",
        categories: ["Senior Living", "Assisted Living"],
        careTypes: ["Assisted Living", "Respite Care"],
        addressLine1: "1000 Public Directory Way",
        city: "Denver",
        state: "CO",
        postalCode: "80202",
        county: "Denver",
        latitude: 39.752,
        longitude: -104.99,
        phone: "303-555-0100",
        email: "info@example.org",
        websiteUrl: "https://example.org/front-range-assisted-living",
        description: "Seeded senior living record for validating compliant staging, dedupe, and review workflows.",
        amenities: ["Accessible entrances", "Dining room", "Transportation coordination"],
        services: ["Medication reminders", "Personal care", "Care coordination"],
        pricingSignals: { monthlyStartingAt: 4200, currency: "USD", sourceLabel: "seeded sample" },
        licenseFields: { licenseNumber: "CO-SEED-001", licenseStatus: "sample_not_for_publication" },
        accreditationFields: { source: "seeded sample", status: "not verified" },
        imageUrls: [
          "https://example.org/images/front-range-exterior.jpg",
          "https://example.org/images/front-range-dining.jpg",
          "https://example.org/images/front-range-suite.jpg"
        ]
      },
      {
        sourceRecordId: "seed-official-tx-002",
        name: "Sample Hill Country Memory Care",
        categories: ["Senior Living", "Memory Care"],
        careTypes: ["Memory Care"],
        addressLine1: "220 Public Records Trail",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        county: "Travis",
        latitude: 30.271,
        longitude: -97.742,
        phone: "512-555-0110",
        websiteUrl: "https://example.org/hill-country-memory-care",
        description: "Seeded memory care record with intentionally thin media coverage for quality gap reporting.",
        amenities: ["Secured outdoor courtyard", "Family visiting areas"],
        services: ["Memory care programming", "Medication support"],
        pricingSignals: { acceptsPrivatePay: true, sourceLabel: "seeded sample" },
        licenseFields: { licenseNumber: "TX-SEED-002", licenseStatus: "sample_not_for_publication" },
        imageUrls: ["https://example.org/images/hill-country-exterior.jpg"]
      },
      {
        sourceRecordId: "seed-official-va-003",
        name: "Sample Tidewater Home Care",
        categories: ["Home Care", "Senior Services"],
        careTypes: ["Non-medical Home Care", "Companion Care"],
        addressLine1: "45 Open Data Ave",
        city: "Norfolk",
        state: "VA",
        postalCode: "23510",
        county: "Norfolk",
        phone: "757-555-0140",
        email: "care@example.org",
        websiteUrl: "https://example.org/tidewater-home-care",
        description: "Seeded service provider record for validating non-community provider categories.",
        services: ["Companion care", "Meal preparation", "Transportation"],
        licenseFields: { licenseNumber: "VA-SEED-003", licenseStatus: "sample_not_for_publication" },
        accreditationFields: { bonded: true, insured: true, source: "seeded sample" },
        imageUrls: [
          "https://example.org/images/tidewater-team.jpg",
          "https://example.org/images/tidewater-caregiver.jpg",
          "https://example.org/images/tidewater-office.jpg",
          "https://example.org/images/tidewater-transport.jpg"
        ]
      }
    ];
  }
};

const adapters: AcquisitionAdapter[] = [sampleDirectoryAdapter];

function imageAssetsFor(seed: PublicSourceListingSeed, policy: PublicSourcePolicy): StagedListingImageRecord[] {
  return (seed.imageUrls ?? []).slice(0, 6).map((url, index) => ({
    url,
    sourceUrl: policy.sourceUrl,
    fetchedAt,
    licenseTermsStatus: policy.licenseTermsStatus,
    robotsDecision: policy.robotsDecision,
    reviewStatus: policy.licenseTermsStatus === "approved_seed_sample" ? "pending_review" : "needs_rights_review",
    storageStatus: "not_stored",
    altText: `${seed.name} source image ${index + 1}`,
    ordinal: index + 1
  }));
}

function auditTrailFor(policy: PublicSourcePolicy): StagedListingAuditEvent[] {
  return [
    {
      at: fetchedAt,
      actor: "public-source-acquisition-worker",
      action: "source_policy_evaluated",
      notes: `${policy.licenseTermsStatus}; robots=${policy.robotsDecision}`
    },
    {
      at: fetchedAt,
      actor: "public-source-acquisition-worker",
      action: "listing_staged_for_review",
      notes: "Record remains staged until human/source approval and image storage review are complete."
    }
  ];
}

function qualityGapsFor(record: ImportRecordInput): QualityGap | null {
  const gaps: string[] = [];

  if (!record.phone && !record.websiteUrl && !record.email) {
    gaps.push("missing_contact_path");
  }

  if (!record.latitude || !record.longitude) {
    gaps.push("missing_geo");
  }

  if (!record.licenseFields || Object.keys(record.licenseFields).length === 0) {
    gaps.push("missing_license_fields");
  }

  if (!record.description) {
    gaps.push("missing_description");
  }

  return gaps.length > 0
    ? {
        sourceRecordId: record.sourceRecordId ?? "unknown",
        name: record.name ?? "Unnamed listing",
        gaps
      }
    : null;
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textFromHtml(value?: string | null) {
  return decodeHtml(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cookieHeaderFrom(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get("set-cookie");
  const cookieStrings = setCookies.length > 0 ? setCookies : fallback ? fallback.split(/,(?=[^;,]+=)/) : [];

  return cookieStrings
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function extractCsrfToken(html: string) {
  return html.match(/"_token":\s*"([^"]+)"/)?.[1] ?? html.match(/name="_token"\s+value="([^"]+)"/)?.[1] ?? "";
}

async function fetchCurrentSiteRobotsDecision() {
  const response = await fetch(`${currentSiteBaseUrl}/robots.txt`, {
    headers: { "user-agent": userAgent },
    cache: "no-store"
  });
  const text = await response.text();
  const disallowedAll = /user-agent:\s*\*\s*disallow:\s*\/\s*(?:\n|$)/i.test(text);

  return {
    status: response.status,
    text,
    decision: response.ok && !disallowedAll ? "allowed" as const : "disallowed" as const
  };
}

async function fetchCurrentSiteSearchSession() {
  const response = await fetch(`${currentSiteBaseUrl}/search`, {
    headers: { "user-agent": userAgent },
    cache: "no-store"
  });
  const html = await response.text();
  const csrfToken = extractCsrfToken(html);
  const cookie = cookieHeaderFrom(response);

  if (!response.ok || !csrfToken || !cookie) {
    throw new Error("Unable to establish public Senior Guru search session for listing acquisition.");
  }

  return { csrfToken, cookie };
}

async function fetchCurrentSiteListingsPage(input: {
  csrfToken: string;
  cookie: string;
  skip: number;
  order: "asc" | "desc";
}) {
  const body = new URLSearchParams({
    _token: input.csrfToken,
    category: "",
    location: "",
    subcat: "",
    keyword: "",
    list_order: input.order,
    skip: String(input.skip)
  });
  const response = await fetch(`${currentSiteBaseUrl}/search-listing`, {
    method: "POST",
    headers: {
      "user-agent": userAgent,
      "x-requested-with": "XMLHttpRequest",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      accept: "application/json",
      cookie: input.cookie
    },
    body,
    cache: "no-store"
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`Senior Guru search-listing request failed with ${response.status}`);
  }

  const values = Object.values((json as { listing?: Record<string, SeniorGuruSearchListing> }).listing ?? {});

  return {
    listings: values,
    count: Number((json as { count?: number }).count ?? values.length),
    totalCount: Number((json as { totalCount?: number }).totalCount ?? values.length)
  };
}

function categorySlugFor(listing: SeniorGuruSearchListing) {
  return [...(listing.categories ?? [])].reverse().find((category) => category.slug)?.slug ?? "listing";
}

function sourceUrlFor(listing: SeniorGuruSearchListing) {
  return `${currentSiteBaseUrl}/listing/${categorySlugFor(listing)}/${listing.slug ?? listing.id}`;
}

function careTypesFor(listing: SeniorGuruSearchListing) {
  const haystack = `${listing.title ?? ""} ${textFromHtml(listing.description)}`.toLowerCase();
  const careTypePatterns: Array<[string, RegExp]> = [
    ["Independent Living", /independent living/],
    ["Assisted Living", /assisted living/],
    ["Memory Care", /memory care|dementia|alzheimer/],
    ["Home Care", /home care|companion care|caregiver/],
    ["Home Health", /home health/],
    ["Hospice", /hospice/],
    ["Senior Apartments", /apartment|55 plus|55\+/],
    ["Adult Day Care", /adult day/]
  ];
  const careTypes = careTypePatterns
    .filter(([, pattern]) => pattern.test(haystack))
    .map(([label]) => label);

  return [...new Set(careTypes.length > 0 ? careTypes : (listing.categories ?? []).map((category) => category.name).filter(Boolean) as string[])];
}

function amenitiesFor(listing: SeniorGuruSearchListing) {
  const text = textFromHtml(listing.description);
  const candidates = [
    "Dining",
    "Transportation",
    "Fitness",
    "Salon",
    "Spa",
    "Outdoor",
    "Garden",
    "Movie theater",
    "Cafe",
    "Private dining",
    "Daily programs",
    "Medication",
    "Meals"
  ];

  return candidates.filter((candidate) => text.toLowerCase().includes(candidate.toLowerCase()));
}

function mapCurrentSiteListing(listing: SeniorGuruSearchListing, policy: PublicSourcePolicy, acquiredAt: string): ImportRecordInput | null {
  if (!listing.title || !listing.city?.name || !listing.state?.name) {
    return null;
  }

  const sourceUrl = sourceUrlFor(listing);
  const categories = (listing.categories ?? []).map((category) => category.name).filter(Boolean) as string[];
  const imageAssets: StagedListingImageRecord[] = (listing.files ?? [])
    .flatMap((file, index): StagedListingImageRecord[] => file.filename ? [{
      url: file.filename,
      sourceUrl,
      fetchedAt: acquiredAt,
      licenseTermsStatus: policy.licenseTermsStatus,
      robotsDecision: policy.robotsDecision,
      reviewStatus: "pending_review" as const,
      storageStatus: "not_stored" as const,
      altText: `${listing.title} source image ${index + 1}`,
      ordinal: index + 1
    }] : []);
  const description = textFromHtml(listing.description);
  const state = stateAbbreviations[listing.state.name] ?? listing.state.name;
  const price = Number(listing.price ?? 0);

  return {
    name: listing.title,
    categories: [...new Set(categories)],
    careTypes: careTypesFor(listing),
    addressLine1: listing.address ?? undefined,
    city: listing.city.name,
    state,
    postalCode: listing.zip ?? undefined,
    latitude: listing.lati ? Number(listing.lati) : undefined,
    longitude: listing.longi ? Number(listing.longi) : undefined,
    phone: listing.phone ?? undefined,
    email: listing.email ?? undefined,
    websiteUrl: listing.website ?? sourceUrl,
    description,
    amenities: amenitiesFor(listing),
    services: careTypesFor(listing),
    pricingSignals: {
      monthlyStartingAt: price > 0 ? price : undefined,
      currency: "USD",
      sourceLabel: "current theseniorguru.com public listing"
    },
    licenseFields: {
      sourceListingId: listing.id,
      claimStatus: "source_public_listing",
      sourceStatus: "active_public_listing"
    },
    accreditationFields: {
      reviewsAverage: listing.reviewsavg ?? 0,
      reviewsCount: listing.reviewcount ?? 0
    },
    sourceUrl,
    sourceRecordId: listing.id ? `theseniorguru-current-${listing.id}` : sourceUrl,
    fetchedAt: acquiredAt,
    licenseTermsStatus: policy.licenseTermsStatus,
    robotsDecision: policy.robotsDecision,
    extractionConfidence: 0.91,
    confidenceScore: 0.91,
    duplicateMatchData: { sourceListingId: listing.id, slug: listing.slug, duplicateCheckKey: duplicateSignature({
      sourceRecordId: String(listing.id ?? sourceUrl),
      name: listing.title,
      categories,
      careTypes: careTypesFor(listing),
      addressLine1: listing.address ?? "",
      city: listing.city.name,
      state,
      postalCode: listing.zip ?? "",
      county: "",
      phone: listing.phone ?? undefined
    }) },
    imageAssets,
    auditTrail: [
      {
        at: acquiredAt,
        actor: "real-public-source-acquisition-worker",
        action: "robots_checked",
        notes: `robots=${policy.robotsDecision}`
      },
      {
        at: acquiredAt,
        actor: "real-public-source-acquisition-worker",
        action: "public_listing_json_imported",
        notes: "Imported from the public theseniorguru.com search-listing endpoint using a normal public session token."
      },
      {
        at: acquiredAt,
        actor: "real-public-source-acquisition-worker",
        action: "images_marked_enrichment_later",
        notes: "Image URLs are staged as source metadata only; storage/reuse review remains pending."
      }
    ],
    rawPayload: {
      adapterKind: policy.adapterKind,
      sourceName: policy.sourceName,
      listing
    },
    extractedFields: {
      sourceName: policy.sourceName,
      sourceUrl,
      categorySlug: categorySlugFor(listing),
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      imageCount: imageAssets.length,
      country: listing.country?.name,
      countryCode: listing.country?.sortname
    }
  };
}

export async function runCurrentSiteRealListingAcquisition(input: {
  actorId?: string;
  dryRun?: boolean;
  maxRecords?: number;
  order?: "asc" | "desc";
} = {}): Promise<PublicSourceAcquisitionRunResult & { discoveredListings: number; skippedRecords: number }> {
  const preview = await previewCurrentSiteRealListings({
    maxRecords: input.maxRecords,
    order: input.order
  });
  const records = preview.records;
  const [policy] = preview.sourcePolicies;

  if (!policy || policy.robotsDecision !== "allowed") {
    throw new Error("Current TheSeniorGuru.com robots.txt does not allow public listing acquisition.");
  }
  const batch = await createImportBatch({
    name: "Current TheSeniorGuru.com real public listing acquisition batch",
    sourceKind: "manual",
    estimatedRecords: records.length
  });
  const run = await runImportBatch(batch.id, {
    records,
    actorId: input.actorId,
    dryRun: input.dryRun ?? false
  });

  return {
    generatedAt: preview.generatedAt,
    batchId: batch.id,
    status: run.status,
    dryRun: run.dryRun,
    sourceCount: 1,
    discoveredListings: preview.discoveredListings,
    totalRecords: run.totalRecords,
    stagedRecords: run.stagedRecords,
    rejectedRecords: run.rejectedRecords,
    errorRecords: run.errorRecords,
    sourceCoverage: run.sourceCoverage,
    skippedRecords: preview.skippedRecords + run.skippedRecords,
    imageCoverage: preview.imageCoverage,
    qualityGaps: preview.qualityGaps,
    sourcePolicies: preview.sourcePolicies,
    importErrors: run.errors,
    nextActions: [
      "Apply the public-source acquisition staging migration in production Supabase before live persisted runs.",
      "Confirm owner policy for reusing/storing current-site media; until then image URLs remain pending enrichment-later metadata.",
      "Add official state/CMS directory adapters after source terms/API approvals are confirmed."
    ]
  };
}

export async function previewCurrentSiteRealListings(input: {
  maxRecords?: number;
  order?: "asc" | "desc";
} = {}): Promise<CurrentSiteRealListingPreviewResult> {
  const maxRecords = Math.max(1, Math.min(Number(input.maxRecords ?? 50), 250));
  const acquiredAt = nowIso();
  const robots = await fetchCurrentSiteRobotsDecision();
  const policy: PublicSourcePolicy = {
    sourceName: "TheSeniorGuru.com current public listing index",
    sourceUrl: `${currentSiteBaseUrl}/search`,
    adapterKind: "current_site_json",
    licenseTermsStatus: "owned_public_site",
    robotsDecision: robots.decision,
    termsNotes:
      "Current TheSeniorGuru.com public listing pages and search-listing JSON. Images are staged for enrichment/storage review, not published by hotlinking."
  };

  if (robots.decision !== "allowed") {
    throw new Error("Current TheSeniorGuru.com robots.txt does not allow public listing acquisition.");
  }

  const session = await fetchCurrentSiteSearchSession();
  const listings: SeniorGuruSearchListing[] = [];
  let skip = 0;
  let totalCount = 0;

  while (listings.length < maxRecords) {
    const page = await fetchCurrentSiteListingsPage({
      ...session,
      skip,
      order: input.order ?? "desc"
    });

    totalCount = page.totalCount;
    listings.push(...page.listings);

    if (page.count < 1 || page.listings.length < 1) {
      break;
    }

    skip += page.count;
  }

  const requested = listings.slice(0, maxRecords);
  const records = requested
    .map((listing) => mapCurrentSiteListing(listing, policy, acquiredAt))
    .filter((record): record is ImportRecordInput => Boolean(record));
  const qualityGaps = records.map(qualityGapsFor).filter((gap): gap is QualityGap => Boolean(gap));
  const totalImages = records.reduce((sum, record) => sum + (record.imageAssets?.length ?? 0), 0);
  const listingsWithThreeImages = records.filter((record) => (record.imageAssets?.length ?? 0) >= 3).length;

  return {
    generatedAt: acquiredAt,
    sourceCount: 1,
    discoveredListings: totalCount,
    requestedRecords: requested.length,
    parsedRecords: records.length,
    skippedRecords: requested.length - records.length,
    imageCoverage: {
      listingsWithThreeImages,
      listingsMissingThreeImages: records.length - listingsWithThreeImages,
      averageImagesPerListing: Number((totalImages / Math.max(records.length, 1)).toFixed(2))
    },
    qualityGaps,
    sourcePolicies: [policy],
    records
  };
}

function duplicateSignature(seed: PublicSourceListingSeed) {
  return [seed.name, seed.addressLine1, seed.city, seed.state, seed.phone]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .replace(/[^a-z0-9|]+/g, " ")
    .trim();
}

async function buildRecords() {
  const records: ImportRecordInput[] = [];
  const seen = new Map<string, string>();

  for (const adapter of adapters) {
    const seeds = await adapter.load();

    for (const seed of seeds) {
      const signature = duplicateSignature(seed);
      const duplicateOf = seen.get(signature);
      seen.set(signature, seed.sourceRecordId);

      records.push({
        ...seed,
        sourceUrl: adapter.policy.sourceUrl,
        fetchedAt,
        licenseTermsStatus: adapter.policy.licenseTermsStatus,
        robotsDecision: adapter.policy.robotsDecision,
        extractionConfidence: 0.86,
        confidenceScore: duplicateOf ? 0.62 : 0.86,
        duplicateMatchData: duplicateOf
          ? { candidateSourceRecordId: duplicateOf, matchScore: 0.97, reasons: ["same_name_address_phone"] }
          : { candidateSourceRecordId: null, matchScore: 0, reasons: [] },
        imageAssets: imageAssetsFor(seed, adapter.policy),
        auditTrail: auditTrailFor(adapter.policy),
        rawPayload: {
          adapterKind: adapter.policy.adapterKind,
          sourceName: adapter.policy.sourceName,
          seed
        },
        extractedFields: {
          sourceName: adapter.policy.sourceName,
          sourceRecordId: seed.sourceRecordId,
          termsNotes: adapter.policy.termsNotes
        }
      });
    }
  }

  return records;
}

export async function runPublicSourceSampleAcquisition(input: {
  actorId?: string;
  dryRun?: boolean;
} = {}): Promise<PublicSourceAcquisitionRunResult> {
  const records = await buildRecords();
  const batch = await createImportBatch({
    dataSourceId: "seed-cms-care-compare",
    name: "Public-source sample acquisition staging batch",
    sourceKind: "cms",
    estimatedRecords: records.length
  });
  const run = await runImportBatch(batch.id, {
    records,
    actorId: input.actorId,
    dryRun: input.dryRun ?? false
  });
  const qualityGaps = records.map(qualityGapsFor).filter((gap): gap is QualityGap => Boolean(gap));
  const totalImages = records.reduce((sum, record) => sum + (record.imageAssets?.length ?? 0), 0);
  const listingsWithThreeImages = records.filter((record) => (record.imageAssets?.length ?? 0) >= 3).length;

  return {
    generatedAt: new Date().toISOString(),
    batchId: batch.id,
    status: run.status,
    dryRun: run.dryRun,
    sourceCount: adapters.length,
    totalRecords: run.totalRecords,
    stagedRecords: run.stagedRecords,
    skippedRecords: run.skippedRecords,
    rejectedRecords: run.rejectedRecords,
    errorRecords: run.errorRecords,
    sourceCoverage: run.sourceCoverage,
    imageCoverage: {
      listingsWithThreeImages,
      listingsMissingThreeImages: records.length - listingsWithThreeImages,
      averageImagesPerListing: Number((totalImages / Math.max(records.length, 1)).toFixed(2))
    },
    qualityGaps,
    sourcePolicies: adapters.map((adapter) => adapter.policy),
    importErrors: run.errors,
    nextActions: [
      "Register each production source with terms, license, robots, and owner approval before live ingestion.",
      "Add state licensing/API/CSV adapters behind the same staging contract.",
      "Route staged images to storage review before any published profile media use."
    ]
  };
}
