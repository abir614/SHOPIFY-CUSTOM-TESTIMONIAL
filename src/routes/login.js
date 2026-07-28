import { jsonResponse } from "../security.js";
import { verifyPassword } from "../crypto-utils.js";
import { issueToken } from "../auth.js";
import { getCollections } from "../db.js";

export async function handleLogin(request, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const rawIdentifier = body.username || body.email || body.identifier || "";
  const identifier = typeof rawIdentifier === "string" ? rawIdentifier.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return jsonResponse({ error: "Username/email and password are required." }, 400, corsHeaders);
  }

  const { users } = getCollections();
  const user = await users.findOne({ $or: [{ username: identifier }, { email: identifier }] });

  // Always run verifyPassword, even on a miss, so response timing doesn't
  // reveal whether the account exists.
  const DUMMY_HASH = "pbkdf2$100000$Bn3DO6Lu0yJfE8M56BYoug==$9QiRRNi4woz+ASQs336ZnsQ8tcYC4OhdDQJsc7jj0cQ=";
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, DUMMY_HASH);
  if (!user) {
    return jsonResponse({
      error: "No account found with this username or email! Please create a free account to get started.",
      notRegistered: true
    }, 404, corsHeaders);
  }
  if (!valid) {
    return jsonResponse({ error: "Incorrect password. Please try again." }, 401, corsHeaders);
  }

  const token = await issueToken(user);
  return jsonResponse({ ok: true, token, user: { username: user.username, email: user.email } }, 200, corsHeaders);
}
