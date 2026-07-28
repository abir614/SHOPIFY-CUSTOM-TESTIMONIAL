/**
 * storage.js — File storage abstraction
 *
 * Supports two backends, selected via FILE_STORAGE env var:
 *   - "local"  (default) — stores files in UPLOAD_DIR (./uploads by default)
 *   - "s3"               — stores files in an S3-compatible bucket
 *
 * Both backends expose the same interface:
 *   putFile(key, bytes, mimeType) → Promise<void>
 *   getFile(key)                  → Promise<{ body: Uint8Array, contentType: string } | null>
 */

import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------------------
// Local disk backend
// ---------------------------------------------------------------------------

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

async function localPut(key, bytes, _mimeType) {
  const fullPath = join(UPLOAD_DIR, key);
  const dir = dirname(fullPath);
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, bytes);
}

async function localGet(key) {
  const fullPath = join(UPLOAD_DIR, key);
  if (!existsSync(fullPath)) return null;
  try {
    const body = await readFile(fullPath);
    // Determine content type from extension (basic mapping)
    const ext = key.split(".").pop()?.toLowerCase();
    const contentType = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    }[ext] ?? "application/octet-stream";
    return { body, contentType };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// S3-compatible backend
// ---------------------------------------------------------------------------

let _s3Client = null;
let _S3Commands = null;

async function getS3() {
  if (_s3Client) return { client: _s3Client, ..._S3Commands };

  const { S3Client, PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");

  const cfg = {
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  };
  if (process.env.S3_ENDPOINT) cfg.endpoint = process.env.S3_ENDPOINT;

  _s3Client = new S3Client(cfg);
  _S3Commands = { PutObjectCommand, GetObjectCommand };
  return { client: _s3Client, PutObjectCommand, GetObjectCommand };
}

const S3_BUCKET = process.env.S3_BUCKET || "";

async function s3Put(key, bytes, mimeType) {
  const { client, PutObjectCommand } = await getS3();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: mimeType,
    })
  );
}

async function s3Get(key) {
  try {
    const { client, GetObjectCommand } = await getS3();
    const resp = await client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    // resp.Body is a ReadableStream in the AWS SDK v3 — convert to Buffer
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    return { body, contentType: resp.ContentType || "application/octet-stream" };
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Unified API
// ---------------------------------------------------------------------------

const backend = (process.env.FILE_STORAGE || "local").toLowerCase();

/**
 * Store a file. `key` is the storage path (e.g. "submissions/<appId>/<uuid>.jpg").
 */
export async function putFile(key, bytes, mimeType) {
  if (backend === "s3") return s3Put(key, bytes, mimeType);
  return localPut(key, bytes, mimeType);
}

/**
 * Retrieve a file by key.
 * Returns `{ body: Buffer, contentType: string }` or `null` if not found.
 */
export async function getFile(key) {
  if (backend === "s3") return s3Get(key);
  return localGet(key);
}

export const storageBackend = backend;
