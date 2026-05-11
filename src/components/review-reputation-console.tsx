"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, MessageSquareReply, RefreshCw, Send, Star, Wand2 } from "lucide-react";
import type { ProviderRecord } from "@/lib/domain/providers";
import type { ReviewRecord, ReviewResponseDraft } from "@/lib/domain/reviews";

type ReviewReputationConsoleProps = {
  initialProviders: ProviderRecord[];
  initialReviews: ReviewRecord[];
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

type CampaignPayload = {
  campaign?: {
    id?: string;
    status?: string;
  };
  requests?: unknown[];
};

const actorId = "00000000-0000-4000-8000-000000000001";

export function ReviewReputationConsole({ initialProviders, initialReviews }: ReviewReputationConsoleProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [selectedProviderId, setSelectedProviderId] = useState(initialProviders[0]?.id ?? "");
  const [selectedReviewId, setSelectedReviewId] = useState(initialReviews[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState<ReviewResponseDraft | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const selectedProvider = initialProviders.find((provider) => provider.id === selectedProviderId);
  const selectedReview = reviews.find((review) => review.id === selectedReviewId);
  const reviewCounts = useMemo(
    () => ({
      pending: reviews.filter((review) => review.status === "pending_moderation").length,
      published: reviews.filter((review) => review.status === "published").length,
      hidden: reviews.filter((review) => review.status === "hidden").length,
      blocked: reviews.filter((review) => review.status === "blocked_by_policy").length
    }),
    [reviews]
  );

  async function refreshReviews(status = "pending_moderation") {
    setLoadingKey(`refresh-${status}`);
    const response = await fetch(`/api/v1/admin/reviews/moderation?providerId=${selectedProviderId}&status=${status}`);
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && Array.isArray(payload.data)) {
      setReviews(payload.data);
      setSelectedReviewId(payload.data[0]?.id ?? "");
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? `${status.replaceAll("_", " ")} reviews loaded.` : payload.error ?? "Review refresh failed."
    });
  }

  async function createReview() {
    if (!selectedProviderId) return;

    setLoadingKey("create-review");
    const response = await fetch(`/api/v1/providers/${selectedProviderId}/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reviewerName: "Family Reviewer",
        reviewerEmail: "family@example.com",
        rating: 5,
        title: "Helpful and responsive team",
        body: "The staff was warm, responsive, and helpful while our family compared care options."
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setReviews((current) => [payload.data, ...current]);
      setSelectedReviewId(payload.data.id);
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "First-party review submitted for moderation." : payload.error ?? "Review submission failed."
    });
  }

  async function moderateSelectedReview(status: "published" | "hidden" | "removed") {
    if (!selectedReview) return;

    const key = `moderate-${status}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/reviews/${selectedReview.id}/moderate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        reason: status === "published" ? "Meets first-party review policy" : "Needs provider or policy review",
        notes: "Moderated from admin reputation console.",
        actorId
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok) {
      setReviews((current) => current.map((review) => (review.id === selectedReview.id ? { ...review, status } : review)));
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? `Review marked ${status}.` : payload.error ?? "Moderation failed."
    });
  }

  async function scoreSentiment() {
    if (!selectedReview) return;

    setLoadingKey("sentiment");
    const response = await fetch(`/api/v1/admin/reviews/${selectedReview.id}/sentiment`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Sentiment ${payload.data?.sentiment ?? "scored"} at ${payload.data?.score ?? "n/a"}.`
        : payload.error ?? "Sentiment scoring failed."
    });
  }

  async function generateResponse() {
    if (!selectedReview) return;

    setLoadingKey("response-draft");
    const response = await fetch(`/api/v1/provider/reviews/${selectedReview.id}/responses/generate`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setResponseDraft(payload.data);
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "AI response draft generated with policy context." : payload.error ?? "Response generation failed."
    });
  }

  async function publishResponse() {
    if (!selectedReview || !responseDraft) return;

    setLoadingKey("publish-response");
    const response = await fetch(`/api/v1/provider-portal/reviews/${selectedReview.id}/responses/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: selectedReview.providerId,
        body: responseDraft.body,
        generatedByAi: responseDraft.generatedByAi,
        actorId
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    setActionState({
      ok: response.ok,
      message: response.ok ? `Review response ${payload.data?.status ?? "published"}.` : payload.error ?? "Response publish failed."
    });
  }

  async function createCampaign() {
    if (!selectedProviderId) return;

    setLoadingKey("create-campaign");
    const response = await fetch("/api/v1/provider/review-request-campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: selectedProviderId,
        name: "Family review request campaign",
        message: "Thank you for visiting. Your feedback helps families compare senior care options with more confidence.",
        channel: "email",
        actorId,
        recipients: [
          {
            name: "Consent Family",
            email: "family@example.com",
            consentPayload: {
              consentSource: "admin_reputation_console",
              consentAt: new Date().toISOString()
            }
          }
        ]
      })
    });
    const payload = await response.json().catch(() => ({})) as { data?: CampaignPayload; error?: string };
    setLoadingKey(null);

    if (response.ok && payload.data?.campaign?.id) {
      setCampaignId(payload.data.campaign.id);
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Review campaign ${payload.data?.campaign?.status ?? "queued"} with ${payload.data?.requests?.length ?? 0} recipient.`
        : payload.error ?? "Campaign creation failed."
    });
  }

  async function sendCampaign() {
    if (!campaignId) return;

    setLoadingKey("send-campaign");
    const response = await fetch(`/api/v1/provider/review-request-campaigns/${campaignId}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorId, limit: 25, deliveryProvider: "manual" })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `${payload.data?.sent ?? 0} review requests sent, ${payload.data?.blocked ?? 0} blocked.`
        : payload.error ?? "Campaign send failed."
    });
  }

  async function checkReadiness() {
    if (!selectedProviderId) return;

    setLoadingKey("reputation-readiness");
    const response = await fetch(`/api/v1/provider/reputation-readiness?providerId=${selectedProviderId}`);
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Reputation status ${payload.data?.status ?? "review"}: ${payload.data?.nextActions?.[0] ?? "continue collection."}`
        : payload.error ?? "Readiness check failed."
    });
  }

  return (
    <div className="review-console">
      <article className="review-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Reputation workflow</p>
            <h3>{selectedProvider?.name ?? "Select provider"}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={Boolean(loadingKey)} onClick={() => refreshReviews()}>
            {loadingKey?.startsWith("refresh") ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <label className="field-stack">
          <span>Provider</span>
          <select value={selectedProviderId} onChange={(event) => {
            setSelectedProviderId(event.target.value);
            setSelectedReviewId("");
            setResponseDraft(null);
            setCampaignId(null);
          }}>
            {initialProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </label>

        <div className="review-status-grid">
          <div><strong>{reviewCounts.pending}</strong><span>Pending</span></div>
          <div><strong>{reviewCounts.published}</strong><span>Published</span></div>
          <div><strong>{reviewCounts.hidden}</strong><span>Hidden</span></div>
          <div><strong>{reviewCounts.blocked}</strong><span>Blocked</span></div>
        </div>

        <div className="review-actions-grid">
          <button className="button primary" type="button" disabled={!selectedProviderId || Boolean(loadingKey)} onClick={createReview}>
            {loadingKey === "create-review" ? "Submitting..." : "Submit sample review"}
          </button>
          <button className="button secondary" type="button" disabled={!selectedProviderId || Boolean(loadingKey)} onClick={() => refreshReviews("published")}>
            Load published
          </button>
          <button className="button secondary" type="button" disabled={!selectedProviderId || Boolean(loadingKey)} onClick={checkReadiness}>
            Readiness
          </button>
        </div>

        <div className="review-list">
          {reviews.slice(0, 7).map((review) => (
            <button
              className={review.id === selectedReviewId ? "review-row active" : "review-row"}
              key={review.id}
              type="button"
              onClick={() => {
                setSelectedReviewId(review.id);
                setResponseDraft(null);
              }}
            >
              <span>
                <strong>{review.title ?? `${review.rating}-star review`}</strong>
                <small>{review.reviewerName} - {review.status.replaceAll("_", " ")}</small>
              </span>
              <b>{review.rating}/5</b>
            </button>
          ))}
          {!reviews.length ? (
            <div className="empty-governance-state compact">
              <strong>No reviews loaded</strong>
              <span>Submit a review or refresh the moderation queue.</span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="review-panel review-workbench-panel">
        <p className="eyebrow">Moderation and response</p>
        <h3>{selectedReview?.title ?? "Select a review"}</h3>
        <div className="review-moderation-grid">
          <button className="small-action approve" type="button" disabled={!selectedReview || Boolean(loadingKey)} onClick={() => moderateSelectedReview("published")}>
            {loadingKey === "moderate-published" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            Publish
          </button>
          <button className="small-action" type="button" disabled={!selectedReview || Boolean(loadingKey)} onClick={() => moderateSelectedReview("hidden")}>
            Hide
          </button>
          <button className="small-action block" type="button" disabled={!selectedReview || Boolean(loadingKey)} onClick={() => moderateSelectedReview("removed")}>
            Remove
          </button>
          <button className="small-action" type="button" disabled={!selectedReview || Boolean(loadingKey)} onClick={scoreSentiment}>
            <Star aria-hidden="true" />
            Sentiment
          </button>
        </div>

        <div className="review-moderation-grid">
          <button className="small-action" type="button" disabled={!selectedReview || Boolean(loadingKey)} onClick={generateResponse}>
            {loadingKey === "response-draft" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
            Generate response
          </button>
          <button
            className="small-action approve"
            type="button"
            disabled={!selectedReview || !responseDraft || selectedReview.status !== "published" || Boolean(loadingKey)}
            onClick={publishResponse}
          >
            {loadingKey === "publish-response" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <MessageSquareReply aria-hidden="true" />}
            Publish response
          </button>
        </div>

        <div className="response-preview">
          <strong>{responseDraft ? "AI response draft" : "No response draft yet"}</strong>
          <p>{responseDraft?.body ?? "Generate a response after selecting a review. Responses can only publish after the review itself is published."}</p>
        </div>

        <p className="eyebrow">Review requests</p>
        <div className="review-moderation-grid">
          <button className="small-action" type="button" disabled={!selectedProviderId || Boolean(loadingKey)} onClick={createCampaign}>
            {loadingKey === "create-campaign" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Create campaign
          </button>
          <button className="small-action approve" type="button" disabled={!campaignId || Boolean(loadingKey)} onClick={sendCampaign}>
            Send campaign
          </button>
        </div>

        {campaignId ? <p className="claim-hint">Active review campaign: {campaignId}</p> : null}
        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>
    </div>
  );
}
