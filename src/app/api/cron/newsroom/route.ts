import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import { runScheduledRssImports } from "@/lib/newsroom/newsroom";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

function parseLimit(value?: string) {
  const parsed = Number(value ?? 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 25)) : 10;
}

const previewItems = [
  {
    title: "Preview RSS: memory care comparison signals",
    link: "https://theseniorguru.com/articles/memory-care-tour-questions-families-should-ask-before-they-feel-rushed",
    summary: "Dry-run editorial intake item for checking memory care family guidance and source workflow readiness."
  },
  {
    title: "Preview RSS: senior living event trust signals",
    link: "https://theseniorguru.com/events/preview-senior-living-trust",
    summary: "Dry-run editorial intake item for checking local event, sponsorship disclosure, and caregiver reminder coverage."
  }
];

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const env = getAppEnv();
    const mode = env.newsroomRssCronMode === "live" ? "live" : "preview";
    const rssRun = await runScheduledRssImports({
      dryRun: mode !== "live",
      limit: parseLimit(env.newsroomRssCronLimit),
      items: mode === "live" ? undefined : previewItems
    });
    const workerRun = await recordScheduledWorkerRun({
      workerKey: "cron:newsroom-rss",
      status: "succeeded",
      startedAt,
      summary: {
        mode,
        dryRun: rssRun.dryRun,
        sourceCount: rssRun.sourceCount,
        processed: rssRun.processed,
        staged: rssRun.staged,
        blocked: rssRun.blocked,
        skipped: rssRun.skipped,
        skippedSources: rssRun.skippedSources.length
      }
    });

    return NextResponse.json({
      data: {
        mode,
        ranAt: workerRun.finishedAt,
        workerRun,
        rssRun
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:newsroom-rss",
      status: "failed",
      startedAt,
      summary: {},
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
