import { NextResponse } from "next/server";
import { getSupabaseLaunchReadiness } from "@/lib/system/supabase-launch-readiness";
import { getSupabaseMigrationBundle } from "@/lib/system/supabase-migration-bundle";
import {
  getLatestSupabaseActivationReview,
  recordSupabaseActivationReview
} from "@/lib/system/supabase-activation-review";

export async function GET() {
  try {
    const [readiness, latestActivationReview] = await Promise.all([
      getSupabaseLaunchReadiness(),
      getLatestSupabaseActivationReview()
    ]);

    return NextResponse.json({ data: { ...readiness, latestActivationReview } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recordSupabaseActivationReview({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      environment: typeof body.environment === "string" ? body.environment : undefined,
      reviewedBundleSha256: typeof body.reviewedBundleSha256 === "string" ? body.reviewedBundleSha256 : undefined,
      reviewedMigrationFiles: Array.isArray(body.reviewedMigrationFiles)
        ? body.reviewedMigrationFiles.filter((item): item is string => typeof item === "string")
        : undefined,
      envKeysConfirmed: Array.isArray(body.envKeysConfirmed)
        ? body.envKeysConfirmed.filter((item): item is string => typeof item === "string")
        : undefined,
      ownerApproved: body.ownerApproved === true,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      secretsSubmitted: body.secretsSubmitted === true
    });
    const unsafeSecretSubmission = data.blockers.some(
      (blocker) =>
        blocker ===
          "Secret values must not be submitted to this API. Store Supabase secrets directly in Vercel or Supabase." ||
        blocker === "Activation notes appear to contain secret-like content and were blocked."
    );

    return NextResponse.json(
      {
        data,
        meta: {
          expectedBundleSha256: getSupabaseMigrationBundle().bundleSha256,
          secretValuesAccepted: false
        }
      },
      { status: unsafeSecretSubmission ? 422 : 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
