import { NextResponse } from "next/server";
import { getAggregationLaunchReadiness } from "@/lib/aggregation/launch-readiness";
import { getDataSourceApprovalQueue } from "@/lib/data-sources";
import type { DataSourceApprovalQueueItem } from "@/lib/domain/providers";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

function countBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  return Object.entries(
    items.reduce<Record<string, number>>((counts, item) => {
      const key = getKey(item);

      if (key) {
        counts[key] = (counts[key] ?? 0) + 1;
      }

      return counts;
    }, {})
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function allSourceQueueItems(queues: Awaited<ReturnType<typeof getDataSourceApprovalQueue>>["queues"]) {
  return [
    ...queues.pending,
    ...queues.needsLegalReview,
    ...queues.blocked,
    ...queues.approved
  ] satisfies DataSourceApprovalQueueItem[];
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "providers:read", {
      eventType: "partner.aggregation.readiness",
      subjectType: "aggregation_readiness"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const [readiness, sourceQueue] = await Promise.all([
      getAggregationLaunchReadiness(),
      getDataSourceApprovalQueue()
    ]);
    const sourceItems = allSourceQueueItems(sourceQueue.queues);

    return NextResponse.json(
      {
        data: {
          generatedAt: readiness.generatedAt,
          status: readiness.status,
          launchTarget: readiness.launchTarget,
          progress: readiness.progress,
          sources: {
            totals: sourceQueue.totals,
            byType: countBy(sourceItems, (source) => source.sourceType),
            byRiskLevel: countBy(sourceItems, (source) => source.riskLevel),
            readyForImport: sourceQueue.totals.readyForImport
          },
          imports: readiness.imports,
          crawlers: {
            total: readiness.crawlers.total,
            runnable: readiness.crawlers.runnable,
            completed: readiness.crawlers.completed,
            pagesSeen: readiness.crawlers.pagesSeen,
            pagesImported: readiness.crawlers.pagesImported
          },
          quality: {
            unresolvedFlags: readiness.quality.unresolvedFlags,
            highOrCritical: readiness.quality.highOrCritical
          },
          blockers: readiness.blockers.map((blocker) => ({
            key: blocker.key,
            severity: blocker.severity,
            owner: blocker.owner,
            message: blocker.message
          })),
          nextActions: readiness.nextActions
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            aggregateReadinessOnly: true,
            sourceIdsExcluded: true,
            sourceBaseUrlsExcluded: true,
            sourceTermsNotesExcluded: true,
            sourceQueueRowsExcluded: true,
            importBatchRowsExcluded: true,
            crawlJobRowsExcluded: true,
            qualityFlagRowsExcluded: true,
            policyDecisionExcluded: true
          },
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
