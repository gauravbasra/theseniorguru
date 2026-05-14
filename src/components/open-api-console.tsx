"use client";

import { useMemo, useState } from "react";
import { Download, KeyRound, Loader2, RefreshCw, RotateCcw, Send, ShieldCheck, Webhook } from "lucide-react";
import type {
  ApiAuditEventRecord,
  ApiClientRecord,
  ApiKeyRecord,
  ApiUsageAnalyticsSummary,
  CreatedApiKeyRecord,
  CreatedWebhookSubscriptionRecord,
  WebhookDeliveryRecord,
  WebhookSubscriptionRecord
} from "@/lib/domain/open-api";

type OpenApiConsoleProps = {
  initialClients: ApiClientRecord[];
  initialSubscriptions: WebhookSubscriptionRecord[];
  initialDeliveries: WebhookDeliveryRecord[];
  initialAuditEvents: ApiAuditEventRecord[];
  initialUsageAnalytics: ApiUsageAnalyticsSummary;
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

const actorId = "00000000-0000-4000-8000-000000000001";

export function OpenApiConsole({
  initialClients,
  initialSubscriptions,
  initialDeliveries,
  initialAuditEvents,
  initialUsageAnalytics
}: OpenApiConsoleProps) {
  const [clients, setClients] = useState(initialClients);
  const [selectedClientId, setSelectedClientId] = useState(initialClients[0]?.id ?? "");
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [usageAnalytics, setUsageAnalytics] = useState(initialUsageAnalytics);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const selectedClient = clients.find((client) => client.id === selectedClientId);
  const deliveryCounts = useMemo(
    () => ({
      queued: deliveries.filter((delivery) => delivery.status === "queued").length,
      delivered: deliveries.filter((delivery) => delivery.status === "delivered").length,
      failed: deliveries.filter((delivery) => delivery.status === "failed").length,
      blocked: deliveries.filter((delivery) => delivery.status === "blocked").length
    }),
    [deliveries]
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
      return payload.data as T;
    }

    setActionState({ ok: false, message: payload.error ?? "Open API operation failed." });
    return null;
  }

  async function refreshAll() {
    setLoadingKey("refresh");
    const [clientResponse, subscriptionResponse, deliveryResponse, auditResponse, usageResponse] = await Promise.all([
      fetch("/api/v1/admin/api-clients"),
      fetch("/api/v1/admin/webhook-subscriptions"),
      fetch("/api/v1/admin/webhook-deliveries"),
      fetch("/api/v1/admin/api-audit-events"),
      fetch("/api/v1/admin/api-usage-analytics")
    ]);
    const [clientPayload, subscriptionPayload, deliveryPayload, auditPayload, usagePayload] = await Promise.all([
      clientResponse.json().catch(() => ({})),
      subscriptionResponse.json().catch(() => ({})),
      deliveryResponse.json().catch(() => ({})),
      auditResponse.json().catch(() => ({})),
      usageResponse.json().catch(() => ({}))
    ]);
    setLoadingKey(null);

    if (clientResponse.ok && Array.isArray(clientPayload.data)) {
      setClients(clientPayload.data);
      setSelectedClientId(clientPayload.data[0]?.id ?? selectedClientId);
    }

    if (subscriptionResponse.ok && Array.isArray(subscriptionPayload.data)) setSubscriptions(subscriptionPayload.data);
    if (deliveryResponse.ok && Array.isArray(deliveryPayload.data)) setDeliveries(deliveryPayload.data);
    if (auditResponse.ok && Array.isArray(auditPayload.data)) setAuditEvents(auditPayload.data);
    if (usageResponse.ok && usagePayload.data) setUsageAnalytics(usagePayload.data);

    setActionState({
      ok: clientResponse.ok && subscriptionResponse.ok && deliveryResponse.ok && auditResponse.ok && usageResponse.ok,
      message: "Open API clients, webhooks, deliveries, audit events, and usage analytics refreshed."
    });
  }

  async function createClient() {
    const data = await runAction<ApiClientRecord>(
      "create-client",
      () => fetch("/api/v1/admin/api-clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Launch partner integration",
          ownerType: "partner",
          scopes: ["providers:read", "events:read", "reviews:read", "usage:read", "webhooks:write"],
          sandboxMode: true,
          rateLimitPerMinute: 120
        })
      }),
      (client) => `${client.name} created with ${client.scopes.length} scopes.`
    );

    if (data) {
      setClients((current) => [data, ...current.filter((client) => client.id !== data.id)]);
      setSelectedClientId(data.id);
    }
  }

  async function loadKeys(clientId = selectedClientId) {
    if (!clientId) return;

    const data = await runAction<ApiKeyRecord[]>(
      "keys",
      () => fetch(`/api/v1/admin/api-clients/${clientId}/keys`),
      (records) => `${records.length} API key${records.length === 1 ? "" : "s"} loaded.`
    );

    if (data) setKeys(data);
  }

  async function createKey() {
    if (!selectedClientId) return;

    const data = await runAction<CreatedApiKeyRecord>(
      "create-key",
      () => fetch(`/api/v1/admin/api-clients/${selectedClientId}/keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Admin generated partner key" })
      }),
      (record) => `API key ${record.keyPreview} created. Secret is shown once.`
    );

    if (data) {
      setLastSecret(data.secret);
      setKeys((current) => [{ ...data, secret: undefined } as ApiKeyRecord, ...current]);
    }
  }

  async function revokeFirstKey() {
    const activeKey = keys.find((key) => key.status === "active");

    if (!selectedClientId || !activeKey) return;

    const data = await runAction<ApiKeyRecord>(
      "revoke-key",
      () => fetch(`/api/v1/admin/api-clients/${selectedClientId}/keys/${activeKey.id}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Admin console rotation test", actorId })
      }),
      (record) => `API key ${record.keyPreview} revoked with audit event.`
    );

    if (data) {
      setKeys((current) => current.map((key) => (key.id === data.id ? data : key)));
      await refreshAuditEvents();
    }
  }

  async function createSubscription() {
    if (!selectedClientId) return;

    const data = await runAction<CreatedWebhookSubscriptionRecord>(
      "create-subscription",
      () => fetch("/api/v1/admin/webhook-subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiClientId: selectedClientId,
          targetUrl: "https://example.com/the-senior-guru/webhook",
          eventTypes: ["provider.updated", "review.created", "event.created"]
        })
      }),
      (record) => `Webhook subscription ${record.signingSecretPreview} created. Secret is shown once.`
    );

    if (data) {
      setLastSecret(data.signingSecret);
      setSubscriptions((current) => [data, ...current.filter((subscription) => subscription.id !== data.id)]);
    }
  }

  async function enqueueDelivery() {
    const data = await runAction<WebhookDeliveryRecord[]>(
      "enqueue",
      () => fetch("/api/v1/admin/webhook-deliveries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "provider.updated",
          subjectId: "admin-console-provider",
          payload: {
            providerId: "admin-console-provider",
            status: "updated",
            source: "open_api_console"
          }
        })
      }),
      (records) => `${records.length} webhook deliver${records.length === 1 ? "y" : "ies"} queued.`
    );

    if (data) {
      setDeliveries((current) => [...data, ...current]);
    }
  }

  async function runDryDelivery() {
    const data = await runAction<{ processed: number; attempts: unknown[] }>(
      "dry-run",
      () => fetch("/api/v1/admin/webhook-deliveries/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true, limit: 10 })
      }),
      (result) => `${result.processed} queued deliveries processed in dry-run mode.`
    );

    if (data) {
      await refreshDeliveries();
    }
  }

  async function retryDeliveries() {
    const data = await runAction<{ requeued: number }>(
      "retry",
      () => fetch("/api/v1/admin/webhook-deliveries/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "failed", limit: 10, reason: "Admin console retry", actorId })
      }),
      (result) => `${result.requeued} failed deliveries requeued.`
    );

    if (data) {
      await refreshDeliveries();
      await refreshAuditEvents();
    }
  }

  async function replayDeliveries() {
    const data = await runAction<{ replayed: number }>(
      "replay",
      () => fetch("/api/v1/admin/webhook-deliveries/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "failed", limit: 10, reason: "Admin console replay", actorId })
      }),
      (result) => `${result.replayed} historical webhook deliver${result.replayed === 1 ? "y" : "ies"} replayed as fresh queued records.`
    );

    if (data) {
      await refreshDeliveries();
      await refreshAuditEvents();
    }
  }

  async function refreshDeliveries() {
    const response = await fetch("/api/v1/admin/webhook-deliveries");
    const payload = await response.json().catch(() => ({}));

    if (response.ok && Array.isArray(payload.data)) setDeliveries(payload.data);
  }

  async function refreshAuditEvents() {
    const response = await fetch("/api/v1/admin/api-audit-events");
    const payload = await response.json().catch(() => ({}));

    if (response.ok && Array.isArray(payload.data)) setAuditEvents(payload.data);
  }

  return (
    <div className="open-api-console">
      <article className="open-api-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Partner access</p>
            <h3>{selectedClient?.name ?? "Create an API client"}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={Boolean(loadingKey)} onClick={refreshAll}>
            {loadingKey === "refresh" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="open-api-status-grid">
          <div><strong>{clients.length}</strong><span>Clients</span></div>
          <div><strong>{keys.length}</strong><span>Keys loaded</span></div>
          <div><strong>{subscriptions.length}</strong><span>Webhooks</span></div>
          <div><strong>{auditEvents.length}</strong><span>Audit events</span></div>
        </div>

        <label className="field-stack">
          <span>API client</span>
          <select value={selectedClientId} onChange={(event) => {
            setSelectedClientId(event.target.value);
            setKeys([]);
            setLastSecret(null);
          }}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
            {!clients.length ? <option value="">No clients yet</option> : null}
          </select>
        </label>

        <div className="open-api-actions-grid">
          <button className="button primary" type="button" disabled={Boolean(loadingKey)} onClick={createClient}>Create client</button>
          <button className="button secondary" type="button" disabled={!selectedClientId || Boolean(loadingKey)} onClick={() => loadKeys()}>
            Load keys
          </button>
          <button className="button secondary" type="button" disabled={!selectedClientId || Boolean(loadingKey)} onClick={createKey}>
            Create key
          </button>
        </div>

        <div className="open-api-actions-grid">
          <button className="small-action" type="button" disabled={!keys.some((key) => key.status === "active") || Boolean(loadingKey)} onClick={revokeFirstKey}>
            {loadingKey === "revoke-key" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            Revoke key
          </button>
          <button className="small-action" type="button" disabled={!selectedClientId || Boolean(loadingKey)} onClick={createSubscription}>
            {loadingKey === "create-subscription" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Webhook aria-hidden="true" />}
            Webhook
          </button>
        </div>

        <div className="open-api-list">
          {clients.slice(0, 6).map((client) => (
            <button
              className={client.id === selectedClientId ? "open-api-row active" : "open-api-row"}
              key={client.id}
              type="button"
              onClick={() => {
                setSelectedClientId(client.id);
                setKeys([]);
              }}
            >
              <span>
                <strong>{client.name}</strong>
                <small>{client.scopes.join(", ")}</small>
              </span>
              <b>{client.status}</b>
            </button>
          ))}
          {!clients.length ? (
            <div className="empty-governance-state compact">
              <strong>No API clients yet</strong>
              <span>Create a scoped partner client before issuing keys or webhooks.</span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="open-api-panel">
        <p className="eyebrow">Webhook operations</p>
        <h3>{deliveryCounts.queued} queued deliveries</h3>

        <div className="open-api-status-grid">
          <div><strong>{deliveryCounts.queued}</strong><span>Queued</span></div>
          <div><strong>{deliveryCounts.delivered}</strong><span>Delivered</span></div>
          <div><strong>{deliveryCounts.failed}</strong><span>Failed</span></div>
          <div><strong>{deliveryCounts.blocked}</strong><span>Blocked</span></div>
        </div>

        <div className="open-api-actions-grid">
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={enqueueDelivery}>
            {loadingKey === "enqueue" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Enqueue
          </button>
          <button className="small-action approve" type="button" disabled={Boolean(loadingKey)} onClick={runDryDelivery}>
            {loadingKey === "dry-run" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Dry run
          </button>
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={retryDeliveries}>
            {loadingKey === "retry" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            Retry failed
          </button>
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={replayDeliveries}>
            {loadingKey === "replay" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Webhook aria-hidden="true" />}
            Replay failed
          </button>
          <a className="small-action" href="/api/v1/admin/webhook-deliveries/replay/export?format=csv">
            <Download aria-hidden="true" />
            Replay evidence
          </a>
        </div>

        <div className="open-api-list">
          {deliveries.slice(0, 6).map((delivery) => (
            <div className="open-api-row" key={delivery.id}>
              <span>
                <strong>{delivery.eventType}</strong>
                <small>{delivery.subjectId ?? delivery.subscriptionId}</small>
              </span>
              <b>{delivery.status}</b>
            </div>
          ))}
          {!deliveries.length ? (
            <div className="empty-governance-state compact">
              <strong>No webhook deliveries yet</strong>
              <span>Create a subscription, enqueue an event, then run dry delivery.</span>
            </div>
          ) : null}
        </div>

        <div className="response-preview">
          <strong>{lastSecret ? "One-time secret generated" : "Secrets stay redacted after creation"}</strong>
          <p>{lastSecret ?? "API keys and webhook signing secrets are only surfaced once, then the dashboard shows previews and audit records."}</p>
          <a className="mini-link" href="/api/v1/partner/webhooks/signing-guide">Webhook signing guide</a>
        </div>

        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>

      <article className="open-api-panel">
        <p className="eyebrow">Usage analytics</p>
        <h3>{usageAnalytics.totals.requests} partner API calls</h3>
        <a className="mini-link" href="/api/v1/admin/api-usage-analytics?format=csv">Export usage CSV</a>

        <div className="open-api-status-grid">
          <div><strong>{usageAnalytics.totals.allowed}</strong><span>Allowed</span></div>
          <div><strong>{usageAnalytics.totals.blocked}</strong><span>Blocked</span></div>
          <div><strong>{usageAnalytics.totals.rateLimited}</strong><span>Rate limited</span></div>
          <div><strong>{usageAnalytics.totals.webhookDeliveries}</strong><span>Webhook volume</span></div>
          <div><strong>{usageAnalytics.retentionPolicy.auditRetentionDays}</strong><span>Retention days</span></div>
          <div><strong>{usageAnalytics.retentionPolicy.retentionCandidates}</strong><span>Purge candidates</span></div>
        </div>

        <div className="open-api-list">
          {usageAnalytics.clients.slice(0, 5).map((client) => (
            <div className="open-api-row" key={client.apiClientId}>
              <span>
                <strong>{client.name}</strong>
                <small>{client.requests} calls, {client.activeKeys} active keys, {client.webhookDeliveries} webhooks</small>
              </span>
              <b>{client.status}</b>
            </div>
          ))}
          {!usageAnalytics.clients.length ? (
            <div className="empty-governance-state compact">
              <strong>No usage yet</strong>
              <span>Issue a scoped key and run a partner endpoint smoke call.</span>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
