import { NextResponse } from "next/server";
import {
  getCredentialSmokeEvidence,
  recordCredentialSmokeEvidence,
  type CredentialSmokeEvidenceInput
} from "@/lib/system/credential-smoke-evidence";
import type { CredentialRunbookFormat } from "@/lib/system/credential-installation";

const allowedFormats: CredentialRunbookFormat[] = ["json", "csv"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (!allowedFormats.includes(format as CredentialRunbookFormat)) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const data = await getCredentialSmokeEvidence(format as CredentialRunbookFormat);

    if (format === "csv") {
      return new NextResponse(data.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-credential-smoke-evidence-${data.generatedAt.slice(0, 10)}.csv"`
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
    const input: CredentialSmokeEvidenceInput = {
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      format: "json"
    };

    return NextResponse.json({ data: await recordCredentialSmokeEvidence(input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
