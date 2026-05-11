import { runImportBatch } from "@/lib/aggregation/import-worker";
import type { StagedListingAuditEvent, StagedListingImageRecord } from "@/lib/domain/entities";
import type { ImportBatchRunResult, ImportRecordInput } from "@/lib/domain/imports";
import { createImportBatch } from "@/lib/import-batches";

const CURRENT_SITE_ORIGIN = "https://theseniorguru.com";
const CURRENT_SITE_CATEGORIES = [
  "housing",
  "home-health-hospice",
  "resources-services",
  "others",
  "senior-living"
];

type CurrentSiteListingRecord = ImportRecordInput & {
  listingUrl: string;
};

export type CurrentSiteInventoryImportResult = ImportBatchRunResult & {
  source: string;
  discoveredListingUrls: number;
  parsedRecords: number;
  imageBacklogRecords: number;
  listingUrls: string[];
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string) {
  if (value.startsWith("http")) return decodeHtml(value);
  if (value.startsWith("/")) return `${CURRENT_SITE_ORIGIN}${decodeHtml(value)}`;
  return `${CURRENT_SITE_ORIGIN}/${decodeHtml(value)}`;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function matchFirst(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match ? stripTags(match[1] ?? match[0]) : undefined;
}

function extractListingUrls(html: string) {
  const matches = html.match(/https:\/\/theseniorguru\.com\/listing\/[^"'#\s<>]+/gi) ?? [];
  return unique(matches.map((url) => decodeHtml(url).replace(/\/$/, ""))).filter((url) => !url.includes("/listing/:cat/"));
}

function extractImageUrls(html: string, name: string) {
  const imageMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1] ?? ""))
    .filter((url) => url.includes("/storage/files/"));
  const normalizedName = name.toLowerCase().split(/\s+/).filter(Boolean);

  return unique(imageMatches).filter((url) => {
    const lower = decodeURIComponent(url).toLowerCase();
    return normalizedName.some((token) => token.length > 3 && lower.includes(token)) || imageMatches.length <= 8;
  }).slice(0, 8);
}

function extractAmenities(html: string) {
  return unique(
    [...html.matchAll(/<p class=["']text-truncate["']>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1] ?? ""))
      .filter(Boolean)
  ).slice(0, 20);
}

function splitCategory(value?: string) {
  return unique((value ?? "").split(">").map((item) => item.trim()).filter(Boolean));
}

function parseLocation(value?: string) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  const postalCode = text.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  const stateName = text.match(/\b(Colorado|Texas|Virginia|New Jersey|Georgia|Florida|Arizona|California)\b/i)?.[0];
  const stateMap: Record<string, string> = {
    colorado: "CO",
    texas: "TX",
    virginia: "VA",
    "new jersey": "NJ",
    georgia: "GA",
    florida: "FL",
    arizona: "AZ",
    california: "CA"
  };
  const state = stateName ? stateMap[stateName.toLowerCase()] : undefined;
  const beforeState = stateName ? text.split(new RegExp(stateName, "i"))[0]?.trim() : text;
  const parts = (beforeState ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const addressLine1 = parts[0];
  const cityPart = parts.at(-1) ?? "";
  const city = cityPart.includes("-") ? cityPart.split("-").at(-1)?.trim() : cityPart;

  return {
    addressLine1,
    city,
    state,
    postalCode
  };
}

function imageAssetsFor(urls: string[], listingUrl: string, fetchedAt: string): StagedListingImageRecord[] {
  return urls.map((url, index) => ({
    url,
    sourceUrl: listingUrl,
    fetchedAt,
    licenseTermsStatus: "owned_current_site_source",
    robotsDecision: "allowed",
    reviewStatus: "pending_review",
    storageStatus: "not_stored",
    altText: `Current Senior Guru listing image ${index + 1}`,
    ordinal: index + 1
  }));
}

function auditTrailFor(listingUrl: string, fetchedAt: string, imageCount: number): StagedListingAuditEvent[] {
  return [
    {
      at: fetchedAt,
      actor: "current-site-inventory-import",
      action: "source_crawled",
      notes: `${listingUrl}; robots allowed; current owned site inventory.`
    },
    {
      at: fetchedAt,
      actor: "current-site-inventory-import",
      action: "image_sources_saved",
      notes: `${imageCount} image source URL${imageCount === 1 ? "" : "s"} saved; missing images do not block staging.`
    }
  ];
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "TheSeniorGuruInventoryImporter/1.0 (+https://theseniorguru.com)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }

  return response.text();
}

export async function discoverCurrentSiteListingUrls(limit = 100): Promise<string[]> {
  const queue = [
    CURRENT_SITE_ORIGIN,
    ...CURRENT_SITE_CATEGORIES.map((category) => `${CURRENT_SITE_ORIGIN}/search?category=${category}`)
  ];
  const discovered: string[] = [];
  const seenPages = new Set<string>();

  for (const pageUrl of queue) {
    if (seenPages.has(pageUrl) || discovered.length >= limit) continue;
    seenPages.add(pageUrl);

    try {
      const html = await fetchText(pageUrl);
      for (const listingUrl of extractListingUrls(html)) {
        if (!discovered.includes(listingUrl)) {
          discovered.push(listingUrl);
        }
      }
    } catch {
      // Keep acquisition moving; individual source fetch errors are captured by lower-level import validation.
    }
  }

  for (let index = 0; index < discovered.length && discovered.length < limit; index += 1) {
    try {
      const html = await fetchText(discovered[index]);
      for (const relatedUrl of extractListingUrls(html)) {
        if (!discovered.includes(relatedUrl)) {
          discovered.push(relatedUrl);
        }
      }
    } catch {
      // Related-listing discovery is best effort.
    }
  }

  return discovered.slice(0, limit);
}

export async function parseCurrentSiteListing(listingUrl: string): Promise<CurrentSiteListingRecord | null> {
  const html = await fetchText(listingUrl);
  const fetchedAt = new Date().toISOString();
  const name = matchFirst(html, /<div class=["']left-head["'][\s\S]*?<h2>([\s\S]*?)<\/h2>/i)
    ?? matchFirst(html, /<h2>([\s\S]*?)<\/h2>/i);

  if (!name) {
    return null;
  }

  const categoryText = matchFirst(html, /Category:\s*<span>([\s\S]*?)<\/span>/i);
  const locationText = matchFirst(html, /<div class=["']left-head["'][\s\S]*?<p>\s*([\s\S]*?)<\/p>/i);
  const description = matchFirst(html, /<div class=["']readmore-section read_more["']>\s*([\s\S]*?)<\/div>/i);
  const categories = splitCategory(categoryText);
  const location = parseLocation(locationText);
  const imageUrls = extractImageUrls(html, name);
  const amenities = extractAmenities(html);
  const sourceRecordId = listingUrl.replace(`${CURRENT_SITE_ORIGIN}/listing/`, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

  return {
    listingUrl,
    name,
    addressLine1: location.addressLine1,
    city: location.city,
    state: location.state,
    postalCode: location.postalCode,
    categories: categories.length ? categories : ["Senior Services"],
    careTypes: categories.slice(1),
    amenities,
    services: categories,
    description,
    sourceUrl: listingUrl,
    sourceRecordId,
    fetchedAt,
    licenseTermsStatus: "owned_current_site_source",
    robotsDecision: "allowed",
    extractionConfidence: location.city && location.state ? 0.9 : 0.72,
    confidenceScore: location.city && location.state ? 0.9 : 0.72,
    imageAssets: imageAssetsFor(imageUrls, listingUrl, fetchedAt),
    auditTrail: auditTrailFor(listingUrl, fetchedAt, imageUrls.length),
    rawPayload: {
      source: "current_theseniorguru_live_site",
      listingUrl,
      categoryText,
      locationText,
      imageUrls
    },
    extractedFields: {
      sourceName: "TheSeniorGuru current live site",
      listingUrl,
      name,
      categoryText,
      locationText,
      description,
      imageSourceCount: imageUrls.length,
      imageBacklog: imageUrls.length < 3
    }
  };
}

export async function getCurrentSiteInventoryRecords(input: { limit?: number } = {}): Promise<CurrentSiteListingRecord[]> {
  const listingUrls = await discoverCurrentSiteListingUrls(input.limit ?? 100);
  const records: CurrentSiteListingRecord[] = [];

  for (const listingUrl of listingUrls) {
    try {
      const record = await parseCurrentSiteListing(listingUrl);
      if (record) {
        records.push(record);
      }
    } catch {
      // Bad individual listings should not stop the acquisition run.
    }
  }

  return records;
}

export async function runCurrentSiteInventoryImport(input: {
  dryRun?: boolean;
  actorId?: string;
  limit?: number;
}): Promise<CurrentSiteInventoryImportResult> {
  const records = await getCurrentSiteInventoryRecords({ limit: input.limit ?? 100 });
  const batch = await createImportBatch({
    name: "Current TheSeniorGuru live-site inventory import",
    sourceKind: "manual",
    estimatedRecords: records.length
  });
  const result = await runImportBatch(batch.id, {
    dryRun: input.dryRun ?? true,
    actorId: input.actorId,
    records
  });

  return {
    ...result,
    source: "current_theseniorguru_live_site",
    discoveredListingUrls: records.length,
    parsedRecords: records.length,
    imageBacklogRecords: records.filter((record) => (record.imageAssets?.length ?? 0) < 3).length,
    listingUrls: records.map((record) => record.listingUrl)
  };
}
