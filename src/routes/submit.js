import { jsonResponse, checkOrigin, checkRateLimit, clientIp } from "../security.js";
import { getCollections } from "../db.js";
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

export async function findApp(username, appName) {
  const { users, apps } = getCollections();
  const user = await users.findOne({ username });
  if (!user) return null;
  const app = await apps.findOne({ ownerId: user._id, appName });
  return app;
}

// GET schema endpoint removed — form endpoints are POST-only to prevent data exposure

export async function handleSubmit(request, username, appName, corsHeaders) {
  const app = await findApp(username, appName);
  if (!app) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  const originCheck = checkOrigin(request, app.settings.allowedOrigins);
  const headers = { ...corsHeaders, ...originCheck.headers };
  if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, headers);

  const ip = clientIp(request);
  const rateOk = checkRateLimit(null, `${app._id}:${ip}`, 20, 60);
  if (!rateOk) return jsonResponse({ error: "Too many requests. Please try again shortly." }, 429, headers);

  const maxFileBytes = app.settings.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxBodyBytes = maxFileBytes + 65536;
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

  const honeypot = formData.get(app.settings.honeypotField);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return jsonResponse({ ok: true }, 200, headers);
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

  const fileFields = app.fields.filter((f) => f.type === "file");
  for (const field of fileFields) {
    const uploads = formData.getAll(field.key).filter((v) => typeof v !== "string");

    if (uploads.length > 1) {
      return jsonResponse({ error: `Only one file may be uploaded for ${field.label}.` }, 400, headers);
    }
    const file = uploads[0];
    if (!file) {
      if (field.required) return jsonResponse({ error: `${field.label} is required.` }, 400, headers);
      continue;
    }
    if (file.size === 0) return jsonResponse({ error: "The uploaded file is empty." }, 400, headers);
    if (file.size > maxFileBytes) return jsonResponse({ error: "The uploaded file is too large." }, 400, headers);

    let bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffMimeType(bytes) || file.type || "application/octet-stream";

    if (mimeType === "image/jpeg") {
      try { bytes = stripJpegExif(bytes); } catch (e) {
        console.error("[image] EXIF strip failed, uploading original bytes:", errMessage(e));
      }
    }

    if (app.settings.shopify?.enabled && app.settings.shopify.imageFieldKey === field.key) {
      const adminAccessToken = await decryptSecret(app.settings.shopify.adminAccessTokenEnc);
      const shopifyFileId = await uploadFileToShopify(
        { ...app.settings.shopify, adminAccessToken },
        bytes,
        mimeType,
        file.name
      );
      if (shopifyFileId) data[field.key] = shopifyFileId;
    }
  }

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

    // -- Primary write (always): e.g. story_intake --
    const syncResult = await createMetaobject(shopifyConfig, data, app.settings.shopify.fieldMapping);
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

    // -- Dual write (conditional): testimonial or pet_testimonial --
    // Mirrors the original Cloudflare Worker logic exactly.
    // Triggered only when app.settings.shopify.dualWrite === true
    // AND the submitter granted permission_to_share.
    if (app.settings.shopify.dualWrite === true) {
      const permissionToShare = String(data.permission_to_share || "");
      if (permissionToShare.includes("Yes")) {
        const isPetStory = String(data.is_pet_story || "").trim() === "true";
        const authorName = permissionToShare.includes("anonymous")
          ? "Anonymous"
          : (data.name || "Anonymous");
        const quote = data.experience_story || "";

        let secondaryType, secondaryFields;

        if (isPetStory) {
          secondaryType = "pet_testimonial";
          secondaryFields = {
            author_name:   authorName,
            provider_name: data.hospital || "",
            pet_name:      data.loved_one_name || "",
            quote,
            // pet_image already resolved to a Shopify file ID in data if uploaded
            ...(data.user_image ? { pet_image: data.user_image } : {}),
          };
        } else {
          secondaryType = "testimonial";
          secondaryFields = {
            display_name: authorName,
            hospital:     data.hospital || "",
            role:         data.role || "",
            quote,
            ...(data.user_image ? { user_image: data.user_image } : {}),
          };
        }

        // Remove empty values before sending to Shopify
        for (const k of Object.keys(secondaryFields)) {
          if (secondaryFields[k] === "") delete secondaryFields[k];
        }

        const secondaryConfig = { ...shopifyConfig, metaobjectType: secondaryType };
        const secondaryResult = await createMetaobject(secondaryConfig, secondaryFields, {});

        if (secondaryResult.ok) {
          console.log(`[shopify] dual-write ${secondaryType} created:`, secondaryResult.handle);
        } else {
          console.error(`[shopify] dual-write ${secondaryType} failed:`,
            JSON.stringify([...(secondaryResult.userErrors || []), ...(secondaryResult.systemErrors || [])]));
        }

        await submissions.updateOne(
          { _id: insertResult.insertedId },
          {
            $set: {
              shopifyDualWriteType:   secondaryType,
              shopifyDualWriteStatus: secondaryResult.ok ? "synced" : "failed",
              shopifyDualWriteHandle: secondaryResult.handle || null,
            },
          }
        );
      }
    }
  }

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
