import { jsonResponse, checkOrigin, handlePreflight } from "./security.js";
import { requireAuth } from "./auth.js";
import { handleRegister } from "./routes/register.js";
import { handleLogin } from "./routes/login.js";
import { handleListApps, handleCreateApp, handleGetApp, handleUpdateApp, handleDeleteApp } from "./routes/apps.js";
import { handleListSubmissions, handleGetSubmission } from "./routes/submissions.js";
import { handleGetAppSchema, handleSubmit, findApp } from "./routes/submit.js";
import { handleGetFile } from "./routes/files.js";
import { renderUI } from "./ui/html.js";

async function handleApi(request, path, dashboardHeaders) {
  const method = request.method;

  if (path === "/api/register" && method === "POST") return handleRegister(request, dashboardHeaders);
  if (path === "/api/login" && method === "POST") return handleLogin(request, dashboardHeaders);

  // Everything else under /api requires a valid Bearer token.
  const auth = await requireAuth(request);
  if (auth.error) return jsonResponse({ error: auth.message }, auth.status, dashboardHeaders);

  if (path === "/api/me" && method === "GET") {
    return jsonResponse({ ok: true, user: { username: auth.username, email: auth.email } }, 200, dashboardHeaders);
  }

  if (path === "/api/apps" && method === "GET") return handleListApps(request, auth, dashboardHeaders);
  if (path === "/api/apps" && method === "POST") return handleCreateApp(request, auth, dashboardHeaders);

  const appMatch = path.match(/^\/api\/apps\/([^/]+)$/);
  if (appMatch) {
    const appName = decodeURIComponent(appMatch[1]);
    if (method === "GET") return handleGetApp(request, auth, appName, dashboardHeaders);
    if (method === "PUT") return handleUpdateApp(request, auth, appName, dashboardHeaders);
    if (method === "DELETE") return handleDeleteApp(request, auth, appName, dashboardHeaders);
  }

  const submissionsMatch = path.match(/^\/api\/apps\/([^/]+)\/submissions$/);
  if (submissionsMatch && method === "GET") {
    return handleListSubmissions(request, auth, decodeURIComponent(submissionsMatch[1]), dashboardHeaders);
  }

  const submissionMatch = path.match(/^\/api\/apps\/([^/]+)\/submissions\/([^/]+)$/);
  if (submissionMatch && method === "GET") {
    return handleGetSubmission(request, auth, decodeURIComponent(submissionMatch[1]), decodeURIComponent(submissionMatch[2]), dashboardHeaders);
  }

  return jsonResponse({ error: "Not found" }, 404, dashboardHeaders);
}

/**
 * Core request handler — takes a Web API Request, returns a Web API Response.
 * Called by server.js for every incoming HTTP request.
 */
export async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" && request.method === "GET") {
      return jsonResponse({ ok: true }, 200);
    }
    if (path === "/favicon.ico" || path.startsWith("/.well-known/")) {
      return new Response(null, { status: 204 });
    }

    // --- Web Application UI SPA: /, /login, /register, /dashboard, etc. ---
    const UI_ROUTES = new Set([
      "/", "/login", "/register", "/dashboard", "/apps", "/submissions",
      "/guide", "/docs", "/settings", "/logout", "/home"
    ]);
    if (
      request.method === "GET" &&
      (UI_ROUTES.has(path) ||
        path.startsWith("/dashboard/") ||
        path.startsWith("/apps/") ||
        path.startsWith("/submissions/") ||
        path.startsWith("/guide/")) &&
      !path.startsWith("/api/")
    ) {
      return renderUI(request);
    }

    // --- Dashboard / auth API: /api/... -----------------------------------
    if (path === "/api" || path.startsWith("/api/")) {
      const dashboardOrigins = process.env.DASHBOARD_ALLOWED_ORIGINS || "*";
      if (request.method === "OPTIONS") return handlePreflight(request, dashboardOrigins, "GET, POST, PUT, DELETE, OPTIONS");
      const originCheck = checkOrigin(request, dashboardOrigins);
      if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, originCheck.headers);
      return await handleApi(request, path, originCheck.headers);
    }

    // --- Public form endpoints: /:username/:appname/[...] ----------------
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const [username, appName, ...rest] = segments;

      if (rest.length === 2 && rest[0] === "files") {
        return await handleGetFile(request, username, appName, decodeURIComponent(rest[1]), {});
      }

      if (rest.length === 0) {
        if (request.method === "OPTIONS") {
          const app = await findApp(username, appName);
          const allowed = app ? app.settings.allowedOrigins : [];
          return handlePreflight(request, allowed, "GET, POST, OPTIONS");
        }
        if (request.method === "POST") return await handleSubmit(request, username, appName, {});
        if (request.method === "GET") return await handleGetAppSchema(request, username, appName, {});
      }
    }

    if (request.method === "GET" && request.headers.get("Accept")?.includes("text/html")) {
      return renderUI(request);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    console.error("[unhandled]", err instanceof Error && err.stack ? err.stack : err);
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({
      error: msg || "An unexpected error occurred. Please try again later."
    }, 500);
  }
}
