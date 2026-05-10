import Link from "next/link";
import { WorkbenchClient } from "@/components/workbench-client";
import { getSystemReadiness } from "@/lib/system/readiness";

export default function WorkbenchPage() {
  const readiness = getSystemReadiness();

  return (
    <main className="workbench-shell">
      <section className="workbench-hero">
        <div>
          <p className="eyebrow">Founder workbench</p>
          <h1>Use the product, not just the pages.</h1>
          <p className="lede">
            This screen connects the backend workflows already built for The Senior Guru into one executable console.
            Run it to prove the platform has real services behind the interface.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/provider">Provider dashboard</Link>
            <Link className="button secondary" href="/api/v1/openapi">OpenAPI</Link>
          </div>
        </div>
        <aside className="workbench-status">
          <p className="eyebrow">System status</p>
          <h2>{readiness.overallStatus.replaceAll("_", " ")}</h2>
          <p>Owner-only production credentials are reported separately; local fallback workflows remain executable.</p>
        </aside>
      </section>
      <WorkbenchClient />
    </main>
  );
}

