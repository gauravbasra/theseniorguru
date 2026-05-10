"use client";

import { useState, type FormEvent } from "react";

type OperatorDemoFormProps = {
  requestedProduct?: "ai_occupancy" | "reputation" | "growth_engine" | "full_platform";
  compact?: boolean;
};

export function OperatorDemoForm({ requestedProduct = "full_platform", compact = false }: OperatorDemoFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/v1/operator/demo-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contactName: String(data.get("contactName") ?? ""),
        contactEmail: String(data.get("contactEmail") ?? ""),
        contactPhone: String(data.get("contactPhone") ?? ""),
        organizationName: String(data.get("organizationName") ?? ""),
        role: String(data.get("role") ?? ""),
        communityCount: String(data.get("communityCount") ?? ""),
        occupancyChallenge: String(data.get("occupancyChallenge") ?? ""),
        requestedProduct,
        consentToContact: data.get("consentToContact") === "on"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Demo request could not be submitted." }));
      setStatus("error");
      setMessage(String(body.error ?? "Demo request could not be submitted."));
      return;
    }

    form.reset();
    setStatus("success");
    setMessage("Demo request received. We will follow up with the right growth-path next step.");
  }

  return (
    <form className={compact ? "lead-form compact" : "lead-form"} onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Operator demo</p>
        <h3>See the occupancy growth platform</h3>
      </div>
      <div className="form-grid two">
        <label>
          Your name
          <input name="contactName" required placeholder="Full name" />
        </label>
        <label>
          Community or company
          <input name="organizationName" required placeholder="Community name" />
        </label>
        <label>
          Email
          <input name="contactEmail" type="email" placeholder="you@community.com" />
        </label>
        <label>
          Phone
          <input name="contactPhone" type="tel" placeholder="(555) 555-1212" />
        </label>
      </div>
      {!compact ? (
        <div className="form-grid two">
          <label>
            Role
            <input name="role" placeholder="Executive Director, Marketing, Owner" />
          </label>
          <label>
            Number of communities
            <input name="communityCount" placeholder="1, 2-5, 6+" />
          </label>
        </div>
      ) : null}
      <label>
        Occupancy challenge
        <textarea
          name="occupancyChallenge"
          rows={compact ? 3 : 4}
          placeholder="Missed calls, slow follow-up, review growth, tours, local SEO..."
        />
      </label>
      <label className="check-row">
        <input name="consentToContact" type="checkbox" required />
        <span>I agree to be contacted about TheSeniorGuru occupancy growth platform.</span>
      </label>
      <button className="button primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Schedule demo"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
