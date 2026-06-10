const crypto = require("crypto");
const { onboardingStatusForUser } = require("./onboarding-status");

const SESSION_DAYS = 30;
const SCRYPT_KEY_LENGTH = 64;
const ALLOWED_GENDERS = new Set(["female", "male", "non_binary", "prefer_not_to_say", "self_describe"]);

function httpError(message, status = 400, details = undefined) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

function requiredString(value, name) {
  const text = String(value || "").trim();
  if (!text) throw httpError(`${name} is required`, 400);
  return text;
}

function normalizeEmail(value) {
  const email = requiredString(value, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Valid email is required", 400);
  }
  return email;
}

function normalizeGender(value) {
  const gender = requiredString(value, "gender").toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    nonbinary: "non_binary",
    non_binary: "non_binary",
    prefer_not_to_say: "prefer_not_to_say",
    prefer_not_say: "prefer_not_to_say",
    self_describe: "self_describe",
    other: "self_describe"
  };
  const normalized = aliases[gender] || gender;
  if (!ALLOWED_GENDERS.has(normalized)) {
    throw httpError("Invalid gender", 400, {
      allowed: [...ALLOWED_GENDERS]
    });
  }
  return normalized;
}

function normalizePassword(password, confirmPassword = password) {
  const value = String(password || "");
  const confirm = String(confirmPassword || "");
  if (!value) throw httpError("password is required", 400);
  if (!confirm) throw httpError("confirmPassword is required", 400);
  if (value !== confirm) throw httpError("Password and confirm password must match", 400);
  if (value.length < 8) throw httpError("Password must be at least 8 characters", 400);
  return value;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [scheme, salt, expectedHex] = String(passwordHash || "").split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = await scryptAsync(password, salt);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(user = {}) {
  return {
    id: user.id,
    email: user.email || null,
    phone: user.phone || null,
    displayName: user.display_name || user.displayName || "",
    gender: user.gender || null,
    role: user.role || null,
    status: user.status || null,
    createdAt: user.created_at || null,
    updatedAt: user.updated_at || null,
    lastLoginAt: user.last_login_at || null
  };
}

async function createSession(query, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3::int * interval '1 day'))`,
    [userId, hashToken(token), SESSION_DAYS]
  );
  return token;
}

function createAuthService({ query, audit, req }) {
  async function registerUser(payload = {}) {
    const fullName = requiredString(payload.fullName || payload.full_name || payload.displayName, "fullName");
    const gender = normalizeGender(payload.gender);
    const phone = requiredString(payload.phone || payload.phoneNumber || payload.phone_number, "phone");
    const email = normalizeEmail(payload.email);
    const password = normalizePassword(payload.password, payload.confirmPassword || payload.confirm_password);
    const existing = (await query(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email])).rows[0];
    if (existing) throw httpError("Email is already registered", 409);

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = (await query(
        `INSERT INTO users (email, phone, display_name, gender, role, password_hash, status)
         VALUES ($1, $2, $3, $4::gender_identity, NULL, $5, 'draft')
         RETURNING *`,
        [email, phone, fullName, gender, passwordHash]
      )).rows[0];
    } catch (error) {
      if (error.code === "23505") throw httpError("Email is already registered", 409);
      throw error;
    }

    const token = await createSession(query, user.id);
    if (audit) {
      await audit(req, user, "auth_user_registered", "user", user.id, { email, phoneProvided: Boolean(phone), gender }, "info");
    }
    const onboardingStatus = await onboardingStatusForUser(query, user);
    return { token, user: publicUser(user), nextStep: onboardingStatus.nextStep, onboarding_status: onboardingStatus };
  }

  async function loginUser(payload = {}) {
    const email = normalizeEmail(payload.email);
    const password = requiredString(payload.password, "password");
    const user = (await query(`SELECT * FROM users WHERE lower(email) = lower($1)`, [email])).rows[0];
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      throw httpError("Invalid email or password", 401);
    }
    const token = await createSession(query, user.id);
    const updated = (await query(
      `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [user.id]
    )).rows[0];
    const onboardingStatus = await onboardingStatusForUser(query, updated);
    const nextStep = onboardingStatus.nextStep;
    if (audit) {
      await audit(req, updated, "auth_user_logged_in", "user", updated.id, { nextStep }, "info");
    }
    return { token, user: publicUser(updated), nextStep, onboarding_status: onboardingStatus };
  }

  return { registerUser, loginUser };
}

module.exports = {
  ALLOWED_GENDERS,
  createAuthService,
  hashPassword,
  verifyPassword,
  hashToken,
  publicUser
};
