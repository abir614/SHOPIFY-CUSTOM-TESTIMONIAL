import { ObjectId } from "mongodb";
import { jsonResponse } from "../security.js";
import { getCollections } from "../db.js";
import { encryptSecret } from "../crypto-utils.js";
import { FIELD_TYPES, SLUG_RE, DEFAULT_MAX_FIELD_LENGTH, DEFAULT_MAX_FILE_BYTES, DEFAULT_MAX_FORM_FIELDS } from "../validation.js";
import { SHOPIFY_DOMAIN_RE } from "../shopify.js";

const RESERVED_APP_NAMES = new Set([
  "files", "api", "health", "admin", "www", "app", "static", "assets",
  "login", "register", "dashboard", "apps", "submissions", "guide", "docs", "settings", "logout", "home"
]);

function sanitizeFields(rawFields) {
  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    return { error: "At least one field is required." };
  }
  if (rawFields.length > 60) return { error: "Too many fields (max 60)." };

  const seenKeys = new Set();
  const fields = [];
  for (const raw of rawFields) {
    const key = typeof raw?.key === "string" ? raw.key.trim().toLowerCase() : "";
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(key)) {
      return { error: `Field key "${raw?.key}" must be lowercase letters, numbers, or underscores, starting with a letter.` };
    }
    if (seenKeys.has(key)) return { error: `Duplicate field key: ${key}` };
    seenKeys.add(key);

    const validWidths = ["100", "50", "33"];
    const type = FIELD_TYPES.includes(raw?.type) ? raw.type : "text";
    const field = {
      key,
      label: typeof raw?.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 200) : key,
      type,
      required: Boolean(raw?.required),
      maxLength: Number.isFinite(raw?.maxLength) ? Math.min(Math.max(Number(raw.maxLength), 1), 10000) : DEFAULT_MAX_FIELD_LENGTH,
      placeholder: typeof raw?.placeholder === "string" ? raw.placeholder.trim().slice(0, 200) : "",
      helpText: typeof raw?.helpText === "string" ? raw.helpText.trim().slice(0, 300) : "",
      defaultValue: typeof raw?.defaultValue === "string" ? raw.defaultValue.trim().slice(0, 500) : "",
      width: validWidths.includes(String(raw?.width)) ? String(raw.width) : "100",
      pattern: typeof raw?.pattern === "string" ? raw.pattern.trim().slice(0, 200) : "",
      patternError: typeof raw?.patternError === "string" ? raw.patternError.trim().slice(0, 200) : "",
      customClass: typeof raw?.customClass === "string" ? raw.customClass.trim().slice(0, 100) : "",
      autocomplete: typeof raw?.autocomplete === "string" ? raw.autocomplete.trim().slice(0, 50) : "",
    };
    if (type === "select" || type === "radio") {
      field.options = Array.isArray(raw?.options) ? raw.options.map(String).slice(0, 50) : [];
      field.allowOther = Boolean(raw?.allowOther);
    }
    if (type === "number") {
      if (Number.isFinite(raw?.min)) field.min = Number(raw.min);
      if (Number.isFinite(raw?.max)) field.max = Number(raw.max);
    }
    fields.push(field);
  }
  return { fields };
}

async function sanitizeSettings(rawSettings = {}, existingSettings = {}) {
  const settings = {
    appTitle: typeof rawSettings.appTitle === "string" ? rawSettings.appTitle.trim().slice(0, 200) : "",
    appDescription: typeof rawSettings.appDescription === "string" ? rawSettings.appDescription.trim().slice(0, 500) : "",
    submitBtnText: typeof rawSettings.submitBtnText === "string" ? rawSettings.submitBtnText.trim().slice(0, 60) || "Submit Form" : "Submit Form",
    successMessage: typeof rawSettings.successMessage === "string" ? rawSettings.successMessage.trim().slice(0, 500) || "Thank you! Your submission has been received." : "Thank you! Your submission has been received.",
    redirectUrl: typeof rawSettings.redirectUrl === "string" ? rawSettings.redirectUrl.trim().slice(0, 300) : "",
    themeColor: typeof rawSettings.themeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(rawSettings.themeColor.trim()) ? rawSettings.themeColor.trim() : "#818cf8",
    webhookUrl: typeof rawSettings.webhookUrl === "string" ? rawSettings.webhookUrl.trim().slice(0, 300) : "",
    allowedOrigins: Array.isArray(rawSettings.allowedOrigins) ? rawSettings.allowedOrigins.map(String).slice(0, 20) : ["*"],
    honeypotField: typeof rawSettings.honeypotField === "string" ? rawSettings.honeypotField.trim() || "website" : "website",
    maxFileBytes: Number.isFinite(rawSettings.maxFileBytes) ? Math.min(Number(rawSettings.maxFileBytes), 25 * 1024 * 1024) : DEFAULT_MAX_FILE_BYTES,
    maxFormFields: Number.isFinite(rawSettings.maxFormFields) ? Math.min(Number(rawSettings.maxFormFields), 100) : DEFAULT_MAX_FORM_FIELDS,
    turnstile: { enabled: false, secretKeyEnc: "" },
    shopify: { enabled: false },
  };

  if (rawSettings.turnstile?.enabled) {
    const secretKey = typeof rawSettings.turnstile.secretKey === "string" ? rawSettings.turnstile.secretKey.trim() : "";
    settings.turnstile.enabled = true;
    settings.turnstile.secretKeyEnc = secretKey ? await encryptSecret(secretKey) : existingSettings.turnstile?.secretKeyEnc || "";
    if (!settings.turnstile.secretKeyEnc) return { error: "Turnstile secret key is required when Turnstile is enabled." };
  }

  if (rawSettings.shopify?.enabled) {
    const storeDomain = typeof rawSettings.shopify.storeDomain === "string" ? rawSettings.shopify.storeDomain.trim() : "";
    if (!SHOPIFY_DOMAIN_RE.test(storeDomain)) return { error: "shopify.storeDomain must look like your-store.myshopify.com" };
    const apiVersion = typeof rawSettings.shopify.apiVersion === "string" && rawSettings.shopify.apiVersion.trim()
      ? rawSettings.shopify.apiVersion.trim()
      : existingSettings.shopify?.apiVersion || "2025-01";
    const metaobjectType = typeof rawSettings.shopify.metaobjectType === "string" ? rawSettings.shopify.metaobjectType.trim() : "";
    if (!metaobjectType) return { error: "shopify.metaobjectType is required when Shopify sync is enabled." };
    const adminAccessToken = typeof rawSettings.shopify.adminAccessToken === "string" ? rawSettings.shopify.adminAccessToken.trim() : "";
    const adminAccessTokenEnc = adminAccessToken ? await encryptSecret(adminAccessToken) : existingSettings.shopify?.adminAccessTokenEnc || "";
    if (!adminAccessTokenEnc) return { error: "shopify.adminAccessToken is required when Shopify sync is enabled." };

    settings.shopify = {
      enabled: true,
      storeDomain,
      apiVersion,
      metaobjectType,
      adminAccessTokenEnc,
      imageFieldKey: typeof rawSettings.shopify.imageFieldKey === "string" ? rawSettings.shopify.imageFieldKey.trim() : "",
      fieldMapping: rawSettings.shopify.fieldMapping && typeof rawSettings.shopify.fieldMapping === "object" ? rawSettings.shopify.fieldMapping : {},
    };
  }

  return { settings };
}

/** Strip anything secret before sending an app doc back to its owner. */
function toPublicAppView(app) {
  return {
    appName: app.appName,
    fields: app.fields,
    settings: {
      allowedOrigins: app.settings.allowedOrigins,
      honeypotField: app.settings.honeypotField,
      maxFileBytes: app.settings.maxFileBytes,
      maxFormFields: app.settings.maxFormFields,
      appTitle: app.settings.appTitle,
      appDescription: app.settings.appDescription,
      submitBtnText: app.settings.submitBtnText,
      successMessage: app.settings.successMessage,
      redirectUrl: app.settings.redirectUrl,
      themeColor: app.settings.themeColor,
      webhookUrl: app.settings.webhookUrl,
      turnstile: { enabled: app.settings.turnstile?.enabled || false, configured: Boolean(app.settings.turnstile?.secretKeyEnc) },
      shopify: app.settings.shopify?.enabled
        ? {
            enabled: true,
            storeDomain: app.settings.shopify.storeDomain,
            apiVersion: app.settings.shopify.apiVersion,
            metaobjectType: app.settings.shopify.metaobjectType,
            imageFieldKey: app.settings.shopify.imageFieldKey,
            fieldMapping: app.settings.shopify.fieldMapping,
            configured: Boolean(app.settings.shopify.adminAccessTokenEnc),
          }
        : { enabled: false },
    },
    submitUrl: `/${app.ownerUsername}/${app.appName}/`,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export async function handleListApps(request, auth, corsHeaders) {
  const { apps } = getCollections();
  const list = await apps.find({ ownerId: new ObjectId(auth.userId) }).sort({ createdAt: -1 }).toArray();
  return jsonResponse({ ok: true, apps: list.map(toPublicAppView) }, 200, corsHeaders);
}

export async function handleCreateApp(request, auth, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const appName = typeof body.appName === "string" ? body.appName.trim().toLowerCase() : "";
  if (!SLUG_RE.test(appName) || RESERVED_APP_NAMES.has(appName)) {
    return jsonResponse({ error: "appName must be 1-50 chars: lowercase letters, numbers, hyphens." }, 400, corsHeaders);
  }

  const fieldResult = sanitizeFields(body.fields);
  if (fieldResult.error) return jsonResponse({ error: fieldResult.error }, 400, corsHeaders);

  const settingsResult = await sanitizeSettings(body.settings || {});
  if (settingsResult.error) return jsonResponse({ error: settingsResult.error }, 400, corsHeaders);

  const { apps } = getCollections();
  const now = new Date();
  const doc = {
    ownerId: new ObjectId(auth.userId),
    ownerUsername: auth.username,
    appName,
    fields: fieldResult.fields,
    settings: settingsResult.settings,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await apps.insertOne(doc);
  } catch (e) {
    if (e?.code === 11000) return jsonResponse({ error: "You already have an app with that name." }, 409, corsHeaders);
    throw e;
  }

  return jsonResponse({ ok: true, app: toPublicAppView(doc) }, 201, corsHeaders);
}

export async function handleGetApp(request, auth, appName, corsHeaders) {
  const { apps } = getCollections();
  const app = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName });
  if (!app) return jsonResponse({ error: "App not found." }, 404, corsHeaders);
  return jsonResponse({ ok: true, app: toPublicAppView(app) }, 200, corsHeaders);
}

export async function handleUpdateApp(request, auth, appName, corsHeaders) {
  const { apps } = getCollections();
  const existing = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName });
  if (!existing) return jsonResponse({ error: "App not found." }, 404, corsHeaders);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400, corsHeaders);
  }

  const update = { updatedAt: new Date() };

  if (body.fields !== undefined) {
    const fieldResult = sanitizeFields(body.fields);
    if (fieldResult.error) return jsonResponse({ error: fieldResult.error }, 400, corsHeaders);
    update.fields = fieldResult.fields;
  }

  if (body.settings !== undefined) {
    const settingsResult = await sanitizeSettings(body.settings, existing.settings);
    if (settingsResult.error) return jsonResponse({ error: settingsResult.error }, 400, corsHeaders);
    update.settings = settingsResult.settings;
  }

  await apps.updateOne({ _id: existing._id }, { $set: update });
  const updated = await apps.findOne({ _id: existing._id });
  return jsonResponse({ ok: true, app: toPublicAppView(updated) }, 200, corsHeaders);
}

export async function handleDeleteApp(request, auth, appName, corsHeaders) {
  const { apps, submissions } = getCollections();
  const existing = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName });
  if (!existing) return jsonResponse({ error: "App not found." }, 404, corsHeaders);

  await apps.deleteOne({ _id: existing._id });
  await submissions.deleteMany({ appId: existing._id });

  return jsonResponse({ ok: true }, 200, corsHeaders);
}
