import { ObjectId } from "mongodb";
import { jsonResponse } from "../security.js";
import { getCollections } from "../db.js";
import { randomBytes } from "node:crypto";

const KEY_PREFIX = "fhk_";
const KEY_BYTES = 32; // 64 hex chars

/** Generate a cryptographically random API key */
function generateApiKey() {
  return KEY_PREFIX + randomBytes(KEY_BYTES).toString("hex");
}

/** Sanitize and validate a permission object from user input */
function sanitizePermissions(raw = {}) {
  const actions = Array.isArray(raw.actions)
    ? raw.actions.filter((a) => ["read", "submit"].includes(a))
    : ["read", "submit"];

  let apps;
  if (raw.apps === "*" || !Array.isArray(raw.apps) || raw.apps.length === 0) {
    apps = "*";
  } else {
    apps = raw.apps
      .map((a) => (typeof a === "string" ? a.trim().toLowerCase() : ""))
      .filter(Boolean)
      .slice(0, 50);
  }

  return { actions, apps };
}

/** Convert a DB document to a safe public view (never exposes the raw key after creation) */
function toPublicKeyView(doc, includeKey = false) {
  return {
    id: String(doc._id),
    name: doc.name,
    ...(includeKey ? { key: doc.key } : { keyHint: doc.key.slice(0, 10) + "..." }),
    permissions: doc.permissions,
    lastUsedAt: doc.lastUsedAt || null,
    createdAt: doc.createdAt,
    revokedAt: doc.revokedAt || null,
  };
}

/** GET /api/apikeys — list all keys for the authenticated user */
export async function handleListApiKeys(request, auth, corsHeaders) {
  const { apikeys } = getCollections();
  const keys = await apikeys
    .find({ userId: new ObjectId(auth.userId) })
    .sort({ createdAt: -1 })
    .toArray();
  return jsonResponse({ ok: true, apikeys: keys.map((k) => toPublicKeyView(k)) }, 200, corsHeaders);
}

/** POST /api/apikeys — create a new key */
export async function handleCreateApiKey(request, auth, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 100)
      : "Unnamed Key";

  const permissions = sanitizePermissions(body.permissions);
  if (permissions.actions.length === 0) {
    return jsonResponse({ error: "At least one action (read, submit) must be selected." }, 400, corsHeaders);
  }

  const { apikeys } = getCollections();

  // Enforce per-user key cap
  const existingCount = await apikeys.countDocuments({
    userId: new ObjectId(auth.userId),
    revokedAt: null,
  });
  if (existingCount >= 20) {
    return jsonResponse({ error: "Maximum of 20 active API keys allowed per user." }, 429, corsHeaders);
  }

  const rawKey = generateApiKey();
  const now = new Date();
  const doc = {
    userId: new ObjectId(auth.userId),
    key: rawKey,
    name,
    permissions,
    lastUsedAt: null,
    createdAt: now,
    revokedAt: null,
  };

  await apikeys.insertOne(doc);

  // Return the raw key ONLY on creation
  return jsonResponse({ ok: true, apikey: toPublicKeyView(doc, true) }, 201, corsHeaders);
}

/** DELETE /api/apikeys/:id — revoke (soft-delete) a key */
export async function handleDeleteApiKey(request, auth, keyId, corsHeaders) {
  let objectId;
  try {
    objectId = new ObjectId(keyId);
  } catch {
    return jsonResponse({ error: "Invalid key ID." }, 400, corsHeaders);
  }

  const { apikeys } = getCollections();
  const result = await apikeys.updateOne(
    { _id: objectId, userId: new ObjectId(auth.userId), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    return jsonResponse({ error: "API key not found or already revoked." }, 404, corsHeaders);
  }

  return jsonResponse({ ok: true }, 200, corsHeaders);
}
