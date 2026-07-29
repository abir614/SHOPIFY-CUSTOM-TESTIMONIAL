import { jsonResponse, checkOrigin, handlePreflight } from "./security.js";
import { requireAuth } from "./auth.js";
import { handleRegister } from "./routes/register.js";
import { handleLogin } from "./routes/login.js";
import { handleListApps, handleCreateApp, handleGetApp, handleUpdateApp, handleDeleteApp } from "./routes/apps.js";
import { handleListSubmissions, handleGetSubmission } from "./routes/submissions.js";
import { handleSubmit, findApp } from "./routes/submit.js";
import { handleListApiKeys, handleCreateApiKey, handleDeleteApiKey } from "./routes/apikeys.js";
import { handleApiGateway } from "./routes/apigateway.js";
import { renderUI } from "./ui/html.js";

const DASHBOARD_PREFIXES = [
  "/api/register",
  "/api/login",
  "/api/me",
  "/api/apps",
  "/api/apikeys",
];

function isDashboardPath(path) {
  return path === "/api" ||
    DASHBOARD_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

async function handleDashboardApi(request, path, dashboardHeaders) {
  const method = request.method;

  if (path === "/api/register" && method === "POST") return handleRegister(request, dashboardHeaders);
  if (path === "/api/login" && method === "POST") return handleLogin(request, dashboardHeaders);

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

  // API key management endpoints
  if (path === "/api/apikeys" && method === "GET") return handleListApiKeys(request, auth, dashboardHeaders);
  if (path === "/api/apikeys" && method === "POST") return handleCreateApiKey(request, auth, dashboardHeaders);

  const apikeyMatch = path.match(/^\/api\/apikeys\/([^/]+)$/);
  if (apikeyMatch && method === "DELETE") return handleDeleteApiKey(request, auth, apikeyMatch[1], dashboardHeaders);

  return jsonResponse({ error: "Not found" }, 404, dashboardHeaders);
}

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

    const UI_ROUTES = new Set([
      "/", "/login", "/register", "/dashboard", "/apps", "/submissions",
      "/guide", "/docs", "/settings", "/logout", "/home"
    ]);
    if (
      request.method === "GET" &&
      (UI_ROUTES.has(path) ||
        path.startsWith("/dashboard/") ||
        path.startsWith("/submissions/") ||
        path.startsWith("/guide/")) &&
      !path.startsWith("/api/")
    ) {
      return renderUI(request);
    }

    if (path === "/api" || path.startsWith("/api/")) {
      // ── API Key Gateway: /api/fhk_xxx/... ─────────────────────────────
      const gatewayMatch = path.match(/^\/api\/(fhk_[0-9a-f]{64})(\/.*)?$/i);
      if (gatewayMatch) {
        const rawKey = gatewayMatch[1];
        const subPath = gatewayMatch[2] || "";
        return await handleApiGateway(request, rawKey, subPath);
      }

      if (isDashboardPath(path)) {
        const dashboardOrigins = process.env.DASHBOARD_ALLOWED_ORIGINS || "*";
        if (request.method === "OPTIONS") {
          return handlePreflight(request, dashboardOrigins, "GET, POST, PUT, DELETE, OPTIONS");
        }
        const originCheck = checkOrigin(request, dashboardOrigins);
        if (!originCheck.allowed) return jsonResponse({ error: "Forbidden" }, 403, originCheck.headers);
        return await handleDashboardApi(request, path, originCheck.headers);
      }

      const formSegments = path.slice(4).split("/").filter(Boolean);
      if (formSegments.length === 2) {
        const [username, appName] = formSegments;
      if (request.method === "OPTIONS") {
          const app = await findApp(username, appName);
          const allowed = app ? app.settings.allowedOrigins : [];
          return handlePreflight(request, allowed, "POST, OPTIONS");
        }
        if (request.method === "POST") return await handleSubmit(request, username, appName, {});
        return jsonResponse(
          { error: "Method not allowed. Form endpoints only accept POST requests." },
          405,
          { Allow: "POST, OPTIONS" }
        );
      }

      // /api/* paths never render UI — always return JSON
      return jsonResponse({ error: "Not found." }, 404);
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
