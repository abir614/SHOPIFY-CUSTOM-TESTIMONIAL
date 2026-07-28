import { jsonResponse, verifyPlatformTurnstile } from "../security.js";
import { hashPassword } from "../crypto-utils.js";
import { issueToken } from "../auth.js";
import { getCollections } from "../db.js";
import { EMAIL_REGEX, USERNAME_RE } from "../validation.js";

const RESERVED_USERNAMES = new Set([
  // System & Admin
  "admin", "administrator", "superadmin", "root", "system", "sysadmin", "owner", "master", "hostmaster", "webmaster", "postmaster",
  // Common terms & Roles
  "support", "help", "billing", "sales", "marketing", "contact", "info", "hello", "team", "staff", "moderator", "user", "guest", "anonymous",
  // App Routes & Features
  "api", "health", "www", "app", "static", "assets", "public", "private", "images", "css", "js", "auth", "oauth", "webhook", "webhooks",
  "login", "register", "signup", "dashboard", "apps", "submissions", "guide", "docs", "settings", "logout", "home", "profile", "account",
  // Development & Testing
  "test", "testing", "dev", "developer", "demo", "sandbox", "stage", "staging", "beta", "alpha"
]);

export async function handleRegister(request, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";

  if (process.env.PLATFORM_TURNSTILE_SECRET_KEY) {
    const ip = request.headers.get("X-Forwarded-For")?.split(",")[0].trim() || request.headers.get("X-Real-IP") || "unknown";
    const isValid = await verifyPlatformTurnstile(turnstileToken, ip);
    if (!isValid) return jsonResponse({ error: "Turnstile verification failed. Please try again." }, 403, corsHeaders);
  }

  if (!USERNAME_RE.test(username) || RESERVED_USERNAMES.has(username)) {
    return jsonResponse(
      { error: "Username must be 4-10 characters: lowercase letters and numbers only, and not a reserved word." },
      400,
      corsHeaders
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return jsonResponse({ error: "Please provide a valid email address." }, 400, corsHeaders);
  }
  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400, corsHeaders);
  }

  const { users } = getCollections();

  const existing = await users.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    return jsonResponse({
      error: "You are already registered! Please sign in to your account instead.",
      alreadyRegistered: true
    }, 409, corsHeaders);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const insertResult = await users.insertOne({ username, email, passwordHash, createdAt: now, updatedAt: now });

  const user = { _id: insertResult.insertedId, username, email };
  const token = await issueToken(user);

  return jsonResponse({ ok: true, token, user: { username, email } }, 201, corsHeaders);
}
