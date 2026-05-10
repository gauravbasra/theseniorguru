"use client";

import { useState, type FormEvent } from "react";

type FamilyInquiryFormProps = {
  defaultCity?: string;
  defaultState?: string;
  defaultCareType?: string;
  compact?: boolean;
};

export function FamilyInquiryForm({
  defaultCity = "",
  defaultState = "",
  defaultCareType = "Assisted Living",
  compact = false
}: FamilyInquiryFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/v1/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requesterName: String(data.get("requesterName") ?? ""),
        requesterEmail: String(data.get("requesterEmail") ?? ""),
        requesterPhone: String(data.get("requesterPhone") ?? ""),
        city: String(data.get("city") ?? ""),
        state: String(data.get("state") ?? ""),
        careType: String(data.get("careType") ?? ""),
        timeline: String(data.get("timeline") ?? ""),
        budget: String(data.get("budget") ?? ""),
        message: String(data.get("message") ?? ""),
        consentToContact: data.get("consentToContact") === "on"
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Inquiry could not be submitted." }));
      setStatus("error");
      setMessage(String(body.error ?? "Inquiry could not be submitted."));
      return;
    }

    form.reset();
    setStatus("success");
    setMessage("Thanks. We received your request and will help you narrow the right senior care options.");
  }

  return (
    <form className={compact ? "lead-form compact" : "lead-form"} onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Family inquiry</p>
        <h3>Get help finding senior care</h3>
      </div>
      <div className="form-grid two">
        <label>
          Your name
          <input name="requesterName" required placeholder="Full name" />
        </label>
        <label>
          Email
          <input name="requesterEmail" type="email" placeholder="you@example.com" />
        </label>
        <label>
          Phone
          <input name="requesterPhone" type="tel" placeholder="(555) 555-1212" />
        </label>
        <label>
          Care type
          <select name="careType" defaultValue={defaultCareType}>
            <option>Assisted Living</option>
            <option>Memory Care</option>
            <option>Independent Living</option>
            <option>Home Care</option>
            <option>Skilled Nursing</option>
            <option>Respite Care</option>
          </select>
        </label>
        <label>
          City
          <input name="city" defaultValue={defaultCity} placeholder="Denver" />
        </label>
        <label>
          State
          <input name="state" defaultValue={defaultState} placeholder="CO" />
        </label>
      </div>
      {!compact ? (
        <div className="form-grid two">
          <label>
            Timeline
            <select name="timeline" defaultValue="Within 30 days">
              <option>Immediately</option>
              <option>Within 30 days</option>
              <option>1-3 months</option>
              <option>Researching for later</option>
            </select>
          </label>
          <label>
            Budget
            <input name="budget" placeholder="Optional monthly budget" />
          </label>
        </div>
      ) : null}
      <label>
        Notes
        <textarea name="message" rows={compact ? 3 : 4} placeholder="Tell us what matters most." />
      </label>
      <label className="check-row">
        <input name="consentToContact" type="checkbox" required />
        <span>I agree to be contacted about this senior care inquiry.</span>
      </label>
      <button className="button primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Request guidance"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
