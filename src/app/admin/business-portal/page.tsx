import Link from "next/link";
import { getSuperadminBusinessPortalOverview } from "@/lib/business-portal";

export const dynamic = "force-dynamic";

export default async function AdminBusinessPortalPage() {
  const overview = await getSuperadminBusinessPortalOverview();

  return (
    <main className="business-shell">
      <section className="business-hero">
        <div>
          <p className="eyebrow">Superadmin</p>
          <h1>Business portal command center.</h1>
          <p className="lede">Approval gates, partner status, lead operations, business registrations, and platform usage all from live database tables.</p>
        </div>
        <Link className="button secondary" href="/admin">Back to admin</Link>
      </section>

      <section className="business-kpi-grid">
        <Kpi label="Businesses" value={overview.totals.businesses} />
        <Kpi label="Pending businesses" value={overview.totals.pendingBusinesses} />
        <Kpi label="Active services" value={overview.totals.activeServices} />
        <Kpi label="Open leads" value={overview.totals.openLeads} />
        <Kpi label="Pending approvals" value={overview.totals.pendingApprovals} />
      </section>

      <section className="business-two-column">
        <div className="business-panel">
          <p className="eyebrow">Approval queue</p>
          <h2>Pending review</h2>
          <div className="business-list">
            {overview.approvals.slice(0, 12).map((approval) => (
              <article key={approval.id}>
                <strong>{approval.subject_type.replaceAll("_", " ")}</strong>
                <span>{approval.status} · {approval.priority} · {approval.business_profile_id}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="business-panel">
          <p className="eyebrow">Partners</p>
          <h2>Integration status</h2>
          <div className="business-list">
            {overview.partners.map((partner) => (
              <article key={partner.id}>
                <strong>{partner.partner_name}</strong>
                <span>{partner.category} · {partner.status} · credentials {partner.credential_status}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="business-two-column">
        <div className="business-panel">
          <p className="eyebrow">Businesses</p>
          <h2>Registrations</h2>
          <div className="business-list">
            {overview.profiles.slice(0, 12).map((profile) => (
              <article key={profile.id}>
                <strong>{profile.dba_name ?? profile.legal_name}</strong>
                <span>{profile.business_type} · {profile.verification_status} · {profile.email}</span>
              </article>
            ))}
          </div>
        </div>

        <div className="business-panel">
          <p className="eyebrow">Usage</p>
          <h2>Recent portal events</h2>
          <div className="business-list">
            {overview.usage.slice(0, 12).map((event) => (
              <article key={event.id}>
                <strong>{event.event_name}</strong>
                <span>{event.surface} · {new Date(event.created_at).toLocaleString("en-US")}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="business-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
