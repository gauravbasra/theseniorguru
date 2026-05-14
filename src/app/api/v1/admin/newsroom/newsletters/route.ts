import { NextResponse } from "next/server";
import { createNewsletterEdition, listNewsletterEditions } from "@/lib/newsroom/newsroom";

export async function GET() {
  try {
    return NextResponse.json({ data: await listNewsletterEditions() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.subject) {
      return NextResponse.json({ error: "subject is required" }, { status: 422 });
    }

    const edition = await createNewsletterEdition({
      subject: body.subject,
      audience: body.audience,
      articleIds: body.articleIds,
      intro: body.intro,
      scheduledFor: body.scheduledFor
    });

    return NextResponse.json({ data: edition }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
