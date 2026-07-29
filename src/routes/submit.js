import { jsonResponse, checkOrigin, checkRateLimit, clientIp } from "../security.js";
import { requireAuth } from "../auth.js";
import { getCollections } from "../db.js";
import { ObjectId } from "mongodb";
import { decryptSecret } from "../crypto-utils.js";
import { createMetaobject, uploadFileToShopify } from "../shopify.js";
import {
  readBodyWithLimit,
  BodyTooLargeError,
  validateSubmission,
  sniffMimeType,
  stripJpegExif,
  errMessage,
  DEFAULT_MAX_FILE_BYTES,
} from "../validation.js";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TIMEOUT_MS = 5000;
async function verifyTurnstile(token, ip, secretKey) {
  if (!token || typeof token !== "string") return false;
  const params = new URLSearchParams();
  params.set("secret", secretKey);
  params.set("response", token);
  if (ip) params.set("remoteip", ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    return (await res.json())?.success === true;
  } catch (e) {
    console.error("[turnstile] verification request failed:", errMessage(e));
    return false;
  }
}
function evaluateCondition(condition, data) {
  if (!condition || condition.operator === "always" || !condition.field) return true;
  const fieldVal = String(data[condition.field] ?? "").toLowerCase();
  const condVal  = String(condition.value ?? "").toLowerCase();
  switch (condition.operator) {
    case "contains":     return fieldVal.includes(condVal);
    case "not_contains": return !fieldVal.includes(condVal);
    case "equals":       return fieldVal === condVal;
    case "not_equals":   return fieldVal !== condVal;
    case "not_empty":    return fieldVal.trim() !== "";
    default:             return true;
  }
}
function shouldExecuteWrite(write, data) {
  if (!evaluateCondition(write.condition, data)) return false;
  for (const cond of (write.additionalConditions || [])) {
    if (!evaluateCondition(cond, data)) return false;
  }
  return true;
}
// ── Execute all configured writes for one app/shopify config ─────────────────
async function executeWrites(shopifyConfig, writes, data, submissions, submissionId) {
  if (!Array.isArray(writes) || writes.length === 0) return;
  const results = [];
  for (const write of writes) {
    if (!shouldExecuteWrite(write, data)) {
      results.push({ type: write.metaobjectType, status: "skipped" });
      continue;
    }
    const mapping = write.fieldMapping || {};
    const hasMappings = Object.keys(mapping).length > 0;
    const mappedData = {};
    if (hasMappings) {
      for (const [formKey, shopifyKey] of Object.entries(mapping)) {
        if (formKey.startsWith('"') && formKey.endsWith('"')) {
          mappedData[shopifyKey] = formKey.slice(1, -1);
        } else if (data[formKey] !== undefined && data[formKey] !== "") {
          mappedData[shopifyKey] = data[formKey];
        }
      }
    } else {
      Object.assign(mappedData, data);
    }
    const writeConfig = { ...shopifyConfig, metaobjectType: write.metaobjectType };
    const result = await createMetaobject(writeConfig, mappedData, {});
    results.push({
      type:   write.metaobjectType,
      status: result.ok ? "synced" : "failed",
      handle: result.handle || null,
      errors: [...(result.userErrors || []), ...(result.systemErrors || [])].slice(0, 5),
    });
    if (!result.ok) {
      console.error(`[shopify] write '${write.metaobjectType}' failed:`,
        JSON.stringify([...(result.userErrors || []), ...(result.systemErrors || [])]));
    }
  }
  await submissions.updateOne(
    { _id: submissionId },
    { $set: { shopifyWrites: results } }
  );
  return results;
}
async function processFileFields(app, formData, data, shopifyConfig, maxFileBytes) {
  const fileFields = app.fields.filter((f) => f.type === "file");
  for (const field of fileFields) {
    const uploads = formData.getAll(field.key).filter((v) => typeof v !== "string");
    if (uploads.length > 1) return { error: `Only one file may be uploaded for ${field.label}.` };
    const file = uploads[0];
    if (!file) {
      if (field.required) return { error: `${field.label} is required.` };
      continue;
    }
    if (file.size === 0) return { error: "The uploaded file is empty." };
    if (file.size > maxFileBytes) return { error: "The uploaded file is too large." };
    let bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffMimeType(bytes) || file.type || "application/octet-stream";
    if (mimeType === "image/jpeg") {
      try { bytes = stripJpegExif(bytes); } catch (e) {
        console.error("[image] EXIF strip failed:", errMessage(e));
      }
    }
    if (shopifyConfig?.enabled && shopifyConfig.imageFieldKey === field.key) {
      const adminAccessToken = await decryptSecret(shopifyConfig.adminAccessTokenEnc);
      const fileId = await uploadFileToShopify(
        { ...shopifyConfig, adminAccessToken }, bytes, mimeType, file.name
      );
      if (fileId) data[field.key] = fileId;
    }
  }
  return { ok: true };
}
export async function findApp(username, appName) {
  const { users, apps } = getCollections();
  const user = await users.findOne({ username });
  if (!user) return null;
  return apps.findOne({ ownerId: user._id, appName });
}
export async function findBundle(username, bundleName) {
  const { bundles } = getCollections();
  return bundles.findOne({ ownerUsername: username, bundleName });
}
export async function handleSubmit(request, username, appName, corsHeaders) {
  let isAdminTest = false;
  if (request.headers.has("Authorization")) {
    const auth = await requireAuth(request);
    if (!auth.error && auth.username === username) isAdminTest = true;
  }
  const app = await findApp(username, appName);
  if (!app) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  const originCheck = checkOrigin(request, app.settings.allowedOrigins);
  const headers = { ...corsHeaders, ...originCheck.headers };
  if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, headers);
  const ip = clientIp(request);
  if (!checkRateLimit(null, `${app._id}:${ip}`, 20, 60))
    return jsonResponse({ error: "Too many requests. Please try again shortly." }, 429, headers);
  const maxFileBytes = app.settings.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxBodyBytes = maxFileBytes + 65536;
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxBodyBytes) return jsonResponse({ error: "Request body too large." }, 413, headers);
  let rawBody;
  try { rawBody = await readBodyWithLimit(request, maxBodyBytes); }
  catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Request body too large." }, 413, headers);
    return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }
  let formData;
  try {
    formData = await new Response(rawBody, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch { return jsonResponse({ error: "Invalid form submission." }, 400, headers); }
  let fieldCount = 0;
  for (const _ of formData.entries()) {
    fieldCount++;
    if (fieldCount > app.settings.maxFormFields) return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }
  const honeypot = formData.get(app.settings.honeypotField);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return jsonResponse({ ok: true }, 200, headers);
  if (app.settings.turnstile?.enabled && !isAdminTest) {
    const secretKey = await decryptSecret(app.settings.turnstile.secretKeyEnc);
    const token = formData.get("cf-turnstile-response");
    if (!secretKey || !(await verifyTurnstile(token, ip, secretKey)))
      return jsonResponse({ error: "Verification failed. Please refresh and try again." }, 403, headers);
  }
  const validation = validateSubmission(app.fields.filter((f) => f.type !== "file"), formData);
  if (!validation.ok) {
    console.error("App validation failed:", validation.errors);
    return jsonResponse({ error: "Please review the highlighted fields and try again.", details: validation.errors }, 400, headers);
  }
  const data = validation.data;
  const fileResult = await processFileFields(app, formData, data, app.settings.shopify, app.settings.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES);
  if (fileResult.error) return jsonResponse({ error: fileResult.error }, 400, headers);
  const now = new Date();
  const { submissions } = getCollections();
  const submissionDoc = {
    appId: app._id,
    ownerId: app.ownerId,
    data,
    ip,
    userAgent: request.headers.get("User-Agent") || "",
    shopifyStatus: app.settings.shopify?.enabled ? "pending" : "skipped",
    createdAt: now,
  };
  const insertResult = await submissions.insertOne(submissionDoc);
  if (app.settings.shopify?.enabled) {
    const adminAccessToken = await decryptSecret(app.settings.shopify.adminAccessTokenEnc);
    const shopifyConfig = { ...app.settings.shopify, adminAccessToken };
    const syncResult = await createMetaobject(shopifyConfig, data, app.settings.shopify.fieldMapping);
    await submissions.updateOne(
      { _id: insertResult.insertedId },
      { $set: {
        shopifyStatus: syncResult.ok ? "synced" : "failed",
        shopifyHandle: syncResult.handle || null,
        shopifyErrors: [...(syncResult.userErrors || []), ...(syncResult.systemErrors || [])].slice(0, 10),
      }}
    );
    if (app.settings.shopify.writes?.length > 0) {
      await executeWrites(shopifyConfig, app.settings.shopify.writes, data, submissions, insertResult.insertedId);
    }
  }
  if (app.settings?.webhookUrl) {
    setImmediate(() => {
      fetch(app.settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "submission.created", appName: app.appName, submissionId: String(insertResult.insertedId), data, createdAt: new Date().toISOString() }),
      }).catch((err) => console.error("[webhook] dispatch failed:", errMessage(err)));
    });
  }
  return jsonResponse(
    { ok: true, id: String(insertResult.insertedId), successMessage: app.settings?.successMessage || "Thank you!", redirectUrl: app.settings?.redirectUrl || null },
    200, headers
  );
}
export async function handleBundleSubmit(request, username, bundleName, corsHeaders) {
  let isAdminTest = false;
  if (request.headers.has("Authorization")) {
    const auth = await requireAuth(request);
    if (!auth.error && auth.username === username) isAdminTest = true;
  }
  const { bundles, apps, users, submissions } = getCollections();
  const bundle = await bundles.findOne({ ownerUsername: username, bundleName });
  if (!bundle) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  const user = await users.findOne({ username });
  if (!user) return jsonResponse({ error: "Not found" }, 404, corsHeaders);
  const linkedAppDocs = await Promise.all(
    (bundle.linkedApps || []).map((an) => apps.findOne({ ownerId: user._id, appName: an }))
  );
  let resolvedApps = linkedAppDocs.filter(Boolean);
  if (resolvedApps.length === 0) return jsonResponse({ error: "Bundle has no linked apps." }, 400, corsHeaders);
  const allOrigins = resolvedApps.flatMap((a) => a.settings.allowedOrigins || ["*"]);
  const effectiveOrigins = allOrigins.includes("*") ? ["*"] : [...new Set(allOrigins)];
  const originCheck = checkOrigin(request, effectiveOrigins);
  const headers = { ...corsHeaders, ...originCheck.headers };
  if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, headers);
  const ip = clientIp(request);
  if (!checkRateLimit(null, `bundle:${bundle._id}:${ip}`, 20, 60))
    return jsonResponse({ error: "Too many requests. Please try again shortly." }, 429, headers);
  const maxFileBytes = Math.max(...resolvedApps.map((a) => a.settings.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES));
  const maxBodyBytes = maxFileBytes + 65536;
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxBodyBytes) return jsonResponse({ error: "Request body too large." }, 413, headers);
  let rawBody;
  try { rawBody = await readBodyWithLimit(request, maxBodyBytes); }
  catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Request body too large." }, 413, headers);
    return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }
  let formData;
  try {
    formData = await new Response(rawBody, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch { return jsonResponse({ error: "Invalid form submission." }, 400, headers); }
  // Honeypot — use bundle setting or first app's
  const honeypotField = bundle.settings?.honeypotField || resolvedApps[0].settings.honeypotField || "website";
  const honeypot = formData.get(honeypotField);
  if (typeof honeypot === "string" && honeypot.trim() !== "") return jsonResponse({ ok: true }, 200, headers);
  const requestedApp = formData.get("_formhub_app");
  if (requestedApp) {
    const targetApp = resolvedApps.find(a => a.appName === requestedApp);
    if (targetApp) resolvedApps = [targetApp];
  }
  const unionFieldMap = new Map();
  for (const app of resolvedApps) {
    for (const field of app.fields) {
      if (!unionFieldMap.has(field.key)) {
        unionFieldMap.set(field.key, { ...field });
      } else if (field.required) {
        unionFieldMap.get(field.key).required = true;
      }
    }
  }
  const unionFields = Array.from(unionFieldMap.values()).filter((f) => f.type !== "file");
  const validation = validateSubmission(unionFields, formData);
  if (!validation.ok) {
    return jsonResponse({ error: "Please review the highlighted fields and try again.", details: validation.errors }, 400, headers);
  }
  const data = validation.data;
  for (const app of resolvedApps) {
    const fileResult = await processFileFields(app, formData, data, app.settings.shopify, maxFileBytes);
    if (fileResult.error) return jsonResponse({ error: fileResult.error }, 400, headers);
  }
  const now = new Date();
  const submissionDoc = {
    bundleId: bundle._id,
    bundleName: bundle.bundleName,
    linkedAppIds: resolvedApps.map((a) => a._id),
    ownerId: user._id,
    data,
    ip,
    userAgent: request.headers.get("User-Agent") || "",
    shopifyResults: [],
    createdAt: now,
  };
  const insertResult = await submissions.insertOne(submissionDoc);
  // Execute each linked app's full Shopify write chain in parallel
  const shopifyResults = await Promise.all(resolvedApps.map(async (app) => {
    if (!app.settings.shopify?.enabled) return { app: app.appName, status: "skipped" };
    try {
      const adminAccessToken = await decryptSecret(app.settings.shopify.adminAccessTokenEnc);
      const shopifyConfig = { ...app.settings.shopify, adminAccessToken };
      const primary = await createMetaobject(shopifyConfig, data, app.settings.shopify.fieldMapping);
      const appResult = {
        app: app.appName,
        primary: { type: app.settings.shopify.metaobjectType, status: primary.ok ? "synced" : "failed", handle: primary.handle || null },
        writes: [],
      };
      if (app.settings.shopify.writes?.length > 0) {
        const writeResults = [];
        for (const write of app.settings.shopify.writes) {
          if (!shouldExecuteWrite(write, data)) { writeResults.push({ type: write.metaobjectType, status: "skipped" }); continue; }
          const mapping = write.fieldMapping || {};
          const hasMappings = Object.keys(mapping).length > 0;
          const mappedData = {};
          if (hasMappings) {
            for (const [fk, sk] of Object.entries(mapping)) { if (data[fk] !== undefined && data[fk] !== "") mappedData[sk] = data[fk]; }
          } else { Object.assign(mappedData, data); }
          const wr = await createMetaobject({ ...shopifyConfig, metaobjectType: write.metaobjectType }, mappedData, {});
          writeResults.push({ type: write.metaobjectType, status: wr.ok ? "synced" : "failed", handle: wr.handle || null });
        }
        appResult.writes = writeResults;
      }
      return appResult;
    } catch (e) {
      return { app: app.appName, status: "error", error: errMessage(e) };
    }
  }));
  await submissions.updateOne({ _id: insertResult.insertedId }, { $set: { shopifyResults } });
  for (const app of resolvedApps) {
    if (app.settings?.webhookUrl) {
      setImmediate(() => {
        fetch(app.settings.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "bundle.submission.created", bundleName: bundle.bundleName, appName: app.appName, submissionId: String(insertResult.insertedId), data, createdAt: new Date().toISOString() }),
        }).catch((err) => console.error("[webhook] dispatch failed:", errMessage(err)));
      });
    }
  }
  const bundleSuccessMessage = bundle.settings?.successMessage || resolvedApps[0].settings?.successMessage || "Thank you!";
  const bundleRedirectUrl = bundle.settings?.redirectUrl || resolvedApps[0].settings?.redirectUrl || null;
  return jsonResponse(
    { ok: true, id: String(insertResult.insertedId), successMessage: bundleSuccessMessage, redirectUrl: bundleRedirectUrl, shopifyResults },
    200, headers
  );
}
