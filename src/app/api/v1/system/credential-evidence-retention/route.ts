import { NextResponse } from "next/server";
import {
  getCredentialEvidenceRetentionDashboard,
  reviewCredentialEvidenceRetention,
  summarizeCredentialEvidenceRetentionAudit,
  type CredentialEvidenceRetentionFormat
} from "@/lib/system/credential-evidence-retention";

const allowedFormats: CredentialEvidenceRetentionFormat[] = ["json", "csv"];

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (!allowedFormats.includes(format as CredentialEvidenceRetentionFormat)) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const data = await getCredentialEvidenceRetentionDashboard({
      format: format as CredentialEvidenceRetentionFormat,
      retentionDays: parseNumber(searchParams.get("retentionDays"), 2555),
      limit: parseNumber(searchParams.get("limit"), 100)
    });

    if (format === "csv") {
      return new NextResponse(data.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-credential-evidence-retention-${data.generatedAt.slice(0, 10)}.csv"`
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
    const data = await reviewCredentialEvidenceRetention({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      retentionDays: parseNumber(body.retentionDays, 2555),
      limit: parseNumber(body.limit, 100),
      notes: typeof body.notes === "string" ? body.notes : undefined,
      format: "json"
    });

    return NextResponse.json({
      data: {
        ...data,
        auditEvent: summarizeCredentialEvidenceRetentionAudit(data.auditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
