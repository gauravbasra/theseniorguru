"use client";

import { useState, type FormEvent } from "react";

type ProviderInquiryFormProps = {
  providerId: string;
  providerName: string;
};

export function ProviderInquiryForm({ providerId, providerName }: ProviderInquiryFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/v1/providers/${providerId}/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requesterName: String(data.get("requesterName") ?? ""),
        requesterEmail: String(data.get("requesterEmail") ?? ""),
        requesterPhone: String(data.get("requesterPhone") ?? ""),
        relationship: String(data.get("relationship") ?? "relative"),
        payingWith: String(data.get("payingWith") ?? "unknown"),
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
    setMessage(`Your inquiry for ${providerName} was submitted.`);
  }

  return (
    <form className="lead-form compact" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Direct inquiry</p>
        <h3>Contact this community</h3>
      </div>
      <label>
        Your name
        <input name="requesterName" required placeholder="Full name" />
      </label>
      <div className="form-grid two">
        <label>
          Email
          <input name="requesterEmail" type="email" placeholder="you@example.com" />
        </label>
        <label>
          Phone
          <input name="requesterPhone" type="tel" placeholder="(555) 555-1212" />
        </label>
        <label>
          Relationship
          <select name="relationship" defaultValue="relative">
            <option value="myself">Myself</option>
            <option value="spouse">Spouse</option>
            <option value="relative">Relative</option>
            <option value="friend">Friend</option>
            <option value="professional">Professional</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Paying with
          <select name="payingWith" defaultValue="unknown">
            <option value="private_pay">Private pay</option>
            <option value="insurance">Insurance</option>
            <option value="medicaid">Medicaid</option>
            <option value="medicare">Medicare</option>
            <option value="other">Other</option>
            <option value="unknown">Not sure yet</option>
          </select>
        </label>
      </div>
      <label>
        Message
        <textarea name="message" rows={3} placeholder="Availability, pricing, tours, care needs..." />
      </label>
      <label className="check-row">
        <input name="consentToContact" type="checkbox" required />
        <span>I agree to be contacted about this community inquiry.</span>
      </label>
      <button className="button primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting..." : "Send inquiry"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
