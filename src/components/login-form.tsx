"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm({ authConfigured }: { authConfigured: boolean }) {
  const searchParams = useSearchParams();
  const [accessCode, setAccessCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [message, setMessage] = useState("");
  const nextPath = searchParams.get("next") || "/admin";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const response = await fetch(`/api/v1/auth/login?next=${encodeURIComponent(nextPath)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setStatus("error");
      setMessage(payload?.error ?? "Unable to sign in.");
      return;
    }

    window.location.assign(payload?.data?.nextPath ?? "/admin");
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label htmlFor="accessCode">Owner access code</label>
      <input
        autoComplete="current-password"
        autoFocus
        id="accessCode"
        name="accessCode"
        onChange={(event) => setAccessCode(event.target.value)}
        placeholder="Enter access code"
        type="password"
        value={accessCode}
      />
      {authConfigured ? null : (
        <p className="login-note">
          Temporary launch access is active until production owner credentials are configured.
        </p>
      )}
      {message ? <p className="login-error">{message}</p> : null}
      <button className="button primary" disabled={status === "submitting" || !accessCode.trim()} type="submit">
        {status === "submitting" ? "Signing in..." : "Open backend console"}
      </button>
    </form>
  );
}

