"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MailCheck, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type {
  ProviderClaimRecord,
  ProviderClaimStatus,
  ProviderVerificationAttemptRecord,
  ProviderVerificationMethod
} from "@/lib/domain/claims";

type ClaimVerificationConsoleProps = {
  initialClaims: ProviderClaimRecord[];
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

const ownerActorId = "00000000-0000-4000-8000-000000000001";
const claimStatuses: ProviderClaimStatus[] = [
  "submitted",
  "email_pending",
  "phone_pending",
  "document_pending",
  "admin_review",
  "approved",
  "rejected",
  "conflict"
];

export function ClaimVerificationConsole({ initialClaims }: ClaimVerificationConsoleProps) {
  const [claims, setClaims] = useState(initialClaims);
  const [selectedClaimId, setSelectedClaimId] = useState(initialClaims[0]?.id ?? "");
  const [attemptsByClaim, setAttemptsByClaim] = useState<Record<string, ProviderVerificationAttemptRecord[]>>({});
  const [method, setMethod] = useState<ProviderVerificationMethod>("business_email");
  const [target, setTarget] = useState(initialClaims[0]?.businessDomain ?? initialClaims[0]?.claimantEmail ?? "");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const selectedClaim = claims.find((claim) => claim.id === selectedClaimId);
  const selectedAttempts = selectedClaimId ? attemptsByClaim[selectedClaimId] ?? [] : [];
  const pendingAttempt = selectedAttempts.find((attempt) => attempt.status === "pending");
  const passedAttempt = selectedAttempts.find((attempt) => attempt.status === "passed");
  const claimCounts = useMemo(
    () =>
      claimStatuses.map((status) => ({
        status,
        count: claims.filter((claim) => claim.status === status).length
      })),
    [claims]
  );

  async function refreshClaims() {
    setLoadingKey("refresh-claims");
    const response = await fetch("/api/v1/admin/provider-claims");
    const payload = await response.json().catch(() => ({}));

    if (response.ok && Array.isArray(payload.data)) {
      setClaims(payload.data);
      const nextClaim = payload.data.find((claim: ProviderClaimRecord) => claim.id === selectedClaimId) ?? payload.data[0];
      setSelectedClaimId(nextClaim?.id ?? "");
      setTarget(nextClaim?.businessDomain ?? nextClaim?.claimantEmail ?? "");
    }

    setLoadingKey(null);
    setActionState({
      ok: response.ok,
      message: response.ok ? "Claim queue refreshed." : payload.error ?? "Claim refresh failed."
    });
  }

  async function loadAttempts(claimId = selectedClaimId) {
    if (!claimId) return;

    setLoadingKey(`load-attempts-${claimId}`);
    const response = await fetch(`/api/v1/admin/provider-claims/${claimId}/verification-attempts`);
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && Array.isArray(payload.data)) {
      setAttemptsByClaim((current) => ({ ...current, [claimId]: payload.data }));
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "Verification attempts loaded." : payload.error ?? "Could not load attempts."
    });
  }

  async function createAttempt() {
    if (!selectedClaim) return;

    setLoadingKey("create-attempt");
    const response = await fetch(`/api/v1/admin/provider-claims/${selectedClaim.id}/verification-attempts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method,
        target: target || selectedClaim.businessDomain || selectedClaim.claimantEmail,
        attemptPayload: { source: "admin_claim_console" },
        actorId: ownerActorId
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setAttemptsByClaim((current) => ({
        ...current,
        [selectedClaim.id]: [payload.data, ...(current[selectedClaim.id] ?? []).filter((attempt) => attempt.id !== payload.data.id)]
      }));
      await refreshClaims();
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "Verification attempt created or reused." : payload.error ?? "Attempt creation failed."
    });
  }

  async function sendAttempt(attempt: ProviderVerificationAttemptRecord) {
    const key = `send-${attempt.id}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/provider-verification-attempts/${attempt.id}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorId: ownerActorId })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok) {
      await loadAttempts(attempt.providerClaimId);
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `${payload.data?.status ?? "Delivery"} via ${payload.data?.channel ?? "verification"} recorded.`
        : payload.error ?? "Verification send failed."
    });
  }

  async function completeAttempt(attempt: ProviderVerificationAttemptRecord, status: "passed" | "failed") {
    const key = `${status}-${attempt.id}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/provider-verification-attempts/${attempt.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        evidence: {
          evidenceType: attempt.method,
          note: `Marked ${status} from admin claim verification console.`
        },
        actorId: ownerActorId
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setAttemptsByClaim((current) => ({
        ...current,
        [attempt.providerClaimId]: (current[attempt.providerClaimId] ?? []).map((item) =>
          item.id === attempt.id ? payload.data : item
        )
      }));
      await refreshClaims();
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? `Verification marked ${status}.` : payload.error ?? "Verification completion failed."
    });
  }

  async function reviewDocumentAttempt(attempt: ProviderVerificationAttemptRecord, decision: "approved" | "rejected") {
    if (!selectedClaim) return;

    const key = `document-${decision}-${attempt.id}`;
    const documentUrl =
      typeof attempt.attemptPayload.documentUrl === "string"
        ? attempt.attemptPayload.documentUrl
        : attempt.target?.startsWith("http")
          ? attempt.target
          : undefined;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/provider-claims/${selectedClaim.id}/document-review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: attempt.id,
        decision,
        reviewerId: ownerActorId,
        reviewerNotes: `${decision === "approved" ? "Approved" : "Rejected"} license document from admin claim console.`,
        evidence: {
          documentType: "license",
          documentUrl,
          matchedProviderName: decision === "approved",
          matchedProviderAddress: decision === "approved",
          attestationAccepted: true
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data?.attempt) {
      setAttemptsByClaim((current) => ({
        ...current,
        [attempt.providerClaimId]: (current[attempt.providerClaimId] ?? []).map((item) =>
          item.id === attempt.id ? payload.data.attempt : item
        )
      }));
      await refreshClaims();
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Document review ${decision}; verification marked ${payload.data?.attempt?.status ?? "updated"}.`
        : payload.error ?? "Document review failed."
    });
  }

  async function decideClaim(decision: "approve" | "reject") {
    if (!selectedClaim) return;

    const key = `${decision}-${selectedClaim.id}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/provider-claims/${selectedClaim.id}/${decision}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        adminNotes: `${decision === "approve" ? "Approved" : "Rejected"} from admin claim verification console.`,
        actorId: ownerActorId
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setClaims((current) =>
        current.map((claim) =>
          claim.id === selectedClaim.id
            ? { ...claim, status: decision === "approve" ? "approved" : "rejected", updatedAt: new Date().toISOString() }
            : claim
        )
      );
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Claim ${decision === "approve" ? "approved and provider marked claimed" : "rejected"}.`
        : payload.error ?? "Claim decision failed."
    });
  }

  async function expireAttempts() {
    setLoadingKey("expire-attempts");
    const response = await fetch("/api/v1/admin/provider-verification-attempts/expire", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claimId: selectedClaimId || undefined, actorId: ownerActorId, limit: 25 })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && selectedClaimId) {
      await loadAttempts(selectedClaimId);
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? `${payload.data?.expired ?? 0} expired verification attempts closed.` : payload.error ?? "Expiry failed."
    });
  }

  return (
    <div className="claim-console">
      <article className="claim-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Claim queue</p>
            <h3>Operator claims</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={loadingKey === "refresh-claims"} onClick={refreshClaims}>
            {loadingKey === "refresh-claims" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="claim-status-grid">
          {claimCounts.map((item) => (
            <div className={`claim-status-card ${item.status}`} key={item.status}>
              <strong>{item.count}</strong>
              <span>{item.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>

        <div className="claim-list">
          {claims.slice(0, 8).map((claim) => (
            <button
              className={claim.id === selectedClaimId ? "claim-row active" : "claim-row"}
              key={claim.id}
              type="button"
              onClick={() => {
                setSelectedClaimId(claim.id);
                setTarget(claim.businessDomain ?? claim.claimantEmail);
              }}
            >
              <span>
                <strong>{claim.claimantName}</strong>
                <small>{claim.businessDomain ?? claim.claimantEmail}</small>
              </span>
              <b>{claim.status.replaceAll("_", " ")}</b>
            </button>
          ))}
          {!claims.length ? (
            <div className="empty-governance-state compact">
              <strong>No provider claims yet</strong>
              <span>New operator claims will appear here for verification.</span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="claim-panel claim-workbench-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Verification workbench</p>
            <h3>{selectedClaim?.claimantName ?? "Select a claim"}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={!selectedClaimId || Boolean(loadingKey)} onClick={() => loadAttempts()}>
            {loadingKey?.startsWith("load-attempts") ? <Loader2 className="spin-icon" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Load attempts
          </button>
        </div>

        <div className="claim-verification-form">
          <label className="field-stack">
            <span>Method</span>
            <select value={method} onChange={(event) => setMethod(event.target.value as ProviderVerificationMethod)}>
              <option value="business_email">Business email</option>
              <option value="business_phone">Business phone</option>
              <option value="license_document">License document</option>
              <option value="domain_dns">Domain DNS</option>
              <option value="admin_manual">Admin manual</option>
            </select>
          </label>
          <label className="field-stack">
            <span>Target</span>
            <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="domain, email, or phone" />
          </label>
          <button className="button primary" type="button" disabled={!selectedClaim || Boolean(loadingKey)} onClick={createAttempt}>
            {loadingKey === "create-attempt" ? "Creating..." : "Create verification"}
          </button>
        </div>

        <div className="attempt-list">
          {selectedAttempts.map((attempt) => (
            <article className={`attempt-row ${attempt.status}`} key={attempt.id}>
              <span>
                <strong>{attempt.method.replaceAll("_", " ")}</strong>
                <small>{attempt.target ?? "manual target"} - {attempt.status}</small>
              </span>
              <div className="attempt-actions">
                {attempt.status === "pending" ? (
                  <>
                    <button className="tiny-icon-button" type="button" disabled={Boolean(loadingKey)} onClick={() => sendAttempt(attempt)}>
                      {loadingKey === `send-${attempt.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <MailCheck aria-hidden="true" />}
                      Send
                    </button>
                    <button className="tiny-icon-button approve" type="button" disabled={Boolean(loadingKey)} onClick={() => completeAttempt(attempt, "passed")}>
                      {loadingKey === `passed-${attempt.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                      Pass
                    </button>
                    <button className="tiny-icon-button block" type="button" disabled={Boolean(loadingKey)} onClick={() => completeAttempt(attempt, "failed")}>
                      {loadingKey === `failed-${attempt.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                      Fail
                    </button>
                    {attempt.method === "license_document" ? (
                      <>
                        <button className="tiny-icon-button approve" type="button" disabled={Boolean(loadingKey)} onClick={() => reviewDocumentAttempt(attempt, "approved")}>
                          {loadingKey === `document-approved-${attempt.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                          Review
                        </button>
                        <button className="tiny-icon-button block" type="button" disabled={Boolean(loadingKey)} onClick={() => reviewDocumentAttempt(attempt, "rejected")}>
                          {loadingKey === `document-rejected-${attempt.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                          Reject doc
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <b>{attempt.status}</b>
                )}
              </div>
            </article>
          ))}
          {!selectedAttempts.length ? (
            <div className="empty-governance-state compact">
              <strong>No attempts loaded</strong>
              <span>Load attempts or create a new verification step for this claim.</span>
            </div>
          ) : null}
        </div>

        <div className="claim-decision-row">
          <button className="button secondary" type="button" disabled={!selectedClaim || Boolean(loadingKey)} onClick={expireAttempts}>
            {loadingKey === "expire-attempts" ? "Expiring..." : "Expire stale attempts"}
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!selectedClaim || selectedClaim.status === "approved" || selectedClaim.status === "rejected" || Boolean(loadingKey)}
            onClick={() => decideClaim("reject")}
          >
            Reject claim
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!selectedClaim || !passedAttempt || selectedClaim.status === "approved" || selectedClaim.status === "rejected" || Boolean(loadingKey)}
            onClick={() => decideClaim("approve")}
          >
            Approve claim
          </button>
        </div>

        {pendingAttempt ? <p className="claim-hint">A pending verification is waiting for delivery or evidence review.</p> : null}
        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>
    </div>
  );
}
