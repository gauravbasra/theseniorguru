import { createImportBatch } from "@/lib/import-batches";
import { runImportBatch } from "@/lib/aggregation/import-worker";
import type { ImportRecordInput } from "@/lib/domain/imports";
import type { StagedListingAuditEvent, StagedListingImageRecord } from "@/lib/domain/entities";

type AdapterKind = "official_csv" | "official_api" | "open_directory_page" | "rss" | "manual_seed";

type PublicSourcePolicy = {
  sourceName: string;
  sourceUrl: string;
  adapterKind: AdapterKind;
  licenseTermsStatus: "approved_seed_sample" | "requires_owner_review" | "approved_open_data" | "blocked";
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
  rejectedRecords: number;
  errorRecords: number;
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

  if ((record.imageAssets?.length ?? 0) < 3) {
    gaps.push("fewer_than_three_images");
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
    rejectedRecords: run.rejectedRecords,
    errorRecords: run.errorRecords,
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
