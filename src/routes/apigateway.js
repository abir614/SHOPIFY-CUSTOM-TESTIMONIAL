import { ObjectId } from "mongodb";
import { jsonResponse, checkRateLimit, clientIp } from "../security.js";
import { getCollections } from "../db.js";
import { handleListSubmissions, handleGetSubmission } from "./submissions.js";
import { handleSubmit } from "./submit.js";

const KEY_RE = /^fhk_[0-9a-f]{64}$/i;

/** Check whether an API key is valid and has the requested action + app permission.
 *  Returns { error, status, message } on failure, or { key, ownerUserId, ownerUsername } on success.
 */
async function resolveApiKey(rawKey, requiredAction, appName = null) {
  if (!KEY_RE.test(rawKey)) {
    return { error: true, status: 404, message: "API key not found." };
  }

  const { apikeys, users } = getCollections();
  const keyDoc = await apikeys.findOne({ key: rawKey });

  if (!keyDoc) {
    return { error: true, status: 404, message: "API key not found." };
  }

  if (keyDoc.revokedAt) {
    return { error: true, status: 401, message: "API key has been revoked." };
  }

  // Check action permission
  if (!keyDoc.permissions.actions.includes(requiredAction)) {
    return { error: true, status: 403, message: `This API key does not have '${requiredAction}' permission.` };
  }

  // Check app-level permission
  if (appName && keyDoc.permissions.apps !== "*") {
    if (!keyDoc.permissions.apps.includes(appName)) {
      return { error: true, status: 403, message: `This API key is not permitted to access app '${appName}'.` };
    }
  }

  // Resolve owner
  const owner = await users.findOne({ _id: new ObjectId(keyDoc.userId) });
  if (!owner) {
    return { error: true, status: 401, message: "API key owner not found." };
  }

  // Async update lastUsedAt (non-blocking)
  apikeys.updateOne({ _id: keyDoc._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    error: false,
    keyDoc,
    ownerUserId: String(owner._id),
    ownerUsername: owner.username,
    ownerEmail: owner.email,
  };
}

/**
 * Main gateway handler called with the full request and the path *after* the key segment.
 * e.g. for /api/fhk_xxx/apps/my-app/submissions the subPath would be /apps/my-app/submissions
 */
export async function handleApiGateway(request, rawKey, subPath) {
  const method = request.method;
  const corsHeaders = { "Access-Control-Allow-Origin": "*", Vary: "Origin" };

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
      },
    });
  }

  // Rate-limit by API key
  const ip = clientIp(request);
  const rateLimitKey = `apikey:${rawKey.slice(0, 20)}:${ip}`;
  if (!checkRateLimit(null, rateLimitKey, 60, 60)) {
    return jsonResponse({ error: "Rate limit exceeded. Please slow down." }, 429, corsHeaders);
  }

  // ── Route: GET /apps ─────────────────────────────────────────────────────
  if (subPath === "/apps" && method === "GET") {
    const auth = await resolveApiKey(rawKey, "read");
    if (auth.error) return jsonResponse({ error: auth.message }, auth.status, corsHeaders);

    const { apps } = getCollections();
    let query = { ownerId: new ObjectId(auth.ownerUserId) };

    if (auth.keyDoc.permissions.apps !== "*") {
      query.appName = { $in: auth.keyDoc.permissions.apps };
    }

    const list = await apps.find(query).sort({ createdAt: -1 }).toArray();
    const publicList = list.map((a) => ({
      appName: a.appName,
      appTitle: a.settings.appTitle,
      appDescription: a.settings.appDescription,
      fields: a.fields,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return jsonResponse({ ok: true, apps: publicList }, 200, corsHeaders);
  }

  // ── Routes under /apps/{appName} ─────────────────────────────────────────
  const submissionsListMatch = subPath.match(/^\/apps\/([^/]+)\/submissions$/);
  const submissionItemMatch = subPath.match(/^\/apps\/([^/]+)\/submissions\/([^/]+)$/);
  const submitMatch = subPath.match(/^\/apps\/([^/]+)\/submit$/);

  if (submissionsListMatch && method === "GET") {
    const appName = decodeURIComponent(submissionsListMatch[1]);
    const auth = await resolveApiKey(rawKey, "read", appName);
    if (auth.error) return jsonResponse({ error: auth.message }, auth.status, corsHeaders);

    const fakeAuth = { userId: auth.ownerUserId, username: auth.ownerUsername, email: auth.ownerEmail };
    return handleListSubmissions(request, fakeAuth, appName, corsHeaders);
  }

  if (submissionItemMatch && method === "GET") {
    const appName = decodeURIComponent(submissionItemMatch[1]);
    const submissionId = decodeURIComponent(submissionItemMatch[2]);
    const auth = await resolveApiKey(rawKey, "read", appName);
    if (auth.error) return jsonResponse({ error: auth.message }, auth.status, corsHeaders);

    const fakeAuth = { userId: auth.ownerUserId, username: auth.ownerUsername, email: auth.ownerEmail };
    return handleGetSubmission(request, fakeAuth, appName, submissionId, corsHeaders);
  }

  if (submitMatch && method === "POST") {
    const appName = decodeURIComponent(submitMatch[1]);
    const auth = await resolveApiKey(rawKey, "submit", appName);
    if (auth.error) return jsonResponse({ error: auth.message }, auth.status, corsHeaders);

    return handleSubmit(request, auth.ownerUsername, appName, corsHeaders);
  }

  // ── Method not allowed on known paths ────────────────────────────────────
  if (
    submissionsListMatch ||
    submissionItemMatch ||
    submitMatch ||
    subPath === "/apps"
  ) {
    return jsonResponse({ error: "Method not allowed." }, 405, corsHeaders);
  }

  return jsonResponse(
    {
      ok: false,
      error: "Unknown API gateway endpoint.",
      hint: "Valid paths: /api/{key}/apps  |  /api/{key}/apps/{appName}/submissions  |  /api/{key}/apps/{appName}/submit",
    },
    404,
    corsHeaders
  );
}
