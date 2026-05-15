import { NextResponse } from "next/server";
import {
  getCredentialInstallationRunbook,
  recordCredentialInstallationReview,
  type CredentialRunbookFormat
} from "@/lib/system/credential-installation";

const allowedFormats: CredentialRunbookFormat[] = ["json", "csv"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (!allowedFormats.includes(format as CredentialRunbookFormat)) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const data = await getCredentialInstallationRunbook(format as CredentialRunbookFormat);

    if (format === "csv") {
      return new NextResponse(data.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-credential-installation-${data.generatedAt.slice(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recordCredentialInstallationReview({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      environment: typeof body.environment === "string" ? body.environment : undefined,
      reviewedKeys: Array.isArray(body.reviewedKeys) ? body.reviewedKeys.filter((item): item is string => typeof item === "string") : [],
      installationNotes: typeof body.installationNotes === "string" ? body.installationNotes : undefined,
      ownerApproved: body.ownerApproved === true,
      secretsSubmitted: body.secretsSubmitted === true
    });

    const unsafeSecretSubmission = data.blockers.some(
      (blocker) =>
        blocker === "Secret values must not be submitted to this API. Store them directly in Vercel or the provider console." ||
        blocker === "Installation notes appear to contain secret-like content and were blocked."
    );

    return NextResponse.json({ data }, { status: unsafeSecretSubmission ? 422 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
