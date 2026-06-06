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
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/partner-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      setStatus("success");
      setMessage("Thank you. We received your request and will follow up shortly.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please email contact@theseniorguru.com directly.");
    }
  }

  return (
    <form className="partner-request-form" onSubmit={onSubmit}>
      <div className="form-grid-two">
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
      <div className="form-grid-two">
        <label>
          Contact name
          <input name="contactName" required placeholder="Your name" />
        </label>
        <label>
          Work email
          <input name="email" type="email" required placeholder="name@company.com" />
        </label>
      </div>
      <div className="form-grid-two">
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
        How would you like to collaborate?
        <textarea name="collaboration" required placeholder="Tell us about your service, pilot interest, integration idea, or partnership request." rows={4} />
      </label>
      <button disabled={status === "loading"} type="submit">
        {status === "loading" ? "Sending..." : "Send collaboration request"}
      </button>
      {message ? <p className={`form-status ${status}`}>{message}</p> : null}
    </form>
  );
}
