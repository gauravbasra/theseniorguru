import Link from "next/link";
import { AdminOperationsConsole } from "@/components/admin-operations-console";
import { getSystemReadiness } from "@/lib/system/readiness";

export default function AdminPage() {
  const readiness = getSystemReadiness();

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Admin operations</p>
          <h1>Run launch workflows from one console.</h1>
          <p className="lede">
            This page is for inventory launch, claim verification, outreach, and community moderation. Every action calls
            a backend route and shows the service response.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/workbench">Founder workbench</Link>
            <Link className="button secondary" href="/api/v1/system/readiness">Readiness JSON</Link>
          </div>
        </div>
        <aside className="admin-status-card">
          <p className="eyebrow">Production readiness</p>
          <h2>{readiness.overallStatus.replaceAll("_", " ")}</h2>
          <p>Supabase, email, ads, DNS, and legal tasks remain visible without exposing secret values.</p>
        </aside>
      </section>

      <section className="ops-explain">
        <article>
          <p className="eyebrow">Inventory</p>
          <h2>Validate imports before publishing</h2>
          <p>Dry runs catch incomplete listings, duplicate scoring prevents messy inventory, and approval stays audited.</p>
        </article>
        <article>
          <p className="eyebrow">Trust</p>
          <h2>Claims and community need rails</h2>
          <p>Verification attempts, outreach, reports, and moderation all route through policy-aware services.</p>
        </article>
      </section>

      <AdminOperationsConsole />
    </main>
  );
}

