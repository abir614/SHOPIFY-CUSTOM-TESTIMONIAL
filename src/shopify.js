import { EXT_BY_MIME, errMessage } from "./validation.js";
export const SHOPIFY_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;
const SHOPIFY_TIMEOUT_MS = 10_000;
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
function shopifyResource(mimeType) {
  if (!mimeType) return "FILE";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType === "model/gltf-binary" || mimeType === "model/gltf+json") return "MODEL_3D";
  return "FILE";
}
export async function uploadFileToShopify(config, bytes, mimeType, originalFilename) {
  const resource = shopifyResource(mimeType);
  const ext = EXT_BY_MIME[mimeType] || (originalFilename?.split(".").pop()?.toLowerCase() || "bin");
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
      input: [{ filename, mimeType, httpMethod: "POST", resource }],
    });
    const stagedJson = await stagedRes.json();
    const target = stagedJson?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) return null;
    const form = new FormData();
    for (const param of target.parameters) form.append(param.name, param.value);
    form.append("file", new Blob([bytes], { type: mimeType }), filename);
    const uploadRes = await fetch(target.url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(SHOPIFY_TIMEOUT_MS),
    });
    if (!uploadRes.ok) return null;
    const contentType = resource === "IMAGE" ? "IMAGE" : resource === "VIDEO" ? "VIDEO" : "FILE";
    const fileCreateQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) { files { id } userErrors { field message } }
      }
    `;
    const fileRes = await shopifyGraphQL(config, fileCreateQuery, {
      files: [{ originalSource: target.resourceUrl, contentType }],
    });
    const fileJson = await fileRes.json();
    return fileJson?.data?.fileCreate?.files?.[0]?.id || null;
  } catch (e) {
    console.error("[shopify] File upload failed, continuing:", errMessage(e));
    return null;
  }
}
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
