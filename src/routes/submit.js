import { jsonResponse, checkOrigin, checkRateLimit, clientIp } from "../security.js";
import { getCollections } from "../db.js";
import { decryptSecret } from "../crypto-utils.js";
import { createMetaobject, uploadImageToShopify } from "../shopify.js";
import { putFile } from "../storage.js";
import {
  readBodyWithLimit,
  BodyTooLargeError,
  validateSubmission,
  sniffImageMime,
  stripJpegExif,
  errMessage,
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

/** Look up an app by owner username + app slug. Returns null if either doesn't exist. */
export async function findApp(username, appName) {
  const { users, apps } = getCollections();
  const user = await users.findOne({ username });
  if (!user) return null;
  const app = await apps.findOne({ ownerId: user._id, appName });
  return app;
}

async function storeFileBytes(app, bytes, mimeType, ext) {
  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = `submissions/${app._id}/${filename}`;
  await putFile(key, bytes, mimeType);
  return {
    storage: "local",
    key,
    url: `/${app.ownerUsername}/${app.appName}/files/${encodeURIComponent(filename)}`,
  };
}

/** GET /:username/:appname/ — public, read-only schema for building a form UI. */
export async function handleGetAppSchema(request, username, appName, corsHeaders) {
  const app = await findApp(username, appName);
  if (!app) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  const originCheck = checkOrigin(request, app.settings.allowedOrigins);
  const headers = { ...corsHeaders, ...originCheck.headers };
  if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, headers);

  const publicFields = app.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    maxLength: f.maxLength,
    options: f.options,
  }));
  return jsonResponse({ ok: true, appName: app.appName, fields: publicFields }, 200, headers);
}

/** POST /:username/:appname/ — public form submission endpoint. */
export async function handleSubmit(request, username, appName, corsHeaders) {
  const app = await findApp(username, appName);
  if (!app) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  const originCheck = checkOrigin(request, app.settings.allowedOrigins);
  const headers = { ...corsHeaders, ...originCheck.headers };
  if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, headers);

  const ip = clientIp(request);
  // checkRateLimit is synchronous in the Node.js version (in-memory)
  const rateOk = checkRateLimit(null, `${app._id}:${ip}`, 20, 60);
  if (!rateOk) return jsonResponse({ error: "Too many requests. Please try again shortly." }, 429, headers);

  const maxFileBytes = app.settings.maxFileBytes;
  const maxBodyBytes = maxFileBytes + 65536; // room for text fields + multipart overhead
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > maxBodyBytes) return jsonResponse({ error: "Request body too large." }, 413, headers);

  let rawBody;
  try {
    rawBody = await readBodyWithLimit(request, maxBodyBytes);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return jsonResponse({ error: "Request body too large." }, 413, headers);
    return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }

  let formData;
  try {
    formData = await new Response(rawBody, { headers: { "Content-Type": request.headers.get("Content-Type") || "" } }).formData();
  } catch {
    return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }

  let fieldCount = 0;
  for (const _ of formData.entries()) {
    fieldCount++;
    if (fieldCount > app.settings.maxFormFields) return jsonResponse({ error: "Invalid form submission." }, 400, headers);
  }

  // Honeypot: bots fill every field, humans never see this one.
  const honeypot = formData.get(app.settings.honeypotField);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return jsonResponse({ ok: true }, 200, headers); // fake success, drop silently
  }

  if (app.settings.turnstile?.enabled) {
    const secretKey = await decryptSecret(app.settings.turnstile.secretKeyEnc);
    const token = formData.get("cf-turnstile-response");
    if (!secretKey || !(await verifyTurnstile(token, ip, secretKey))) {
      return jsonResponse({ error: "Verification failed. Please refresh and try again." }, 403, headers);
    }
  }

  const textFields = app.fields.filter((f) => f.type !== "file");
  const validation = validateSubmission(textFields, formData);
  if (!validation.ok) {
    return jsonResponse({ error: "Please review the highlighted fields and try again.", details: validation.errors }, 400, headers);
  }
  const data = validation.data;

  // File fields: at most one upload per configured file field.
  const fileFields = app.fields.filter((f) => f.type === "file");
  const fileResults = {};
  for (const field of fileFields) {
    const uploads = formData.getAll(field.key).filter((v) => typeof v !== "string");
    if (uploads.length > 1) {
      return jsonResponse({ error: `Only one file may be uploaded for ${field.label}.` }, 400, headers);
    }
    const file = uploads[0];
    if (!file) continue;
    if (file.size === 0) return jsonResponse({ error: "The uploaded file is empty." }, 400, headers);
    if (file.size > maxFileBytes) return jsonResponse({ error: "The uploaded file is too large." }, 400, headers);

    let bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffImageMime(bytes);
    if (!mimeType) return jsonResponse({ error: "The uploaded file does not appear to be a valid image." }, 400, headers);
    if (mimeType === "image/jpeg") {
      try {
        bytes = stripJpegExif(bytes);
      } catch (e) {
        console.error("[image] EXIF strip failed, uploading original bytes:", errMessage(e));
      }
    }

    if (app.settings.shopify?.enabled && app.settings.shopify.imageFieldKey === field.key) {
      const adminAccessToken = await decryptSecret(app.settings.shopify.adminAccessTokenEnc);
      const shopifyFileId = await uploadImageToShopify({ ...app.settings.shopify, adminAccessToken }, bytes, mimeType);
      fileResults[field.key] = shopifyFileId ? { storage: "shopify", shopifyFileId } : null;
    } else {
      const ext = mimeType.split("/")[1];
      fileResults[field.key] = await storeFileBytes(app, bytes, mimeType, ext);
    }
  }

  const now = new Date();
  const { submissions } = getCollections();
  const submissionDoc = {
    appId: app._id,
    ownerId: app.ownerId,
    data,
    files: fileResults,
    ip,
    userAgent: request.headers.get("User-Agent") || "",
    shopifyStatus: app.settings.shopify?.enabled ? "pending" : "skipped",
    createdAt: now,
  };
  const insertResult = await submissions.insertOne(submissionDoc);

  if (app.settings.shopify?.enabled) {
    const adminAccessToken = await decryptSecret(app.settings.shopify.adminAccessTokenEnc);
    const shopifyData = { ...data };
    for (const [key, result] of Object.entries(fileResults)) {
      if (result?.storage === "shopify") shopifyData[key] = result.shopifyFileId;
      else delete shopifyData[key];
    }
    const syncResult = await createMetaobject({ ...app.settings.shopify, adminAccessToken }, shopifyData, app.settings.shopify.fieldMapping);
    await submissions.updateOne(
      { _id: insertResult.insertedId },
      {
        $set: {
          shopifyStatus: syncResult.ok ? "synced" : "failed",
          shopifyHandle: syncResult.handle || null,
          shopifyErrors: [...(syncResult.userErrors || []), ...(syncResult.systemErrors || [])].slice(0, 10),
        },
      }
    );
  }

  // Fire-and-forget webhook — replaces request.waitUntil() from the Worker API
  if (app.settings?.webhookUrl) {
    setImmediate(() => {
      fetch(app.settings.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "submission.created",
          appName: app.appName,
          submissionId: String(insertResult.insertedId),
          data,
          createdAt: new Date().toISOString(),
        }),
      }).catch((err) => console.error("[webhook] dispatch failed:", errMessage(err)));
    });
  }

  return jsonResponse(
    {
      ok: true,
      id: String(insertResult.insertedId),
      successMessage: app.settings?.successMessage || "Thank you! Your submission has been received.",
      redirectUrl: app.settings?.redirectUrl || null,
    },
    200,
    headers
  );
}
