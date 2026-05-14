import { listDataSources } from "@/lib/data-sources";
import { createExtractedEntity } from "@/lib/aggregation/extracted-entities";
import { getCrawlJobById, listCrawlJobs, listCrawlPages } from "@/lib/aggregation/crawl-jobs";
import type { DataSourceRecord } from "@/lib/domain/providers";
import type {
  CrawlJobRecord,
  CrawlPageRecord,
  ProviderWebsiteParserCandidate,
  ProviderWebsiteParserReadinessSource,
  ProviderWebsiteParserReadinessSummary,
  ProviderWebsiteParserRunResult
} from "@/lib/domain/imports";

type RunProviderWebsiteParserInput = {
  crawlJobId: string;
  dryRun?: boolean;
  actorId?: string;
  minConfidence?: number;
};

const categoryKeywords = [
  { keyword: "assisted living", category: "Assisted Living" },
  { keyword: "memory care", category: "Memory Care" },
  { keyword: "home care", category: "Home Care" },
  { keyword: "adult day", category: "Adult Day Care" },
  { keyword: "senior apartment", category: "Senior Apartments" },
  { keyword: "independent living", category: "Independent Living" },
  { keyword: "skilled nursing", category: "Skilled Nursing" }
];

function sourceBlockers(source: DataSourceRecord) {
  return [
    ...(source.sourceType !== "provider_website" ? ["Data source is not a provider website source."] : []),
    ...(source.reviewStatus !== "approved" ? [`Data source review status is ${source.reviewStatus}, not approved.`] : []),
    ...(source.robotsStatus === "blocked" || source.robotsStatus === "disallowed" ? ["Robots policy blocks provider website parsing."] : []),
    ...(!source.baseUrl ? ["Data source is missing baseUrl."] : []),
    ...(!source.jurisdiction ? ["Data source is missing jurisdiction."] : []),
    ...(!source.termsNotes ? ["Data source is missing terms review notes."] : [])
  ];
}

function pageText(page: CrawlPageRecord) {
  return [page.title, page.extractedText].filter(Boolean).join("\n").trim();
}

function firstMatch(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.trim();
}

function normalizeTitle(title: string | undefined, source: DataSourceRecord) {
  const cleaned = title
    ?.replace(/\s*[-|]\s*(official site|home|senior living|assisted living).*$/i, "")
    .replace(/^dry-run crawl page$/i, "")
    .trim();

  return cleaned || source.name.replace(/\s+(website|source)$/i, "").trim();
}

function extractCategories(text: string) {
  const lower = text.toLowerCase();
  const categories = categoryKeywords
    .filter((item) => lower.includes(item.keyword))
    .map((item) => item.category);

  return categories.length ? Array.from(new Set(categories)) : ["Senior Living"];
}

function confidenceFor(candidate: Omit<ProviderWebsiteParserCandidate, "extractionConfidence">) {
  let score = 0.35;
  if (candidate.name) score += 0.2;
  if (candidate.websiteUrl) score += 0.1;
  if (candidate.phone || candidate.email) score += 0.12;
  if (candidate.addressLine1 || (candidate.city && candidate.state)) score += 0.14;
  if (candidate.description) score += 0.09;

  return Math.min(0.95, Number(score.toFixed(2)));
}

function buildCandidate(page: CrawlPageRecord, source: DataSourceRecord): ProviderWebsiteParserCandidate {
  const text = pageText(page);
  const phone = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0];
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const addressLine1 = text.match(/\d{2,6}\s+[A-Z0-9][A-Za-z0-9\s.'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Court|Ct|Boulevard|Blvd|Lane|Ln)\b/i)?.[0];
  const cityState = text.match(/\b([A-Z][a-zA-Z .'-]+),\s*([A-Z]{2})\b/);
  const description = text.replace(/\s+/g, " ").slice(0, 320) || undefined;
  const candidateBase = {
    crawlPageId: page.id,
    sourceUrl: page.url,
    sourceRecordId: `${source.id}:${page.id}`,
    name: normalizeTitle(page.title, source),
    phone,
    email,
    websiteUrl: page.url,
    addressLine1,
    city: cityState?.[1],
    state: cityState?.[2] ?? (source.jurisdiction?.length === 2 ? source.jurisdiction : undefined),
    categories: extractCategories(text),
    description,
    blockers: [] as string[],
    extractedFields: {
      parser: "provider_website_v1",
      sourceType: source.sourceType,
      contentHash: page.contentHash,
      statusCode: page.statusCode,
      title: page.title,
      textLength: text.length
    }
  };
  const extractionConfidence = confidenceFor(candidateBase);
  const blockers = [
    ...(!candidateBase.name ? ["Parser could not infer provider name."] : []),
    ...(!candidateBase.websiteUrl ? ["Parser could not infer provider website URL."] : []),
    ...(page.statusCode && page.statusCode >= 400 ? [`Crawl page returned HTTP ${page.statusCode}.`] : []),
    ...(extractionConfidence < 0.55 ? ["Parser confidence is below staging threshold."] : [])
  ];

  return {
    ...candidateBase,
    extractionConfidence,
    blockers
  };
}

function buildSourceReadiness(
  source: DataSourceRecord,
  jobs: CrawlJobRecord[],
  pages: CrawlPageRecord[]
): ProviderWebsiteParserReadinessSource {
  const completedJobs = jobs.filter((job) => job.dataSourceId === source.id && job.status === "completed");
  const stagedPages = pages.filter((page) => completedJobs.some((job) => job.id === page.crawlJobId));
  const blockers = [
    ...sourceBlockers(source),
    ...(!completedJobs.length ? ["No completed crawl job is available for parser input."] : []),
    ...(!stagedPages.length ? ["No staged crawl pages are available for parser input."] : [])
  ];

  return {
    dataSourceId: source.id,
    dataSourceName: source.name,
    status: blockers.length ? "blocked" : "ready",
    baseUrl: source.baseUrl,
    reviewStatus: source.reviewStatus,
    robotsStatus: source.robotsStatus,
    completedCrawlJobs: completedJobs.length,
    stagedPages: stagedPages.length,
    blockers,
    nextActions: blockers.length
      ? ["Approve source terms, run a crawl job, and review staged crawl pages before extraction."]
      : ["Run the provider website parser in dry-run mode, then stage extracted entities for review."]
  };
}

export async function getProviderWebsiteParserReadiness(): Promise<ProviderWebsiteParserReadinessSummary> {
  const [sources, jobs, pages] = await Promise.all([listDataSources(), listCrawlJobs(), listCrawlPages()]);
  const providerSources = sources.filter((source) => source.sourceType === "provider_website");
  const sourceSummaries = providerSources.map((source) => buildSourceReadiness(source, jobs, pages));
  const blockers = sourceSummaries.flatMap((source) =>
    source.blockers.map((blocker) => `${source.dataSourceName}: ${blocker}`)
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      providerWebsiteSources: providerSources.length,
      ready: sourceSummaries.filter((source) => source.status === "ready").length,
      blocked: sourceSummaries.filter((source) => source.status === "blocked").length,
      completedCrawlJobs: jobs.filter((job) =>
        providerSources.some((source) => source.id === job.dataSourceId && job.status === "completed")
      ).length,
      stagedPages: sourceSummaries.reduce((total, source) => total + source.stagedPages, 0)
    },
    sources: sourceSummaries,
    blockers,
    nextActions: [
      ...(sourceSummaries.some((source) => source.status === "ready")
        ? ["Run parser dry-runs for ready provider website sources before staging entities."]
        : []),
      ...(blockers.length
        ? ["Resolve source approval, robots, crawl completion, and staged page blockers before unattended parsing."]
        : []),
      ...(!providerSources.length ? ["Register approved provider website data sources before parser readiness can be evaluated."] : [])
    ]
  };
}

export async function runProviderWebsiteParser(
  input: RunProviderWebsiteParserInput
): Promise<ProviderWebsiteParserRunResult> {
  const dryRun = input.dryRun ?? true;
  const minConfidence = input.minConfidence ?? 0.55;
  const job = await getCrawlJobById(input.crawlJobId);

  if (!job) {
    throw new Error("Crawl job not found");
  }

  if (job.status !== "completed") {
    throw new Error("Provider website parser requires a completed crawl job");
  }

  const source = (await listDataSources()).find((item) => item.id === job.dataSourceId);

  if (!source) {
    throw new Error("Data source not found");
  }

  const blockers = sourceBlockers(source);

  if (blockers.length) {
    throw new Error(blockers[0]);
  }

  const pages = await listCrawlPages(job.id);
  const candidates = pages.map((page) => buildCandidate(page, source));
  const stageable = candidates.filter(
    (candidate) => !candidate.blockers.length && candidate.extractionConfidence >= minConfidence
  );
  const stagedEntityIds: string[] = [];

  if (!dryRun) {
    for (const candidate of stageable) {
      const entity = await createExtractedEntity({
        crawlPageId: candidate.crawlPageId,
        name: candidate.name ?? source.name,
        phone: candidate.phone,
        email: candidate.email,
        websiteUrl: candidate.websiteUrl,
        addressLine1: candidate.addressLine1,
        city: candidate.city,
        state: candidate.state,
        categories: candidate.categories,
        description: candidate.description,
        sourceUrl: candidate.sourceUrl,
        sourceRecordId: candidate.sourceRecordId,
        fetchedAt: new Date().toISOString(),
        licenseTermsStatus: source.termsNotes,
        robotsDecision: source.robotsStatus ?? job.robotsDecision,
        extractionConfidence: candidate.extractionConfidence,
        confidenceScore: candidate.extractionConfidence,
        rawPayload: { crawlJobId: job.id, dataSourceId: source.id, parser: "provider_website_v1" },
        extractedFields: candidate.extractedFields,
        auditTrail: [
          {
            at: new Date().toISOString(),
            actor: input.actorId ?? "provider-website-parser",
            action: "provider_website_parser_staged",
            notes: "Provider website parser staged entity from completed crawl page."
          }
        ]
      });
      stagedEntityIds.push(entity.id);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    crawlJobId: job.id,
    dataSourceId: source.id,
    dataSourceName: source.name,
    dryRun,
    pagesReviewed: pages.length,
    candidatesFound: candidates.length,
    stagedEntities: dryRun ? 0 : stagedEntityIds.length,
    rejectedCandidates: candidates.filter((candidate) => candidate.blockers.length).length,
    candidates,
    stagedEntityIds,
    blockers: candidates.flatMap((candidate) =>
      candidate.blockers.map((blocker) => `${candidate.sourceUrl}: ${blocker}`)
    ),
    nextActions: [
      ...(!pages.length ? ["Run or repair the crawl job before parser execution."] : []),
      ...(dryRun && stageable.length ? ["Review dry-run candidates, then run with dryRun=false to stage entities."] : []),
      ...(!dryRun && stagedEntityIds.length ? ["Review staged entities in the extracted entity review queue."] : []),
      ...(candidates.some((candidate) => candidate.blockers.length)
        ? ["Review rejected parser candidates and adjust source-specific extraction rules before launch scale-up."]
        : [])
    ]
  };
}
