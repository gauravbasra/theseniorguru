"use client";

import { useMemo, useState } from "react";
import { BarChart3, Gauge, Loader2, MousePointerClick, RadioTower, RefreshCw } from "lucide-react";
import type {
  AdCampaignReportingSummary,
  AdCreativeRecord,
  AdPlacementRecord,
  AdPlacementResponse,
  AdReadinessSummary
} from "@/lib/domain/ads";
import type { ProviderRecord } from "@/lib/domain/providers";

type AdRevenueConsoleProps = {
  initialPlacements: AdPlacementRecord[];
  initialProviders: ProviderRecord[];
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

const actorId = "00000000-0000-4000-8000-000000000001";

export function AdRevenueConsole({ initialPlacements, initialProviders }: AdRevenueConsoleProps) {
  const [placements, setPlacements] = useState(initialPlacements);
  const [selectedPlacementKey, setSelectedPlacementKey] = useState(initialPlacements[0]?.placementKey ?? "web.discover.top");
  const [selectedProviderId, setSelectedProviderId] = useState(initialProviders[0]?.id ?? "");
  const [placementResponse, setPlacementResponse] = useState<AdPlacementResponse | null>(null);
  const [creative, setCreative] = useState<AdCreativeRecord | null>(null);
  const [reporting, setReporting] = useState<AdCampaignReportingSummary | null>(null);
  const [readiness, setReadiness] = useState<AdReadinessSummary | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const selectedPlacement = placements.find((placement) => placement.placementKey === selectedPlacementKey);
  const selectedProvider = initialProviders.find((provider) => provider.id === selectedProviderId);
  const activeCreatives = reporting?.totals.activeCreatives ?? placementResponse?.creatives.length ?? 0;
  const selectedPlacementReport = reporting?.placements.find((placement) => placement.placementKey === selectedPlacementKey);
  const statusCards = useMemo(
    () => [
      { label: "Placements", value: String(placements.length) },
      { label: "Active creatives", value: String(activeCreatives) },
      { label: "Impressions", value: String(reporting?.totals.impressions ?? 0) },
      { label: "CTR", value: `${Math.round((reporting?.totals.ctr ?? 0) * 10000) / 100}%` }
    ],
    [activeCreatives, placements.length, reporting]
  );

  async function runAction<T>(
    key: string,
    request: () => Promise<Response>,
    onSuccess: (data: T) => string
  ) {
    setLoadingKey(key);
    const response = await request();
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok) {
      setActionState({ ok: true, message: onSuccess(payload.data as T) });
    } else {
      setActionState({ ok: false, message: payload.error ?? "Ad operation failed." });
    }

    return response.ok ? (payload.data as T) : null;
  }

  async function refreshPlacements() {
    const data = await runAction<AdPlacementRecord[]>(
      "placements",
      () => fetch("/api/v1/admin/ads/placements"),
      (records) => `${records.length} ad placements loaded.`
    );

    if (data) {
      setPlacements(data);
      setSelectedPlacementKey(data[0]?.placementKey ?? selectedPlacementKey);
    }
  }

  async function ensurePlacement() {
    const data = await runAction<AdPlacementRecord>(
      "upsert-placement",
      () => fetch("/api/v1/admin/ads/placements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placementKey: selectedPlacementKey,
          name: selectedPlacement?.name ?? "Discovery top sponsored placement",
          surface: selectedPlacement?.surface ?? "web",
          description: "Revenue placement for sponsored senior living visibility with required disclosure.",
          disclosureRequired: true,
          disclosureLabel: "Sponsored",
          isActive: true,
          actorId
        })
      }),
      (record) => `${record.name} is active for ${record.surface}.`
    );

    if (data) {
      setPlacements((current) => [data, ...current.filter((placement) => placement.placementKey !== data.placementKey)]);
    }
  }

  async function loadCreativeStack() {
    const data = await runAction<AdPlacementResponse>(
      "creative-stack",
      () => fetch(`/api/v1/ads/placements/${selectedPlacementKey}`),
      (record) => `${record.creatives.length} sponsored creative${record.creatives.length === 1 ? "" : "s"} available.`
    );

    if (data) {
      setPlacementResponse(data);
      setCreative(data.creatives[0] ?? null);
    }
  }

  async function createCreative() {
    const data = await runAction<AdCreativeRecord>(
      "create-creative",
      () => fetch("/api/v1/admin/ads/creatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placementKey: selectedPlacementKey,
          campaignName: `${selectedProvider?.name ?? "Senior Living"} sponsored visibility`,
          headline: `${selectedProvider?.name ?? "Featured senior living community"} near families searching today`,
          body: "Promote tours, availability, and trusted community highlights where families are actively comparing care options.",
          destinationUrl: selectedProvider ? `/providers/${selectedProvider.slug}` : "/operators",
          disclosureLabel: "Sponsored",
          budgetCents: 10000,
          creativePayload: {
            source: "admin_ad_revenue_console",
            providerId: selectedProviderId || undefined,
            audience: "families_searching_senior_care",
            revenueModel: "direct_sold_sponsored_visibility"
          },
          activate: true,
          actorId
        })
      }),
      (record) => `Creative created for ${record.placementKey}.`
    );

    if (data) {
      setCreative(data);
      await loadCreativeStack();
    }
  }

  async function recordEvent(type: "impression" | "click") {
    const eventCreative = creative ?? placementResponse?.creatives[0];
    const data = await runAction<{ recorded: boolean; duplicate: boolean; eventType: string }>(
      type,
      () => fetch(`/api/v1/ads/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placementKey: selectedPlacementKey,
          adCreativeId: eventCreative?.id,
          requestId: `admin-${type}-${Date.now()}`,
          destinationUrl: eventCreative?.destinationUrl,
          userContext: {
            source: "admin_ad_revenue_console",
            providerId: selectedProviderId || undefined
          }
        })
      }),
      (record) => `${record.eventType} ${record.recorded ? "recorded" : "deduplicated"}.`
    );

    if (data) {
      await loadReporting();
    }
  }

  async function loadReporting() {
    const data = await runAction<AdCampaignReportingSummary>(
      "reporting",
      () => fetch(`/api/v1/admin/ads/reporting?placementKey=${selectedPlacementKey}`),
      (summary) => `${summary.totals.impressions} impressions and ${summary.totals.clicks} clicks loaded.`
    );

    if (data) {
      setReporting(data);
    }
  }

  async function checkReadiness() {
    const data = await runAction<AdReadinessSummary>(
      "readiness",
      () => fetch("/api/v1/admin/ad-readiness"),
      (summary) => `Ad readiness is ${summary.status.replaceAll("_", " ")}.`
    );

    if (data) {
      setReadiness(data);
    }
  }

  return (
    <div className="ad-console">
      <article className="ad-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Sponsored inventory</p>
            <h3>{selectedPlacement?.name ?? selectedPlacementKey}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={Boolean(loadingKey)} onClick={refreshPlacements}>
            {loadingKey === "placements" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="ad-status-grid">
          {statusCards.map((card) => (
            <div key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          ))}
        </div>

        <label className="field-stack">
          <span>Placement</span>
          <select value={selectedPlacementKey} onChange={(event) => {
            setSelectedPlacementKey(event.target.value);
            setCreative(null);
            setPlacementResponse(null);
            setReporting(null);
          }}>
            {placements.map((placement) => (
              <option key={placement.placementKey} value={placement.placementKey}>
                {placement.name} - {placement.surface}
              </option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>Sponsored community</span>
          <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)}>
            {initialProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </label>

        <div className="ad-actions-grid">
          <button className="button primary" type="button" disabled={Boolean(loadingKey)} onClick={ensurePlacement}>
            {loadingKey === "upsert-placement" ? "Saving..." : "Activate placement"}
          </button>
          <button className="button secondary" type="button" disabled={Boolean(loadingKey)} onClick={createCreative}>
            Create creative
          </button>
          <button className="button secondary" type="button" disabled={Boolean(loadingKey)} onClick={loadCreativeStack}>
            Load stack
          </button>
        </div>

        <div className="ad-placement-list">
          {placements.slice(0, 6).map((placement) => (
            <button
              className={placement.placementKey === selectedPlacementKey ? "ad-row active" : "ad-row"}
              key={placement.placementKey}
              type="button"
              onClick={() => setSelectedPlacementKey(placement.placementKey)}
            >
              <span>
                <strong>{placement.name}</strong>
                <small>{placement.placementKey}</small>
              </span>
              <b>{placement.isActive ? "active" : "paused"}</b>
            </button>
          ))}
        </div>
      </article>

      <article className="ad-panel">
        <p className="eyebrow">Revenue tracking</p>
        <h3>{creative?.headline ?? "Create or load a sponsored creative"}</h3>

        <div className="ad-actions-grid">
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={loadReporting}>
            {loadingKey === "reporting" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <BarChart3 aria-hidden="true" />}
            Reporting
          </button>
          <button className="small-action approve" type="button" disabled={!creative || Boolean(loadingKey)} onClick={() => recordEvent("impression")}>
            {loadingKey === "impression" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RadioTower aria-hidden="true" />}
            Impression
          </button>
          <button className="small-action approve" type="button" disabled={!creative || Boolean(loadingKey)} onClick={() => recordEvent("click")}>
            {loadingKey === "click" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <MousePointerClick aria-hidden="true" />}
            Click
          </button>
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={checkReadiness}>
            {loadingKey === "readiness" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Gauge aria-hidden="true" />}
            Readiness
          </button>
        </div>

        <div className="ad-metric-board">
          <div>
            <strong>{selectedPlacementReport?.impressions ?? reporting?.totals.impressions ?? 0}</strong>
            <span>Tracked impressions</span>
          </div>
          <div>
            <strong>{selectedPlacementReport?.clicks ?? reporting?.totals.clicks ?? 0}</strong>
            <span>Tracked clicks</span>
          </div>
          <div>
            <strong>{Math.round(((selectedPlacementReport?.ctr ?? reporting?.totals.ctr ?? 0) * 10000)) / 100}%</strong>
            <span>Click-through rate</span>
          </div>
        </div>

        <div className="response-preview">
          <strong>{readiness ? `Readiness: ${readiness.status.replaceAll("_", " ")}` : "Ad readiness not checked"}</strong>
          <p>{readiness?.nextActions[0] ?? reporting?.nextActions[0] ?? "Run reporting and readiness after activating direct-sold placements."}</p>
        </div>

        {creative ? <p className="claim-hint">Active creative: {creative.id}</p> : null}
        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>
    </div>
  );
}
