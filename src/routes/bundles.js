import { jsonResponse } from "../security.js";
import { getCollections } from "../db.js";
import { ObjectId } from "mongodb";

function sanitizeText(str) {
  return typeof str === "string" ? str.replace(/[<>]/g, "").trim() : "";
}

const BUNDLE_NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

// List bundles
export async function handleListBundles(request, auth, corsHeaders) {
  const { bundles } = getCollections();
  const list = await bundles.find({ ownerId: new ObjectId(auth.userId) }).sort({ createdAt: -1 }).toArray();
  const safeList = list.map(b => ({
    bundleName: b.bundleName,
    displayName: b.displayName,
    linkedApps: b.linkedApps || [],
    settings: b.settings || {},
    submitUrl: `/api/${b.ownerUsername}/${b.bundleName}/`,
    createdAt: b.createdAt
  }));
  return jsonResponse({ ok: true, bundles: safeList }, 200, corsHeaders);
}

// Create or update bundle
export async function handleCreateBundle(request, auth, corsHeaders) {
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400, corsHeaders); }

  const bundleName = typeof body.bundleName === "string" ? body.bundleName.trim().toLowerCase() : "";
  if (!BUNDLE_NAME_RE.test(bundleName)) return jsonResponse({ error: "Invalid bundle name (1-50 chars, lowercase, numbers, hyphens)" }, 400, corsHeaders);

  const displayName = typeof body.displayName === "string" ? sanitizeText(body.displayName).slice(0, 100) : bundleName;
  const linkedApps = Array.isArray(body.linkedApps) ? body.linkedApps.map(String).slice(0, 10) : [];
  if (linkedApps.length === 0) return jsonResponse({ error: "A bundle must link at least one app." }, 400, corsHeaders);

  const settings = {
    allowedOrigins: Array.isArray(body.settings?.allowedOrigins) ? body.settings.allowedOrigins.map(String).slice(0, 20) : ["*"],
    honeypotField: typeof body.settings?.honeypotField === "string" ? body.settings.honeypotField.trim() || "website" : "website",
    successMessage: typeof body.settings?.successMessage === "string" ? sanitizeText(body.settings.successMessage).slice(0, 500) : "",
    redirectUrl: typeof body.settings?.redirectUrl === "string" ? body.settings.redirectUrl.trim().slice(0, 300) : "",
  };

  const { bundles, apps } = getCollections();

  // Validate that all linked apps actually exist and belong to the user
  const appDocs = await apps.find({ ownerId: new ObjectId(auth.userId), appName: { $in: linkedApps } }).toArray();
  const foundApps = new Set(appDocs.map(a => a.appName));
  for (const app of linkedApps) {
    if (!foundApps.has(app)) return jsonResponse({ error: `Linked app '${app}' not found or not owned by you.` }, 400, corsHeaders);
  }

  // Check name conflict with regular apps (can't have a bundle and app with the same name)
  const existingApp = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName: bundleName });
  if (existingApp) return jsonResponse({ error: "An app with this name already exists. Choose a different bundle name." }, 400, corsHeaders);

  const existingBundle = await bundles.findOne({ ownerId: new ObjectId(auth.userId), bundleName });
  const now = new Date();

  if (existingBundle) {
    await bundles.updateOne({ _id: existingBundle._id }, { $set: { displayName, linkedApps, settings, updatedAt: now } });
    return jsonResponse({ ok: true }, 200, corsHeaders);
  } else {
    const doc = {
      ownerId: new ObjectId(auth.userId),
      ownerUsername: auth.username,
      bundleName,
      displayName,
      linkedApps,
      settings,
      createdAt: now,
      updatedAt: now
    };
    try {
      await bundles.insertOne(doc);
      return jsonResponse({ ok: true }, 201, corsHeaders);
    } catch (e) {
      if (e.code === 11000) return jsonResponse({ error: "Bundle name already exists." }, 400, corsHeaders);
      return jsonResponse({ error: "Database error." }, 500, corsHeaders);
    }
  }
}

export async function handleDeleteBundle(request, auth, bundleName, corsHeaders) {
  const { bundles } = getCollections();
  const res = await bundles.deleteOne({ ownerId: new ObjectId(auth.userId), bundleName });
  if (res.deletedCount === 0) return jsonResponse({ error: "Bundle not found." }, 404, corsHeaders);
  return jsonResponse({ ok: true }, 200, corsHeaders);
}
