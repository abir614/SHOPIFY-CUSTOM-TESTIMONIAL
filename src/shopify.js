import { EXT_BY_MIME, errMessage } from "./validation.js";

const SHOPIFY_TIMEOUT_MS = 10_000;
export const SHOPIFY_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

/**
 * `shopifyConfig` shape (per-app, decrypted before calling these helpers):
 *   { storeDomain, apiVersion, adminAccessToken, metaobjectType, imageFieldKey }
 */
function graphqlUrl(config) {
  return `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`;
}

async function shopifyGraphQL(config, query, variables) {
  return fetch(graphqlUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.adminAccessToken,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(SHOPIFY_TIMEOUT_MS),
  });
}

/**
 * Uploads raw image bytes to Shopify via a staged upload, then registers it
 * as a File. Returns the Shopify file GID, or null if anything fails
 * (image sync is always best-effort — it must never block the submission).
 */
export async function uploadImageToShopify(config, bytes, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || "bin";
  const filename = `upload-${crypto.randomUUID()}.${ext}`;
  try {
    const stagedQuery = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `;
    const stagedRes = await shopifyGraphQL(config, stagedQuery, {
      input: [{ filename, mimeType, httpMethod: "POST", resource: "IMAGE" }],
    });
    const stagedJson = await stagedRes.json();
    const target = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) return null;

    const form = new FormData();
    for (const param of target.parameters) form.append(param.name, param.value);
    form.append("file", new Blob([bytes], { type: mimeType }), filename);

    const uploadRes = await fetch(target.url, { method: "POST", body: form, signal: AbortSignal.timeout(SHOPIFY_TIMEOUT_MS) });
    if (!uploadRes.ok) return null;

    const fileCreateQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) { files { id } userErrors { field message } }
      }
    `;
    const fileRes = await shopifyGraphQL(config, fileCreateQuery, {
      files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }],
    });
    const fileJson = await fileRes.json();
    return fileJson?.data?.fileCreate?.files?.[0]?.id || null;
  } catch (e) {
    console.error("[shopify] Image upload failed, continuing without image:", errMessage(e));
    return null;
  }
}

/**
 * Creates a metaobject from a flat { key: value } map, using the app's
 * configured `metaobjectType` and an optional field-key mapping (appFieldKey
 * -> shopifyFieldKey). Returns { ok, userErrors, systemErrors }.
 */
export async function createMetaobject(config, data, fieldMapping = {}) {
  const fields = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => ({
      key: fieldMapping[key] || key,
      value: String(value).slice(0, 1000),
    }));

  const query = `
    mutation CreateSubmissionMetaobject($metaobject: MetaobjectCreateInput!) {
      result: metaobjectCreate(metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message code }
      }
    }
  `;
  const variables = { metaobject: { type: config.metaobjectType, fields } };

  try {
    const res = await shopifyGraphQL(config, query, variables);
    const json = await res.json();
    const userErrors = json?.data?.result?.userErrors || [];
    const systemErrors = json.errors || [];
    return {
      ok: res.ok && systemErrors.length === 0 && userErrors.length === 0,
      handle: json?.data?.result?.metaobject?.handle || null,
      userErrors,
      systemErrors,
    };
  } catch (e) {
    return { ok: false, userErrors: [], systemErrors: [{ message: errMessage(e) }] };
  }
}
