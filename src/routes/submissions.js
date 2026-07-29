import { ObjectId } from "mongodb";
import { jsonResponse } from "../security.js";
import { getCollections } from "../db.js";
const MAX_PAGE_SIZE = 100;
export async function handleListSubmissions(request, auth, appName, corsHeaders) {
  const { apps, submissions } = getCollections();
  const app = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName });
  if (!app) return jsonResponse({ error: "App not found." }, 404, corsHeaders);
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, MAX_PAGE_SIZE);
  const before = url.searchParams.get("before");
  const query = { appId: app._id };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }
  const results = await submissions.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  return jsonResponse(
    {
      ok: true,
      submissions: results.map((s) => ({
        id: String(s._id),
        data: s.data,
        files: s.files,
        shopifyStatus: s.shopifyStatus,
        createdAt: s.createdAt,
      })),
      nextBefore: results.length === limit ? results[results.length - 1].createdAt : null,
    },
    200,
    corsHeaders
  );
}
export async function handleGetSubmission(request, auth, appName, submissionId, corsHeaders) {
  const { apps, submissions } = getCollections();
  const app = await apps.findOne({ ownerId: new ObjectId(auth.userId), appName });
  if (!app) return jsonResponse({ error: "App not found." }, 404, corsHeaders);
  let objectId;
  try {
    objectId = new ObjectId(submissionId);
  } catch {
    return jsonResponse({ error: "Invalid submission id." }, 400, corsHeaders);
  }
  const submission = await submissions.findOne({ _id: objectId, appId: app._id });
  if (!submission) return jsonResponse({ error: "Submission not found." }, 404, corsHeaders);
  return jsonResponse(
    {
      ok: true,
      submission: {
        id: String(submission._id),
        data: submission.data,
        files: submission.files,
        shopifyStatus: submission.shopifyStatus,
        shopifyHandle: submission.shopifyHandle,
        shopifyErrors: submission.shopifyErrors,
        ip: submission.ip,
        createdAt: submission.createdAt,
      },
    },
    200,
    corsHeaders
  );
}
