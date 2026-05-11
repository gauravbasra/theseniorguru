import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/lib/newsroom/newsroom";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  return {
    title: article ? `${article.title} | The Senior Guru` : "Senior Care Guide | The Senior Guru",
    description: article?.dek ?? "Senior care guidance from The Senior Guru."
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="profile-shell">
      <article className="article-detail">
        <p className="eyebrow">Senior care guide</p>
        <h1>{article.title}</h1>
        {article.dek ? <p className="lede">{article.dek}</p> : null}
        <div className="article-meta">
          <span>By {article.byline}</span>
          {article.publishedAt ? <span>{new Date(article.publishedAt).toLocaleDateString()}</span> : null}
          {article.aiAssisted ? <span>AI-assisted, editorially reviewed</span> : null}
        </div>
        <div className="article-body">
          {article.body.split("\n\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {article.sourceLinks.length ? (
          <section className="article-sources">
            <h2>Sources and related pages</h2>
            {article.sourceLinks.map((source) => (
              <a href={source.url} key={source.url}>{source.title ?? source.url}</a>
            ))}
          </section>
        ) : null}
        <div className="actions">
          <Link className="button primary" href="/discover">Compare senior living options</Link>
          <Link className="button secondary" href="/articles">More guides</Link>
        </div>
      </article>
    </main>
  );
}
