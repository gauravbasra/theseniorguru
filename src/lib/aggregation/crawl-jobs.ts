import crypto from "node:crypto";
import type {
  CrawlJobRecord,
  CrawlJobRunResult,
  CrawlPageRecord,
  CreateCrawlJobInput,
  DataQualityFlagRecord,
  RunCrawlJobInput
} from "@/lib/domain/imports";
import { listDataSources } from "@/lib/data-sources";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedCrawlJobs: CrawlJobRecord[] = [];
const seedCrawlPages: CrawlPageRecord[] = [];
const seedDataQualityFlags: DataQualityFlagRecord[] = [];

function mapCrawlJob(row: Record<string, unknown>): CrawlJobRecord {
  return {
    id: String(row.id),
    dataSourceId: String(row.data_source_id),
    status: row.status as CrawlJobRecord["status"],
    seedUrl: String(row.seed_url),
    maxPages: Number(row.max_pages ?? 50),
    pagesSeen: Number(row.pages_seen ?? 0),
    pagesImported: Number(row.pages_imported ?? 0),
    robotsDecision: row.robots_decision ? String(row.robots_decision) : undefined,
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    startedAt: row.started_at ? String(row.started_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapCrawlPage(row: Record<string, unknown>): CrawlPageRecord {
  return {
    id: String(row.id),
    crawlJobId: String(row.crawl_job_id),
    url: String(row.url),
    statusCode: row.status_code ? Number(row.status_code) : undefined,
    contentHash: row.content_hash ? String(row.content_hash) : undefined,
    title: row.title ? String(row.title) : undefined,
    extractedText: row.extracted_text ? String(row.extracted_text) : undefined,
    fetchedAt: String(row.fetched_at)
  };
}

function mapDataQualityFlag(row: Record<string, unknown>): DataQualityFlagRecord {
  return {
    id: String(row.id),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    severity: row.severity as DataQualityFlagRecord["severity"],
    flagKey: String(row.flag_key),
    message: String(row.message),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function assertHttpsUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("seedUrl must be a valid HTTPS URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("seedUrl must use HTTPS");
  }
}

async function getApprovedDataSource(dataSourceId: string) {
  const dataSource = (await listDataSources()).find((source) => source.id === dataSourceId);

  if (!dataSource) {
    throw new Error("Data source not found");
  }

  if (dataSource.reviewStatus !== "approved") {
    throw new Error("Crawler jobs require an approved data source");
  }

  return dataSource;
}

export async function listCrawlJobs(): Promise<CrawlJobRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCrawlJobs;
  }

  const { data, error } = await supabase.from("crawl_jobs").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Crawl job query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCrawlJob);
}

export async function createCrawlJob(input: CreateCrawlJobInput): Promise<CrawlJobRecord> {
  assertHttpsUrl(input.seedUrl);

  const dataSource = await getApprovedDataSource(input.dataSourceId);
  const policy = await runPolicyCheck({
    subjectType: "crawl_job",
    subjectId: input.dataSourceId,
    actionKey: "create_crawl_job",
    input: {
      ...input,
      sourceName: dataSource.name,
      robotsStatus: dataSource.robotsStatus,
      termsNotes: dataSource.termsNotes
    }
  });
  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "queued";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const record: CrawlJobRecord = {
      id: `crawl-job-${crypto.randomUUID()}`,
      dataSourceId: input.dataSourceId,
      status,
      seedUrl: input.seedUrl,
      maxPages: input.maxPages ?? 50,
      pagesSeen: 0,
      pagesImported: 0,
      robotsDecision: dataSource.robotsStatus ?? "approved_source",
      createdAt: now
    };
    seedCrawlJobs.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("crawl_jobs")
    .insert({
      data_source_id: input.dataSourceId,
      status,
      seed_url: input.seedUrl,
      max_pages: input.maxPages ?? 50,
      robots_decision: dataSource.robotsStatus ?? "approved_source"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Crawl job creation failed: ${error.message}`);
  }

  return mapCrawlJob(data);
}

async function getCrawlJob(crawlJobId: string) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCrawlJobs.find((job) => job.id === crawlJobId) ?? null;
  }

  const { data, error } = await supabase.from("crawl_jobs").select("*").eq("id", crawlJobId).maybeSingle();

  if (error) {
    throw new Error(`Crawl job lookup failed: ${error.message}`);
  }

  return data ? mapCrawlJob(data) : null;
}

export async function getCrawlJobById(crawlJobId: string): Promise<CrawlJobRecord | null> {
  return getCrawlJob(crawlJobId);
}

export async function listCrawlPages(crawlJobId?: string): Promise<CrawlPageRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return crawlJobId ? seedCrawlPages.filter((page) => page.crawlJobId === crawlJobId) : seedCrawlPages;
  }

  let query = supabase.from("crawl_pages").select("*").order("fetched_at", { ascending: false });

  if (crawlJobId) {
    query = query.eq("crawl_job_id", crawlJobId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Crawl page query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCrawlPage);
}

async function insertCrawlPage(input: Omit<CrawlPageRecord, "id" | "fetchedAt">): Promise<CrawlPageRecord> {
  const supabase = getSupabaseAdminClient();
  const fetchedAt = new Date().toISOString();

  if (!supabase) {
    const page: CrawlPageRecord = {
      id: `crawl-page-${crypto.randomUUID()}`,
      fetchedAt,
      ...input
    };
    seedCrawlPages.unshift(page);
    return page;
  }

  const { data, error } = await supabase
    .from("crawl_pages")
    .upsert(
      {
        crawl_job_id: input.crawlJobId,
        url: input.url,
        status_code: input.statusCode,
        content_hash: input.contentHash,
        title: input.title,
        extracted_text: input.extractedText
      },
      { onConflict: "crawl_job_id,url" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Crawl page upsert failed: ${error.message}`);
  }

  return mapCrawlPage(data);
}

async function updateCrawlJobStatus(input: {
  crawlJobId: string;
  status: CrawlJobRecord["status"];
  pagesSeen?: number;
  pagesImported?: number;
  errorMessage?: string;
}) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const job = seedCrawlJobs.find((item) => item.id === input.crawlJobId);

    if (job) {
      job.status = input.status;
      job.pagesSeen = input.pagesSeen ?? job.pagesSeen;
      job.pagesImported = input.pagesImported ?? job.pagesImported;
      job.errorMessage = input.errorMessage;
      job.startedAt = job.startedAt ?? now;
      job.completedAt = input.status === "completed" || input.status === "failed" ? now : job.completedAt;
    }

    return;
  }

  const { error } = await supabase
    .from("crawl_jobs")
    .update({
      status: input.status,
      pages_seen: input.pagesSeen,
      pages_imported: input.pagesImported,
      error_message: input.errorMessage,
      started_at: now,
      completed_at: input.status === "completed" || input.status === "failed" ? now : undefined
    })
    .eq("id", input.crawlJobId);

  if (error) {
    throw new Error(`Crawl job update failed: ${error.message}`);
  }
}

export async function runCrawlJob(crawlJobId: string, input: RunCrawlJobInput = {}): Promise<CrawlJobRunResult> {
  const job = await getCrawlJob(crawlJobId);

  if (!job) {
    throw new Error("Crawl job not found");
  }

  if (job.status === "blocked_by_policy") {
    throw new Error("Blocked crawl jobs cannot run");
  }

  await getApprovedDataSource(job.dataSourceId);

  const policy = await runPolicyCheck({
    subjectType: "crawl_job",
    subjectId: crawlJobId,
    actionKey: "run_crawl_job",
    input: {
      dryRun: input.dryRun ?? true,
      seedUrl: job.seedUrl,
      maxPages: job.maxPages
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    await updateCrawlJobStatus({ crawlJobId, status: "blocked_by_policy", errorMessage: policy.reasons[0] });
    throw new Error(policy.reasons[0] ?? "Crawl job blocked by policy");
  }

  await updateCrawlJobStatus({ crawlJobId, status: "running" });

  const dryRun = input.dryRun ?? true;
  const pages: CrawlPageRecord[] = [];
  const errors: string[] = [];

  try {
    if (dryRun) {
      pages.push(
        await insertCrawlPage({
          crawlJobId,
          url: job.seedUrl,
          statusCode: 200,
          contentHash: crypto.createHash("sha256").update(`dry-run:${job.seedUrl}`).digest("hex"),
          title: "Dry-run crawl page",
          extractedText: "Dry run validated source approval, policy gate, and page staging path."
        })
      );
    } else {
      const response = await fetch(job.seedUrl, { headers: { "user-agent": "TheSeniorGuru-Crawler/0.1" } });
      const text = await response.text();
      pages.push(
        await insertCrawlPage({
          crawlJobId,
          url: job.seedUrl,
          statusCode: response.status,
          contentHash: crypto.createHash("sha256").update(text).digest("hex"),
          title: job.seedUrl,
          extractedText: text.slice(0, 5000)
        })
      );

      if (!response.ok) {
        errors.push(`Seed URL returned HTTP ${response.status}`);
      }
    }

    const status = errors.length ? "failed" : "completed";
    await updateCrawlJobStatus({
      crawlJobId,
      status,
      pagesSeen: pages.length,
      pagesImported: pages.length,
      errorMessage: errors[0]
    });

    return {
      crawlJobId,
      status,
      dryRun,
      pagesSeen: pages.length,
      pagesImported: pages.length,
      pages,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl job failed";
    await updateCrawlJobStatus({ crawlJobId, status: "failed", errorMessage: message });

    return {
      crawlJobId,
      status: "failed",
      dryRun,
      pagesSeen: pages.length,
      pagesImported: pages.length,
      pages,
      errors: [message]
    };
  }
}

export async function listDataQualityFlags(): Promise<DataQualityFlagRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedDataQualityFlags;
  }

  const { data, error } = await supabase
    .from("data_quality_flags")
    .select("*")
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Data quality flags query failed: ${error.message}`);
  }

  return (data ?? []).map(mapDataQualityFlag);
}
