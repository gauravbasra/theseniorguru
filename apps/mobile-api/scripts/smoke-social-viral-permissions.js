#!/usr/bin/env node

const assert = require("assert");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

async function request(path, options = {}, expectedStatuses = [200]) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!expectedStatuses.includes(response.status)) {
    const error = new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
    error.details = json;
    throw error;
  }
  return json;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function roleSession(role, displayName) {
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({
      installationId: `social-viral-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      displayName
    })
  });
  assert.equal(session.user.role, role);
  assert.ok(session.token);
  return session;
}

async function main() {
  console.log(`Social viral permissions smoke: ${apiBase}`);

  const senior = await roleSession("senior", "Social Smoke Senior");
  await request("/api/onboarding/senior", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      name: "Social Smoke Senior",
      preferredName: "Social",
      phone: "+13035552001",
      email: "social-smoke-senior@theseniorguru.test",
      address: "Social Smoke Community",
      livingType: "community",
      healthConcerns: ["mobility"],
      allergies: "None",
      mobility: "Independent",
      wearableSources: ["apple_healthkit"],
      devicePermissions: ["location", "health"],
      healthSharing: true,
      locationSharing: true
    })
  });

  const profilePhoto = await request("/api/media/evidence", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      subjectRole: "senior",
      evidenceType: "profile_photo",
      localUri: "mobile://profile-photo-smoke.jpg",
      mimeType: "image/jpeg",
      fileName: "profile-photo-smoke.jpg",
      base64Data: Buffer.from("profile-photo-bytes").toString("base64")
    })
  });
  assert.ok(profilePhoto.evidence?.storageUrl, "profile photo evidence must store media URL");
  const seniorState = await request("/api/state", { headers: auth(senior.token) });
  assert.ok(seniorState.resident?.profile_photo_url, "resident state must expose saved profile photo URL");

  const post = await request("/api/posts", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      body: "Social smoke post from real API state",
      audience: "community",
      mediaObjectIds: [profilePhoto.mediaObject.id]
    })
  });
  assert.ok(post.post?.id, "post creation must persist a community post");

  const feed = await request("/api/posts", { headers: auth(senior.token) });
  assert.ok(feed.posts.some(item => item.id === post.post.id), "feed must read created post");

  const like = await request(`/api/posts/${post.post.id}/like`, {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({ reactionType: "heart" })
  });
  assert.ok(like.reaction?.id, "like must write reaction");

  const comment = await request(`/api/posts/${post.post.id}/comments`, {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({ body: "Real comment smoke" })
  });
  assert.ok(comment.comment?.id, "comment must write row");

  const contacts = await request("/api/contacts/import", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      source: "phone_contacts",
      contacts: [
        { displayName: "Social Smoke Friend", phone: "+13035552002" },
        { displayName: "Social Smoke Caregiver", email: "caregiver-social-smoke@theseniorguru.test" }
      ]
    })
  });
  assert.equal(contacts.count, 2, "contact import must persist contacts");

  const search = await request("/api/members/search?q=Social%20Smoke", { headers: auth(senior.token) });
  assert.ok(search.members.length >= 2, "member search must include imported contacts");

  const group = await request("/api/groups", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({ name: "Social Smoke Family Group", groupType: "family", visibility: "invite_only" })
  });
  assert.ok(group.group?.id, "group create must persist");

  const friendInvite = await request("/api/circle/invites", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      connectionType: "friend",
      channel: "whatsapp",
      name: "Social Smoke Friend",
      phone: "+13035552002"
    })
  });
  assert.ok(friendInvite.token, "friend invite must return share token");
  assert.ok(friendInvite.message.includes("Health data is not shared with friends"), "friend viral message must state health privacy");

  const friend = await roleSession("trusted_person", "Social Smoke Friend");
  const acceptedFriend = await request("/api/circle/accept-token", {
    method: "POST",
    headers: auth(friend.token),
    body: JSON.stringify({ token: friendInvite.token })
  });
  assert.equal(acceptedFriend.connection.connection_type, "friend", "accepted friend invite must store friend role");
  assert.equal(acceptedFriend.connection.health_access_status, "denied", "friend health access must be denied");
  const friendCircle = await request("/api/circle", { headers: auth(friend.token) });
  assert.equal(friendCircle.healthVitals.access, "not_available_for_friends", "friends cannot read health data");

  const familyInvite = await request("/api/circle/invites", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      connectionType: "family",
      channel: "sms",
      name: "Social Smoke Family",
      phone: "+13035552003",
      permissions: ["messages", "safety", "wellness", "medications"]
    })
  });
  assert.ok(familyInvite.message.includes("after the senior approves"), "family viral message must mention approval");

  const family = await roleSession("trusted_person", "Social Smoke Family");
  const acceptedFamily = await request("/api/circle/accept-token", {
    method: "POST",
    headers: auth(family.token),
    body: JSON.stringify({ token: familyInvite.token })
  });
  assert.equal(acceptedFamily.connection.connection_type, "family", "family invite must store family role");
  assert.equal(acceptedFamily.connection.health_access_status, "pending_senior_approval", "family health starts pending");
  const familyBeforeApproval = await request("/api/circle", { headers: auth(family.token) });
  assert.equal(familyBeforeApproval.healthVitals.access, "requires_senior_approval", "family health requires senior approval");

  const approval = await request("/api/circle/health-permissions", {
    method: "PATCH",
    headers: auth(senior.token),
    body: JSON.stringify({
      trustedUserId: family.user.id,
      approved: true,
      visibility: ["summary", "vitals", "medications"]
    })
  });
  assert.equal(approval.connection.health_access_status, "approved", "senior approval must update health access");

  await request(`/api/groups/${group.group.id}/members`, {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({ userIds: [family.user.id], source: "trusted_circle_invite" })
  });

  let groupDetail = await request(`/api/groups/${group.group.id}`, { headers: auth(senior.token) });
  const familyMember = groupDetail.members.find(member => member.user_id === family.user.id);
  assert.ok(familyMember?.id, "group detail must show added family member");

  const promoted = await request(`/api/groups/${group.group.id}/members/${familyMember.id}`, {
    method: "PATCH",
    headers: auth(senior.token),
    body: JSON.stringify({ memberRole: "admin", permissions: ["manage_roles"] })
  });
  assert.equal(promoted.member.member_role, "admin", "owner must promote member to admin");
  assert.ok(promoted.member.permissions.includes("manage_roles"), "member-specific permissions must persist");

  const rules = await request(`/api/groups/${group.group.id}/rules`, {
    method: "PATCH",
    headers: auth(senior.token),
    body: JSON.stringify({
      rules: {
        posting: "members",
        invites: "admins",
        memberApproval: "admins",
        moderation: "admins"
      },
      permissions: {
        admin: ["add_members", "remove_members", "manage_roles", "post", "comment", "react", "moderate_content"]
      }
    })
  });
  assert.equal(rules.group.rules.invites, "admins", "group invite rule must persist");
  assert.ok(rules.group.permissions.admin.includes("manage_roles"), "group admin permissions must persist");

  await request(`/api/groups/${group.group.id}/members`, {
    method: "POST",
    headers: auth(family.token),
    body: JSON.stringify({ userIds: [friend.user.id], source: "admin_add" })
  });
  groupDetail = await request(`/api/groups/${group.group.id}`, { headers: auth(senior.token) });
  const friendMember = groupDetail.members.find(member => member.user_id === friend.user.id);
  assert.ok(friendMember?.id, "group admin must add friend member");

  const removed = await request(`/api/groups/${group.group.id}/members/${friendMember.id}`, {
    method: "DELETE",
    headers: auth(family.token)
  });
  assert.equal(removed.member.status, "removed", "group admin must remove member");

  console.log("Social viral permissions smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
