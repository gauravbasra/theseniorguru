import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { getAdminAuthConfig } from "@/lib/auth/admin-session";

export default function LoginPage() {
  const authConfig = getAdminAuthConfig();

  return (
    <main className="login-shell">
      <section className="login-panel">
        <Link className="brand-mark" href="/">
          <span>SG</span>
          <strong>The Senior Guru</strong>
        </Link>
        <div>
          <p className="eyebrow">Owner login</p>
          <h1>Open the owner command center securely.</h1>
          <p>
            Sign in to review launch readiness, inventory planning, claims, leads, newsroom workflows, advertising
            readiness, and provider onboarding operations.
          </p>
        </div>
        <Suspense fallback={<p className="login-note">Loading secure login...</p>}>
          <LoginForm authConfigured={authConfig.configured} />
        </Suspense>
        <div className="login-links">
          <Link href="/">Public site</Link>
          <Link href="/discover">Search communities</Link>
        </div>
      </section>
    </main>
  );
}
