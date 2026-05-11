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
            Run a full owner workflow that imports listings, checks duplicates, saves communities, starts a care
            circle, activates a growth plan, and measures event promotion performance.
          </p>
          <div className="actions">
            <Link className="button secondary" href="/provider">Provider dashboard</Link>
            <Link className="button secondary" href="/admin">Owner command center</Link>
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
