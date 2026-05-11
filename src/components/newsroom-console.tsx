"use client";

import { useState } from "react";
import { Bot, CheckCircle2, FilePenLine, ListChecks, Megaphone, Mic2, Newspaper, Radio, Send } from "lucide-react";

type NewsroomResult = {
  label: string;
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
  summary: string;
};

type NewsItemPayload = {
  id?: string;
};

type ArticlePayload = {
  id?: string;
  status?: string;
  title?: string;
};

type ArticleListPayload = ArticlePayload[];

const sourcePayload = {
  title: "Local families need clearer guidance on memory care tours",
  sourceUrl: "https://example.com/senior-care-news/memory-care-tour-questions",
  sourceName: "Editorial planning desk",
  summary:
    "Families are comparing memory care options earlier and need practical, non-alarmist questions before a first tour.",
  audience: ["families", "providers"],
  topicTags: ["memory-care", "family-guidance", "local-seo"]
};

export function NewsroomConsole() {
  const [results, setResults] = useState<NewsroomResult[]>([]);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [newsItemId, setNewsItemId] = useState<string | undefined>();
  const [articleId, setArticleId] = useState<string | undefined>();

  async function runNewsroomAction(label: string, key: string, request: () => Promise<Response>) {
    setLoadingKey(key);
    const response = await request();
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && key === "source") {
      setNewsItemId((payload.data as NewsItemPayload | undefined)?.id);
    }

    if (response.ok && key === "draft") {
      setArticleId((payload.data as ArticlePayload | undefined)?.id);
    }

    if (response.ok && key === "articles") {
      const articles = payload.data as ArticleListPayload | undefined;
      const actionableArticle = articles?.find((article) => article.status !== "published") ?? articles?.[0];
      setArticleId(actionableArticle?.id);
    }

    setResults((current) => [
      {
        label,
        ok: response.ok,
        status: response.status,
        data: payload.data,
        error: payload.error,
        summary: summarizeNewsroomAction(key, payload.data)
      },
      ...current.slice(0, 7)
    ]);
  }

  const activeArticleId = articleId ?? "pending-article-demo";

  return (
    <section className="newsroom-console">
      <div className="console-header">
        <div>
          <p className="eyebrow">AI newsroom engine</p>
          <h2>Ingest, draft, publish, and repurpose with policy rails.</h2>
          <p>
            Turn approved senior care sources into founder-led articles, social posts, podcast briefs, and publishing
            decisions with compliance checks built in.
          </p>
        </div>
      </div>

      <div className="newsroom-grid">
        <NewsroomButton
          icon={<Newspaper aria-hidden="true" />}
          label="Load source inbox"
          loading={loadingKey === "inbox"}
          onClick={() =>
            runNewsroomAction("Load source inbox", "inbox", () => fetch("/api/v1/admin/newsroom/inbox"))
          }
        />
        <NewsroomButton
          icon={<Radio aria-hidden="true" />}
          label="Ingest source"
          loading={loadingKey === "source"}
          onClick={() =>
            runNewsroomAction("Ingest newsroom source", "source", () =>
              fetch("/api/v1/admin/newsroom/inbox", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(sourcePayload)
              })
            )
          }
        />
        <NewsroomButton
          icon={<Bot aria-hidden="true" />}
          label="Load articles"
          loading={loadingKey === "articles"}
          onClick={() =>
            runNewsroomAction("Load article pipeline", "articles", () =>
              fetch("/api/v1/admin/newsroom/articles")
            )
          }
        />
        <NewsroomButton
          icon={<Bot aria-hidden="true" />}
          label="Draft article"
          loading={loadingKey === "draft"}
          onClick={() =>
            runNewsroomAction("Draft AI article", "draft", () =>
              fetch("/api/v1/admin/newsroom/articles", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  newsItemId,
                  byline: "Gaurav Basra",
                  title: "Memory Care Tour Questions Families Should Ask Before They Feel Rushed",
                  dek:
                    "A Senior Guru field guide for families comparing local care options and operators building trust.",
                  sourceLinks: sourcePayload.sourceUrl
                    ? [{ title: sourcePayload.sourceName, url: sourcePayload.sourceUrl }]
                    : []
                })
              })
            )
          }
        />
        <NewsroomButton
          icon={<CheckCircle2 aria-hidden="true" />}
          label="Approve article"
          loading={loadingKey === "approve"}
          onClick={() =>
            runNewsroomAction("Approve article", "approve", () =>
              fetch(`/api/v1/admin/newsroom/articles/${activeArticleId}/approve`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  actorId: "00000000-0000-4000-8000-000000000001",
                  notes: "Approved from admin newsroom publishing console."
                })
              })
            )
          }
        />
        <NewsroomButton
          icon={<FilePenLine aria-hidden="true" />}
          label="Publish article"
          loading={loadingKey === "publish"}
          onClick={() =>
            runNewsroomAction("Publish article", "publish", () =>
              fetch(`/api/v1/admin/newsroom/articles/${activeArticleId}/publish`, { method: "POST" })
            )
          }
        />
        <NewsroomButton
          icon={<Megaphone aria-hidden="true" />}
          label="Generate social"
          loading={loadingKey === "social"}
          onClick={() =>
            runNewsroomAction("Generate social derivatives", "social", () =>
              fetch(`/api/v1/admin/newsroom/articles/${activeArticleId}/generate-social`, { method: "POST" })
            )
          }
        />
        <NewsroomButton
          icon={<Mic2 aria-hidden="true" />}
          label="Podcast brief"
          loading={loadingKey === "podcast"}
          onClick={() =>
            runNewsroomAction("Generate podcast brief", "podcast", () =>
              fetch(`/api/v1/admin/newsroom/articles/${activeArticleId}/generate-podcast-brief`, { method: "POST" })
            )
          }
        />
        <NewsroomButton
          icon={<ListChecks aria-hidden="true" />}
          label="Readiness"
          loading={loadingKey === "readiness"}
          onClick={() =>
            runNewsroomAction("Check newsroom readiness", "readiness", () =>
              fetch("/api/v1/admin/newsroom/readiness")
            )
          }
        />
        <NewsroomButton
          icon={<Send aria-hidden="true" />}
          label="Policy check"
          loading={loadingKey === "policy"}
          onClick={() =>
            runNewsroomAction("Check newsroom policy", "policy", () =>
              fetch("/api/v1/policy/check", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  subjectType: "article",
                  actionKey: "draft_article",
                  input: {
                    title: sourcePayload.title,
                    summary: sourcePayload.summary,
                    rule: "add original analysis and cite sources"
                  }
                })
              })
            )
          }
        />
      </div>

      <div className="newsroom-state">
        <span>Source: {newsItemId ?? "not created in this session"}</span>
        <span>Article: {articleId ?? "not drafted in this session"}</span>
      </div>

      <div className="console-results" aria-live="polite">
        {results.length ? (
          results.map((result, index) => (
            <article className={result.ok ? "console-result ok" : "console-result error"} key={`${result.label}-${index}`}>
              <div>
                <strong>{result.label}</strong>
                <span>{result.ok ? `HTTP ${result.status}` : result.error ?? `HTTP ${result.status}`}</span>
              </div>
              <p>{result.ok ? result.summary : result.error ?? "Newsroom action needs attention."}</p>
            </article>
          ))
        ) : (
          <article className="console-result">
            <div>
              <strong>No newsroom actions run yet</strong>
              <span>Use the controls above to exercise the AI publishing workflow.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function summarizeNewsroomAction(key: string, data: unknown) {
  const record = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};

  if (key === "inbox") {
    const count = Array.isArray(data) ? data.length : Array.isArray(record.items) ? record.items.length : 0;
    return `${count} editorial source items are available for review.`;
  }

  if (key === "source") {
    return `Source saved for editorial review and future founder commentary.`;
  }

  if (key === "draft") {
    return `Article draft created with source attribution and approval guardrails.`;
  }

  if (key === "articles") {
    const count = Array.isArray(data) ? data.length : 0;
    return `${count} article drafts, approvals, and published guides loaded.`;
  }

  if (key === "approve") {
    return `Article passed editorial approval and is ready for publishing.`;
  }

  if (key === "publish") {
    return `Article publishing step completed or moved to the next approval state.`;
  }

  if (key === "social") {
    return `Social derivatives prepared for distribution.`;
  }

  if (key === "podcast") {
    return `Podcast/interview brief prepared for the content pipeline.`;
  }

  if (key === "readiness") {
    return `Newsroom readiness refreshed across sources, approvals, drafts, and publishing checks.`;
  }

  if (key === "policy") {
    return `Content policy check completed before publishing.`;
  }

  return "Newsroom action completed.";
}

function NewsroomButton({
  icon,
  label,
  loading,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button className="console-button" type="button" disabled={loading} onClick={onClick}>
      {icon}
      <span>{loading ? "Running..." : label}</span>
    </button>
  );
}
