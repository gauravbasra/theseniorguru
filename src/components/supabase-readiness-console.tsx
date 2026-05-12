"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Database, FileCode2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { SupabaseMigrationBundle } from "@/lib/system/supabase-migration-bundle";
import type { getSupabaseLaunchReadiness } from "@/lib/system/supabase-launch-readiness";

type SupabaseLaunchReadiness = Awaited<ReturnType<typeof getSupabaseLaunchReadiness>>;

type SupabaseReadinessConsoleProps = {
  initialReadiness: SupabaseLaunchReadiness;
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function SupabaseReadinessConsole({ initialReadiness }: SupabaseReadinessConsoleProps) {
  const [readiness, setReadiness] = useState(initialReadiness);
  const [loading, setLoading] = useState(false);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundle, setBundle] = useState<SupabaseMigrationBundle | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  async function refreshReadiness() {
    setLoading(true);
    const response = await fetch("/api/v1/admin/supabase-readiness");
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (response.ok && payload.data) {
      setReadiness(payload.data);
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Supabase readiness refreshed: ${statusLabel(payload.data?.launchDecision ?? readiness.launchDecision)}.`
        : payload.error ?? "Supabase readiness refresh failed."
    });
  }

  async function loadMigrationBundle() {
    setBundleLoading(true);
    const response = await fetch("/api/v1/admin/supabase-migration-bundle");
    const payload = await response.json().catch(() => ({}));
    setBundleLoading(false);

    if (response.ok && payload.data) {
      setBundle(payload.data);
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Migration bundle ready: ${payload.data?.migrationCount ?? 0} files, checksum ${String(payload.data?.bundleSha256 ?? "").slice(0, 12)}.`
        : payload.error ?? "Migration bundle generation failed."
    });
  }

  const topCapabilities = readiness.schema.capabilityRows.slice(0, 8);

  return (
    <div className="supabase-console">
      <article className="supabase-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Persistent backend</p>
            <h3>{statusLabel(readiness.launchDecision)}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={loading} onClick={refreshReadiness}>
            {loading ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="supabase-status-grid">
          <div>
            <strong>{readiness.metrics.tableReadinessPercent}%</strong>
            <span>Tables ready</span>
          </div>
          <div>
            <strong>{readiness.metrics.columnReadinessPercent}%</strong>
            <span>Columns ready</span>
          </div>
          <div>
            <strong>{readiness.metrics.migrationFileReadinessPercent}%</strong>
            <span>Migration files</span>
          </div>
          <div>
            <strong>{readiness.metrics.blockedCapabilities}</strong>
            <span>Blocked areas</span>
          </div>
        </div>

        <div className="supabase-mode-card">
          <Database aria-hidden="true" />
          <span>
            <strong>{statusLabel(readiness.persistence.mode)}</strong>
            <small>
              {readiness.persistence.durableAcrossDeploys
                ? "Writes are configured for durable Supabase storage."
                : "Writes are running in fallback memory until Supabase production secrets are installed."}
            </small>
          </span>
        </div>

        <div className="supabase-bars">
          <ProgressBar label="Required tables" ready={readiness.schema.tableSummary.ready} total={readiness.schema.tableSummary.required} />
          <ProgressBar label="Required columns" ready={readiness.schema.columnSummary.ready} total={readiness.schema.columnSummary.required} />
          <ProgressBar
            label="Migration manifest"
            ready={readiness.migrationPlan.migrationCount - readiness.migrationPlan.missingFiles.length}
            total={readiness.migrationPlan.migrationCount}
          />
        </div>
      </article>

      <article className="supabase-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Capability coverage</p>
            <h3>{statusLabel(readiness.schema.status)}</h3>
          </div>
          <ShieldCheck aria-hidden="true" />
        </div>

        <div className="supabase-capability-list">
          {topCapabilities.map((capability) => (
            <div className="supabase-capability-row" key={capability.key}>
              <span>
                <strong>{statusLabel(capability.key)}</strong>
                <small>{statusLabel(capability.status)} - {capability.totalRows} rows</small>
              </span>
              <b>{capability.tableProgress.ready}/{capability.tableProgress.required}</b>
            </div>
          ))}
        </div>

        <div className="response-preview">
          <strong>{readiness.nextActions.length ? "Next backend action" : "Supabase backend ready"}</strong>
          <p>{readiness.nextActions[0] ?? "Persistent imports, claims, ads, newsroom, reviews, and Open API workflows can use Supabase."}</p>
        </div>

        <button className="icon-text-button full-width-action" type="button" disabled={bundleLoading} onClick={loadMigrationBundle}>
          {bundleLoading ? <Loader2 className="spin-icon" aria-hidden="true" /> : <FileCode2 aria-hidden="true" />}
          Build migration bundle
        </button>

        {bundle ? (
          <div className="migration-bundle-card">
            <span>
              <strong>{bundle.migrationCount} migrations</strong>
              <small>{bundle.totalBytes.toLocaleString()} bytes ordered for Supabase SQL Editor</small>
            </span>
            <code>{bundle.bundleSha256.slice(0, 24)}</code>
          </div>
        ) : null}

        {readiness.migrationPlan.ownerParkedItems.length ? (
          <p className="claim-hint">{readiness.migrationPlan.ownerParkedItems[0]}</p>
        ) : null}
        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>
    </div>
  );
}

function ProgressBar({ label, ready, total }: { label: string; ready: number; total: number }) {
  const percent = total > 0 ? Math.round((ready / total) * 100) : 0;

  return (
    <div className="supabase-progress">
      <div>
        <span>{label}</span>
        <strong>{ready}/{total}</strong>
      </div>
      <i style={{ "--value": `${percent}%` } as CSSProperties} />
    </div>
  );
}
