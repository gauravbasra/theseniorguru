"use client";

import { useState, type FormEvent } from "react";

export function FreeListingForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/v1/operator/free-listing-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        communityName: String(data.get("communityName") ?? ""),
        contactName: String(data.get("contactName") ?? ""),
        contactEmail: String(data.get("contactEmail") ?? ""),
        contactPhone: String(data.get("contactPhone") ?? ""),
        city: String(data.get("city") ?? ""),
        state: String(data.get("state") ?? ""),
        websiteUrl: String(data.get("websiteUrl") ?? ""),
        careTypes: data.getAll("careTypes").map(String),
        message: String(data.get("message") ?? ""),
        consentToContact: data.get("consentToContact") === "on"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Free listing request could not be submitted." }));
      setStatus("error");
      setMessage(String(body.error ?? "Free listing request could not be submitted."));
      return;
    }

    form.reset();
    setStatus("success");
    setMessage("Free listing request received. The next step is verification and profile enrichment.");
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Free listing</p>
        <h3>Claim or add your community</h3>
      </div>
      <div className="form-grid two">
        <label>
          Community name
          <input name="communityName" required placeholder="Community name" />
        </label>
        <label>
          Contact name
          <input name="contactName" required placeholder="Full name" />
        </label>
        <label>
          Email
          <input name="contactEmail" type="email" placeholder="you@community.com" />
        </label>
        <label>
          Phone
          <input name="contactPhone" type="tel" placeholder="(555) 555-1212" />
        </label>
        <label>
          City
          <input name="city" placeholder="Denver" />
        </label>
        <label>
          State
          <input name="state" placeholder="CO" />
        </label>
      </div>
      <label>
        Website
        <input name="websiteUrl" type="url" placeholder="https://community.com" />
      </label>
      <div className="choice-grid" aria-label="Care types">
        {["Assisted Living", "Memory Care", "Independent Living", "Skilled Nursing", "Respite Care", "Home Care"].map(
          (careType) => (
            <label className="check-row" key={careType}>
              <input name="careTypes" type="checkbox" value={careType} />
              <span>{careType}</span>
            </label>
          )
        )}
      </div>
      <label>
        Notes
        <textarea name="message" rows={4} placeholder="Tell us what should be verified first." />
      </label>
      <label className="check-row">
        <input name="consentToContact" type="checkbox" required />
        <span>I agree to be contacted to verify this free community listing.</span>
      </label>
      <button className="button primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Claim free listing"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
