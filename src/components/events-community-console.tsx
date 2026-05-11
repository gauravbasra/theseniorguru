"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, Loader2, Megaphone, Send, UsersRound } from "lucide-react";
import type { CommunityGroupRecord, CommunityInvitationRecord, CommunityPostRecord, ExpertProfileRecord } from "@/lib/domain/community";
import type { EventAnalyticsSummary, EventPromotionRecord, EventRecord } from "@/lib/domain/events";

type EventsCommunityConsoleProps = {
  initialEvents: EventRecord[];
  initialGroups: CommunityGroupRecord[];
  initialExperts: ExpertProfileRecord[];
  initialPosts: CommunityPostRecord[];
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

const actorId = "00000000-0000-4000-8000-000000000001";

export function EventsCommunityConsole({
  initialEvents,
  initialGroups,
  initialExperts,
  initialPosts
}: EventsCommunityConsoleProps) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState(initialEvents[0]?.id ?? "");
  const [promotions, setPromotions] = useState<EventPromotionRecord[]>([]);
  const [analytics, setAnalytics] = useState<EventAnalyticsSummary | null>(null);
  const [groups, setGroups] = useState(initialGroups);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroups[0]?.id ?? "");
  const [invitations, setInvitations] = useState<CommunityInvitationRecord[]>([]);
  const [experts, setExperts] = useState(initialExperts);
  const [posts, setPosts] = useState(initialPosts);
  const [selectedPostId, setSelectedPostId] = useState(initialPosts[0]?.id ?? "");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
  const selectedPost = posts.find((post) => post.id === selectedPostId);
  const dashboardStats = useMemo(
    () => ({
      events: events.length,
      groups: groups.length,
      experts: experts.filter((expert) => expert.status === "verified").length,
      queuedInvites: invitations.filter((invite) => invite.status === "queued").length
    }),
    [events.length, experts, groups.length, invitations]
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

    setActionState({ ok: false, message: payload.error ?? "Events/community operation failed." });
    return null;
  }

  async function refreshEvents() {
    const data = await runAction<EventRecord[]>(
      "events",
      () => fetch("/api/v1/events"),
      (records) => `${records.length} published events loaded.`
    );

    if (data) {
      setEvents(data);
      setSelectedEventId(data[0]?.id ?? selectedEventId);
    }
  }

  async function createEvent() {
    const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);
    const data = await runAction<EventRecord>(
      "create-event",
      () => fetch("/api/v1/provider/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: "seed-cottages-dayton-place",
          title: "Family Senior Care Planning Session",
          description: "A free local session for families comparing senior living, home care, and memory care options.",
          eventType: "workshop",
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: "America/Denver",
          venueName: "The Senior Guru Community Room",
          city: "Denver",
          state: "CO",
          capacity: 35,
          isFree: true,
          publish: true
        })
      }),
      (event) => `${event.title} published for local families.`
    );

    if (data) {
      setEvents((current) => [data, ...current.filter((event) => event.id !== data.id)]);
      setSelectedEventId(data.id);
      setAnalytics(null);
    }
  }

  async function createRsvp() {
    if (!selectedEventId) return;

    await runAction(
      "rsvp",
      () => fetch(`/api/v1/events/${selectedEventId}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attendeeName: "Family RSVP",
          attendeeEmail: "family-rsvp@example.com",
          partySize: 2,
          consentPayload: {
            consentSource: "admin_events_community_console",
            consentAt: new Date().toISOString()
          }
        })
      }),
      () => "Family RSVP captured with consent payload."
    );
  }

  async function createPromotion() {
    if (!selectedEventId) return;

    const data = await runAction<EventPromotionRecord>(
      "promotion",
      () => fetch(`/api/v1/provider/events/${selectedEventId}/promotions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placementKey: "events.featured.local",
          budgetCents: 10000,
          disclosureLabel: "Sponsored",
          activate: false,
          actorId
        })
      }),
      (promotion) => `Event promotion ${promotion.status.replaceAll("_", " ")} with ${promotion.disclosureLabel} disclosure.`
    );

    if (data) setPromotions((current) => [data, ...current.filter((promotion) => promotion.id !== data.id)]);
  }

  async function activatePromotion() {
    const promotion = promotions.find((item) => item.status !== "active");

    if (!promotion) return;

    const data = await runAction<EventPromotionRecord>(
      "activate-promotion",
      () => fetch(`/api/v1/provider/event-promotions/${promotion.id}/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actorId })
      }),
      (record) => `Event promotion is ${record.status}.`
    );

    if (data) setPromotions((current) => current.map((item) => (item.id === data.id ? data : item)));
  }

  async function loadAnalytics() {
    if (!selectedEventId) return;

    const data = await runAction<EventAnalyticsSummary>(
      "analytics",
      () => fetch(`/api/v1/provider/events/${selectedEventId}/analytics`),
      (summary) => `${summary.rsvps.total} RSVP guests and ${summary.promotions.total} promotions measured.`
    );

    if (data) setAnalytics(data);
  }

  async function createGroup() {
    const data = await runAction<CommunityGroupRecord>(
      "group",
      () => fetch("/api/v1/community/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Denver Family Care Network",
          city: "Denver",
          state: "CO",
          description: "A moderated local network for families, seniors, operators, and experts.",
          actorId
        })
      }),
      (group) => `${group.name} created for ${group.city}, ${group.state}.`
    );

    if (data) {
      setGroups((current) => [data, ...current.filter((group) => group.id !== data.id)]);
      setSelectedGroupId(data.id);
    }
  }

  async function joinGroup() {
    if (!selectedGroupId) return;

    await runAction(
      "join-group",
      () => fetch(`/api/v1/community/groups/${selectedGroupId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userKey: "admin-family-user",
          displayName: "Family Member",
          email: "family-member@example.com",
          role: "family",
          actorId
        })
      }),
      () => "Family member added to the local community."
    );
  }

  async function createInvitation() {
    if (!selectedGroupId) return;

    const data = await runAction<CommunityInvitationRecord>(
      "invitation",
      () => fetch(`/api/v1/community/groups/${selectedGroupId}/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inviterUserKey: "admin-family-user",
          recipientEmail: "neighbor@example.com",
          recipientName: "Neighbor Family",
          role: "family",
          deliveryChannel: "email",
          actorId
        })
      }),
      (invitation) => `Invitation ${invitation.status} for ${invitation.recipientEmail}.`
    );

    if (data) setInvitations((current) => [data, ...current.filter((invite) => invite.id !== data.id)]);
  }

  async function sendInvitation() {
    const invitation = invitations.find((item) => item.status === "queued");

    if (!invitation) return;

    const data = await runAction<CommunityInvitationRecord>(
      "send-invitation",
      () => fetch(`/api/v1/admin/community/invitations/${invitation.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliveryProvider: "manual", deliveryId: `manual-${Date.now()}`, actorId })
      }),
      (record) => `Invitation ${record.status} through ${record.deliveryProvider ?? "manual"}.`
    );

    if (data) setInvitations((current) => current.map((item) => (item.id === data.id ? data : item)));
  }

  async function submitExpert() {
    const data = await runAction<ExpertProfileRecord>(
      "expert",
      () => fetch("/api/v1/community/experts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userKey: `expert-${Date.now()}`,
          displayName: "Local Care Navigator",
          email: "expert@example.com",
          organization: "The Senior Guru Expert Network",
          title: "Care navigator",
          specialty: "Senior living tours and caregiver planning",
          city: "Denver",
          state: "CO",
          credentialSummary: "Verified senior care advisor with local placement experience.",
          actorId
        })
      }),
      (expert) => `${expert.displayName} submitted for expert review.`
    );

    if (data) setExperts((current) => [data, ...current.filter((expert) => expert.id !== data.id)]);
  }

  async function verifyExpert() {
    const expert = experts.find((item) => item.status === "pending_review");

    if (!expert) return;

    const data = await runAction<ExpertProfileRecord>(
      "verify-expert",
      () => fetch(`/api/v1/admin/community/experts/${expert.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "verified", adminNotes: "Verified from admin community console.", actorId })
      }),
      (record) => `${record.displayName} verified as local expert.`
    );

    if (data) setExperts((current) => current.map((item) => (item.id === data.id ? data : item)));
  }

  async function createPost() {
    const data = await runAction<CommunityPostRecord>(
      "post",
      () => fetch("/api/v1/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          communityId: selectedGroupId || undefined,
          authorName: "Family Moderator",
          postType: "question",
          title: "What should families compare before a memory care tour?",
          body: "Ask about staffing, daily routines, medication support, family updates, and what happens after move-in.",
          city: "Denver",
          state: "CO"
        })
      }),
      (post) => `Community post ${post.status.replaceAll("_", " ")}.`
    );

    if (data) {
      setPosts((current) => [data, ...current.filter((post) => post.id !== data.id)]);
      setSelectedPostId(data.id);
    }
  }

  async function moderatePost() {
    if (!selectedPostId) return;

    const data = await runAction<CommunityPostRecord>(
      "moderate-post",
      () => fetch(`/api/v1/admin/community/posts/${selectedPostId}/moderate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "published", reason: "Helpful family planning topic.", actorId })
      }),
      (post) => `Community post marked ${post.status}.`
    );

    if (data) setPosts((current) => current.map((post) => (post.id === data.id ? data : post)));
  }

  return (
    <div className="events-community-console">
      <article className="events-community-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Provider events</p>
            <h3>{selectedEvent?.title ?? "Create a local event"}</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={Boolean(loadingKey)} onClick={refreshEvents}>
            {loadingKey === "events" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <CalendarPlus aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="events-community-status-grid">
          <div><strong>{dashboardStats.events}</strong><span>Events</span></div>
          <div><strong>{analytics?.rsvps.total ?? 0}</strong><span>RSVP guests</span></div>
          <div><strong>{promotions.length}</strong><span>Promotions</span></div>
          <div><strong>{analytics?.promotions.budgetCents ? `$${analytics.promotions.budgetCents / 100}` : "$0"}</strong><span>Budget</span></div>
        </div>

        <label className="field-stack">
          <span>Event</span>
          <select value={selectedEventId} onChange={(event) => {
            setSelectedEventId(event.target.value);
            setAnalytics(null);
            setPromotions([]);
          }}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
            {!events.length ? <option value="">No events yet</option> : null}
          </select>
        </label>

        <div className="events-community-actions-grid">
          <button className="button primary" type="button" disabled={Boolean(loadingKey)} onClick={createEvent}>Create event</button>
          <button className="button secondary" type="button" disabled={!selectedEventId || Boolean(loadingKey)} onClick={createRsvp}>Add RSVP</button>
          <button className="button secondary" type="button" disabled={!selectedEventId || Boolean(loadingKey)} onClick={loadAnalytics}>Analytics</button>
        </div>

        <div className="events-community-actions-grid">
          <button className="small-action" type="button" disabled={!selectedEventId || Boolean(loadingKey)} onClick={createPromotion}>
            {loadingKey === "promotion" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Megaphone aria-hidden="true" />}
            Promote
          </button>
          <button className="small-action approve" type="button" disabled={!promotions.some((promotion) => promotion.status !== "active") || Boolean(loadingKey)} onClick={activatePromotion}>
            Activate
          </button>
        </div>

        <div className="events-community-list">
          {events.slice(0, 6).map((event) => (
            <button className={event.id === selectedEventId ? "events-community-row active" : "events-community-row"} key={event.id} type="button" onClick={() => setSelectedEventId(event.id)}>
              <span>
                <strong>{event.title}</strong>
                <small>{event.city}, {event.state} - {event.eventType}</small>
              </span>
              <b>{event.status}</b>
            </button>
          ))}
        </div>
      </article>

      <article className="events-community-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Community engine</p>
            <h3>{selectedGroup?.name ?? "Create a local community"}</h3>
          </div>
          <UsersRound aria-hidden="true" />
        </div>

        <div className="events-community-status-grid">
          <div><strong>{dashboardStats.groups}</strong><span>Groups</span></div>
          <div><strong>{selectedGroup?.memberCount ?? 0}</strong><span>Members</span></div>
          <div><strong>{dashboardStats.queuedInvites}</strong><span>Queued invites</span></div>
          <div><strong>{dashboardStats.experts}</strong><span>Experts</span></div>
        </div>

        <label className="field-stack">
          <span>Community group</span>
          <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
            {!groups.length ? <option value="">No groups yet</option> : null}
          </select>
        </label>

        <div className="events-community-actions-grid">
          <button className="button primary" type="button" disabled={Boolean(loadingKey)} onClick={createGroup}>Create group</button>
          <button className="button secondary" type="button" disabled={!selectedGroupId || Boolean(loadingKey)} onClick={joinGroup}>Add member</button>
          <button className="button secondary" type="button" disabled={!selectedGroupId || Boolean(loadingKey)} onClick={createInvitation}>Invite</button>
        </div>

        <div className="events-community-actions-grid">
          <button className="small-action approve" type="button" disabled={!invitations.some((invite) => invite.status === "queued") || Boolean(loadingKey)} onClick={sendInvitation}>
            {loadingKey === "send-invitation" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Send aria-hidden="true" />}
            Send invite
          </button>
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={submitExpert}>Submit expert</button>
          <button className="small-action approve" type="button" disabled={!experts.some((expert) => expert.status === "pending_review") || Boolean(loadingKey)} onClick={verifyExpert}>
            <CheckCircle2 aria-hidden="true" />
            Verify expert
          </button>
        </div>

        <div className="events-community-actions-grid">
          <button className="small-action" type="button" disabled={Boolean(loadingKey)} onClick={createPost}>Create post</button>
          <button className="small-action approve" type="button" disabled={!selectedPost || Boolean(loadingKey)} onClick={moderatePost}>Moderate post</button>
        </div>

        <div className="events-community-list">
          {posts.slice(0, 5).map((post) => (
            <button className={post.id === selectedPostId ? "events-community-row active" : "events-community-row"} key={post.id} type="button" onClick={() => setSelectedPostId(post.id)}>
              <span>
                <strong>{post.title}</strong>
                <small>{post.city}, {post.state} - {post.postType.replaceAll("_", " ")}</small>
              </span>
              <b>{post.status}</b>
            </button>
          ))}
        </div>

        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>
    </div>
  );
}
