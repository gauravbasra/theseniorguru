import { revalidatePath } from "next/cache";
import { createBusinessLead, createBusinessPhoto, createBusinessService, getBusinessPortalDashboard, upsertBusinessProfile } from "@/lib/business-portal";

export const dynamic = "force-dynamic";

const businessAccountId = "business-demo-priya-cabs";

export default async function BusinessPortalPage() {
  let dashboard: Awaited<ReturnType<typeof getBusinessPortalDashboard>>;
  let error: string | null = null;

  try {
    dashboard = await getBusinessPortalDashboard(businessAccountId);
  } catch (err) {
    dashboard = {
      businessAccountId,
      profile: null,
      package: null,
      services: [],
      photos: [],
      leads: [],
      approvals: [],
      analytics: {
        serviceCount: 0,
        approvedPhotoCount: 0,
        openLeadCount: 0,
        completedLeadCount: 0,
        estimatedLeadValueCents: 0,
        pendingApprovalCount: 0,
        conversionRate: 0
      }
    };
    error = err instanceof Error ? err.message : "Business portal failed to load.";
  }

  const profile = dashboard.profile;

  return (
    <main className="business-shell">
      <section className="business-hero">
        <div>
          <p className="eyebrow">Business web app</p>
          <h1>Manage senior service leads with real approval gates.</h1>
          <p className="lede">
            Business registration, service catalog, photo review, lead workflow, package enforcement, and analytics all read from database tables.
          </p>
        </div>
        <div className="business-status-card">
          <span>Verification</span>
          <strong>{profile?.verification_status?.replaceAll("_", " ") ?? "not registered"}</strong>
          <small>{dashboard.package ? `${dashboard.package.package_code} package · ${dashboard.package.included_leads_per_period} leads / ${dashboard.package.lead_period}` : "Create a business profile to start."}</small>
        </div>
      </section>

      {error ? <section className="business-alert">{error}</section> : null}

      <section className="business-kpi-grid">
        <Kpi label="Services" value={dashboard.analytics.serviceCount} />
        <Kpi label="Open leads" value={dashboard.analytics.openLeadCount} />
        <Kpi label="Lead value" value={`$${Math.round(dashboard.analytics.estimatedLeadValueCents / 100)}`} />
        <Kpi label="Pending approvals" value={dashboard.analytics.pendingApprovalCount} />
      </section>

      <section className="business-two-column">
        <form className="business-panel" action={saveProfileAction}>
          <p className="eyebrow">Registration</p>
          <h2>Business details</h2>
          <input name="businessType" defaultValue={profile?.business_type ?? "Transportation"} placeholder="Business type" required />
          <input name="legalName" defaultValue={profile?.legal_name ?? "Priya Cabs LLC"} placeholder="Legal business name" required />
          <input name="dbaName" defaultValue={profile?.dba_name ?? "Priya Cabs"} placeholder="DBA / display name" />
          <input name="ownerName" defaultValue={profile?.owner_name ?? "Rohit Mehta"} placeholder="Owner name" required />
          <input name="phone" defaultValue={profile?.phone ?? "+1 555-333-9999"} placeholder="Business phone" required />
          <input name="email" defaultValue={profile?.email ?? "owner@priyacabs.com"} placeholder="Business email" required />
          <input name="website" defaultValue={profile?.website ?? ""} placeholder="Website / Google Business profile URL" />
          <input name="businessAddress" defaultValue={profile?.business_address ?? "Parker, CO"} placeholder="Business address" />
          <button className="button primary" type="submit">Save business profile</button>
        </form>

        <div className="business-panel">
          <p className="eyebrow">Approvals</p>
          <h2>Superadmin gates</h2>
          <div className="business-list">
            {dashboard.approvals.slice(0, 6).map((approval) => (
              <article key={approval.id}>
                <strong>{approval.subject_type.replaceAll("_", " ")}</strong>
                <span>{approval.status} · {approval.priority}</span>
              </article>
            ))}
            {!dashboard.approvals.length ? <p className="empty-state">No approval records yet. Saving a profile or service creates one.</p> : null}
          </div>
        </div>
      </section>

      <section className="business-three-column">
        <form className="business-panel" action={addServiceAction}>
          <p className="eyebrow">Services</p>
          <h2>Add service</h2>
          <input type="hidden" name="businessProfileId" value={profile?.id ?? ""} />
          <input name="category" placeholder="Transportation, Meals, Home Help..." required disabled={!profile} />
          <input name="serviceName" placeholder="Service name" required disabled={!profile} />
          <textarea name="description" placeholder="What is included?" disabled={!profile} />
          <input name="priceMin" type="number" placeholder="Minimum price" disabled={!profile} />
          <input name="priceMax" type="number" placeholder="Maximum price" disabled={!profile} />
          <select name="priceUnit" defaultValue="fixed" disabled={!profile}>
            <option value="fixed">Fixed</option>
            <option value="hourly">Hourly</option>
            <option value="per_mile">Per mile</option>
            <option value="per_visit">Per visit</option>
            <option value="custom">Custom</option>
          </select>
          <button className="button primary" disabled={!profile} type="submit">Add service</button>
        </form>

        <form className="business-panel" action={addPhotoAction}>
          <p className="eyebrow">Photos</p>
          <h2>Add photo record</h2>
          <input type="hidden" name="businessProfileId" value={profile?.id ?? ""} />
          <input name="title" placeholder="Photo title" disabled={!profile} />
          <input name="storageUrl" placeholder="Storage URL / uploaded asset URL" required disabled={!profile} />
          <input name="altText" placeholder="Alt text" disabled={!profile} />
          <select name="photoType" defaultValue="gallery" disabled={!profile}>
            <option value="logo">Logo</option>
            <option value="owner">Owner</option>
            <option value="team">Team</option>
            <option value="vehicle">Vehicle</option>
            <option value="service">Service</option>
            <option value="gallery">Gallery</option>
          </select>
          <button className="button primary" disabled={!profile} type="submit">Submit photo for review</button>
        </form>

        <form className="business-panel" action={addLeadAction}>
          <p className="eyebrow">Lead workflow test</p>
          <h2>Create lead</h2>
          <input type="hidden" name="businessProfileId" value={profile?.id ?? ""} />
          <input name="requestType" defaultValue="ride" placeholder="Request type" required disabled={!profile} />
          <input name="requestTitle" defaultValue="Ride to Dr. Mehta Clinic" placeholder="Lead title" required disabled={!profile} />
          <input name="scheduledFor" type="datetime-local" disabled={!profile} />
          <input name="estimatedValueDollars" type="number" defaultValue="25" placeholder="Estimated value" disabled={!profile} />
          <button className="button primary" disabled={!profile} type="submit">Create lead</button>
        </form>
      </section>

      <section className="business-two-column">
        <div className="business-panel">
          <p className="eyebrow">Service catalog</p>
          <h2>Database services</h2>
          <div className="business-list">
            {dashboard.services.map((service) => (
              <article key={service.id}>
                <strong>{service.service_name}</strong>
                <span>{service.category} · {service.price_unit ?? "custom"} · {service.active ? "active" : "inactive"}</span>
              </article>
            ))}
            {!dashboard.services.length ? <p className="empty-state">No services yet.</p> : null}
          </div>
        </div>

        <div className="business-panel">
          <p className="eyebrow">Lead inbox</p>
          <h2>Assigned leads</h2>
          <div className="business-list">
            {dashboard.leads.map((lead) => (
              <article key={lead.id}>
                <strong>{lead.request_title}</strong>
                <span>{lead.status} · {lead.request_type} · ${Math.round(Number(lead.estimated_value_cents ?? 0) / 100)}</span>
              </article>
            ))}
            {!dashboard.leads.length ? <p className="empty-state">No leads assigned yet.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

async function saveProfileAction(formData: FormData) {
  "use server";
  await upsertBusinessProfile({
    businessType: String(formData.get("businessType") ?? ""),
    legalName: String(formData.get("legalName") ?? ""),
    dbaName: String(formData.get("dbaName") ?? ""),
    ownerName: String(formData.get("ownerName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    businessAddress: String(formData.get("businessAddress") ?? "")
  }, businessAccountId);
  revalidatePath("/business");
}

async function addServiceAction(formData: FormData) {
  "use server";
  await createBusinessService({
    businessProfileId: String(formData.get("businessProfileId") ?? ""),
    category: String(formData.get("category") ?? ""),
    serviceName: String(formData.get("serviceName") ?? ""),
    description: String(formData.get("description") ?? ""),
    priceMin: Number(formData.get("priceMin") || 0),
    priceMax: Number(formData.get("priceMax") || 0),
    priceUnit: String(formData.get("priceUnit") ?? "fixed") as "fixed"
  }, businessAccountId);
  revalidatePath("/business");
}

async function addPhotoAction(formData: FormData) {
  "use server";
  await createBusinessPhoto({
    businessProfileId: String(formData.get("businessProfileId") ?? ""),
    title: String(formData.get("title") ?? ""),
    storageUrl: String(formData.get("storageUrl") ?? ""),
    altText: String(formData.get("altText") ?? ""),
    photoType: String(formData.get("photoType") ?? "gallery") as "gallery"
  }, businessAccountId);
  revalidatePath("/business");
}

async function addLeadAction(formData: FormData) {
  "use server";
  await createBusinessLead({
    businessProfileId: String(formData.get("businessProfileId") ?? ""),
    requestType: String(formData.get("requestType") ?? ""),
    requestTitle: String(formData.get("requestTitle") ?? ""),
    scheduledFor: String(formData.get("scheduledFor") || ""),
    estimatedValueCents: Math.round(Number(formData.get("estimatedValueDollars") || 0) * 100),
    requestDetails: { source: "business_portal_test_form" }
  });
  revalidatePath("/business");
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="business-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
