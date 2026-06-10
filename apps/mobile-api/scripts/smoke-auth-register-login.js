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
    error.status = response.status;
    error.details = json;
    throw error;
  }
  return { status: response.status, json };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function assertPublicUser(user) {
  assert.ok(user.id, "user id must be returned");
  assert.equal(Object.prototype.hasOwnProperty.call(user, "password_hash"), false, "password_hash must not be returned");
  assert.equal(Object.prototype.hasOwnProperty.call(user, "passwordHash"), false, "passwordHash must not be returned");
}

async function main() {
  console.log(`Auth register/login smoke: ${apiBase}`);
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `auth-smoke-${nonce}@example.com`;
  const password = `StrongPass-${nonce}`;

  const mismatch = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Auth Smoke",
      gender: "female",
      phone: "+13035550999",
      email: `mismatch-${email}`,
      password,
      confirmPassword: `${password}-nope`
    })
  }, [400]);
  assert.match(mismatch.json.error || "", /match/i, "password mismatch should explain mismatch");

  const badGender = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Auth Smoke",
      gender: "invalid",
      phone: "+13035550999",
      email: `bad-gender-${email}`,
      password,
      confirmPassword: password
    })
  }, [400]);
  assert.match(badGender.json.error || "", /gender/i, "invalid gender should be rejected");

  const registered = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Auth Smoke",
      gender: "female",
      phone: "+13035550999",
      email,
      password,
      confirmPassword: password
    })
  });
  assert.ok(registered.json.token, "register must return token");
  assert.equal(registered.json.nextStep, "choose_role", "new registration must choose role");
  assert.equal(registered.json.user.email, email.toLowerCase(), "email must be normalized");
  assert.equal(registered.json.user.phone, "+13035550999", "phone must be returned");
  assert.equal(registered.json.user.gender, "female", "gender must be returned");
  assert.equal(registered.json.user.role, null, "new user role must be null");
  assertPublicUser(registered.json.user);

  const duplicate = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Auth Smoke",
      gender: "female",
      phone: "+13035550999",
      email,
      password,
      confirmPassword: password
    })
  }, [409]);
  assert.match(duplicate.json.error || "", /registered/i, "duplicate email should be rejected");

  const badLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "wrong-password" })
  }, [401]);
  assert.equal(badLogin.json.error, "Invalid email or password", "wrong password should be generic");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert.ok(login.json.token, "login must return token");
  assert.notEqual(login.json.token, registered.json.token, "login should create a fresh token");
  assert.equal(login.json.nextStep, "choose_role", "role-less login must choose role");
  assertPublicUser(login.json.user);

  const me = await request("/api/me", { headers: auth(login.json.token) });
  assert.equal(me.json.user.email, email.toLowerCase(), "/api/me must return registered user");
  assertPublicUser(me.json.user);

  const protectedResponse = await request("/api/guru/chat", {
    method: "POST",
    headers: auth(login.json.token),
    body: JSON.stringify({ message: "hello" })
  }, [403]);
  assert.match(protectedResponse.json.error || "", /permission/i, "role-less user should not access senior routes");

  console.log("Auth register/login smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
