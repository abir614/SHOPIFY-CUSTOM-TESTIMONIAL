import { jsonResponse, SECURITY_HEADERS } from "../security.js";
import { findApp } from "./submit.js";
import { getFile } from "../storage.js";

const FILE_NAME_RE = /^[a-zA-Z0-9_.-]{1,200}$/;

/** GET /:username/:appname/files/:filename — streams an uploaded image from storage. */
export async function handleGetFile(request, username, appName, filename, corsHeaders) {
  if (!FILE_NAME_RE.test(filename)) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  const app = await findApp(username, appName);
  if (!app) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  const key = `submissions/${app._id}/${filename}`;
  const result = await getFile(key);
  if (!result) return jsonResponse({ error: "Not found" }, 404, corsHeaders);

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...SECURITY_HEADERS,
      ...corsHeaders,
    },
  });
}
