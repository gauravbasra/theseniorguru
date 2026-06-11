"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function PartnerRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const businessName = String(formData.get("businessName") ?? "");
    const industry = String(formData.get("industry") ?? "");
    const serviceArea = String(formData.get("serviceArea") ?? "");
    const website = String(formData.get("website") ?? "");
    const description = String(formData.get("description") ?? "");

    try {
      const response = await fetch("/api/v1/operator/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: businessName,
          contactName: String(formData.get("contactName") ?? ""),
          contactEmail: String(formData.get("email") ?? ""),
          contactPhone: String(formData.get("phone") ?? ""),
          role: industry,
          communityCount: serviceArea,
          occupancyChallenge: [
            `Partnership industry: ${industry}`,
            `Service area: ${serviceArea}`,
            website ? `Website: ${website}` : "",
            description ? `Description: ${description}` : ""
          ]
            .filter(Boolean)
            .join("\n"),
          requestedProduct: "full_platform",
          consentToContact: formData.get("consentToContact") === "on"
        })
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setStatus("success");
      setMessage("Partnership request received. We will follow up with the right next step.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please email gaurav@basraconsultingservices.com directly.");
    }
  }

  return (
    <form className="lead-form partner-request-form" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">Partnership request</p>
        <h3>Tell us about your organization</h3>
      </div>
      <div className="form-grid two">
        <label>
          Business name
          <input name="businessName" required placeholder="Company or organization" />
        </label>
        <label>
          Industry
          <select name="industry" required defaultValue="">
            <option value="" disabled>Select one</option>
            <option>Senior Living Community</option>
            <option>Home Care / Home Health</option>
            <option>Transportation Provider</option>
            <option>Pharmacy / Medication Management</option>
            <option>Meal / Grocery Provider</option>
            <option>Wellness / Engagement Provider</option>
            <option>Technology Partner</option>
            <option>Investor / Strategic Partner</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Contact name
          <input name="contactName" required placeholder="Your name" />
        </label>
        <label>
          Work email
          <input name="email" type="email" required placeholder="name@company.com" />
        </label>
      </div>
      <div className="form-grid two">
        <label>
          Phone
          <input name="phone" placeholder="Best callback number" />
        </label>
        <label>
          Service area
          <input name="serviceArea" placeholder="City, state, region, or nationwide" />
        </label>
      </div>
      <label>
        Website
        <input name="website" type="url" placeholder="https://company.com" />
      </label>
      <label>
        Description
        <textarea name="description" required placeholder="Tell us about your service, pilot interest, integration idea, or partnership request." rows={4} />
      </label>
      <label className="check-row">
        <input name="consentToContact" type="checkbox" required />
        <span>I agree to be contacted about TheSeniorGuru partnership opportunities.</span>
      </label>
      <button className="button primary" disabled={status === "loading"} type="submit">
        {status === "loading" ? "Submitting..." : "Submit partnership request"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
