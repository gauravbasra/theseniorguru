import Link from "next/link";
import { listPublishedArticles } from "@/lib/newsroom/newsroom";

export const metadata = {
  title: "Senior Care Guides | The Senior Guru",
  description: "Trusted senior care guides for families comparing local senior living and care options."
};

export default async function ArticlesPage() {
  const articles = await listPublishedArticles();

  return (
    <main className="profile-shell">
      <section className="profile-hero">
        <div>
          <p className="eyebrow">Senior care guides</p>
          <h1>Clear answers for families comparing senior living options.</h1>
          <p className="lede">
            Practical, source-linked guides from The Senior Guru newsroom for families, caregivers, and communities
            working through senior care decisions.
          </p>
          <div className="actions">
            <Link className="button primary" href="/discover">Search communities</Link>
            <Link className="button secondary" href="/seniors">Open senior app feed</Link>
          </div>
        </div>
        <aside className="claim-panel">
          <p className="eyebrow">For communities</p>
          <h2>Authority content supports local discovery.</h2>
          <p>Guides connect family questions to local senior living pages, transparent listings, and direct inquiries.</p>
          <Link className="button primary" href="/operators/free-listing">List your community free</Link>
        </aside>
      </section>

      <section className="provider-list">
        {articles.map((article) => (
          <article className="provider-card" key={article.id}>
            <div>
              <p className="status">{article.aiAssisted ? "AI-assisted, editorially reviewed" : "Editorial guide"}</p>
              <h2>{article.title}</h2>
              {article.dek ? <p>{article.dek}</p> : null}
              <small>
                By {article.byline}
                {article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString()}` : ""}
              </small>
            </div>
            <div className="card-actions">
              <Link href={`/articles/${article.slug}`}>Read guide</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
