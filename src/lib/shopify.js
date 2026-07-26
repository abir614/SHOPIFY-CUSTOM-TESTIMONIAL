import { randomUUID } from 'node:crypto';
import { outboundAgent } from './httpAgent.js';
import { config } from '../config.js';
import { logger } from './logger.js';
import { EXT_BY_MIME } from './validation.js';

export async function shopifyGraphQL(query, variables) {
  return fetch(config.shopify.graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopify.adminToken,
    },
    body: JSON.stringify({ query, variables }),
    dispatcher: outboundAgent,
    signal: AbortSignal.timeout(config.shopify.timeoutMs),
  });
}

const STAGED_UPLOADS_CREATE = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) { files { id } userErrors { field message } }
  }
`;

export async function uploadImageToShopify(buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || 'bin';
  const filename = `upload-${randomUUID()}.${ext}`;

  try {
    const stagedRes = await shopifyGraphQL(STAGED_UPLOADS_CREATE, {
      input: [{ filename, mimeType, httpMethod: 'POST', resource: 'IMAGE' }],
    });
    const staged = await stagedRes.json();
    const target = staged?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) return null;

    const form = new FormData();
    for (const param of target.parameters) form.append(param.name, param.value);
    form.append('file', new Blob([buffer], { type: mimeType }), filename);

    const uploadRes = await fetch(target.url, {
      method: 'POST',
      body: form,
      dispatcher: outboundAgent,
      signal: AbortSignal.timeout(config.shopify.timeoutMs),
    });
    if (!uploadRes.ok) return null;

    const createRes = await shopifyGraphQL(FILE_CREATE, {
      files: [{ originalSource: target.resourceUrl, contentType: 'IMAGE' }],
    });
    const created = await createRes.json();
    return created?.data?.fileCreate?.files?.[0]?.id || null;
  } catch (err) {
    logger.error('[shopify] Image upload failed, continuing without image:', err?.message || String(err));
    return null;
  }
}
