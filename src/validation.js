export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_MAX_FIELD_LENGTH = 1000;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const DEFAULT_MAX_FORM_FIELDS = 40;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])?$/;

export const FIELD_TYPES = ["text", "textarea", "email", "select", "checkbox", "file", "date", "number", "tel", "url", "radio"];

export const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export class BodyTooLargeError extends Error {}

export function errMessage(e) {
  return e instanceof Error ? e.message : String(e);
}

/** Read a request body while enforcing a byte-length ceiling. */
export async function readBodyWithLimit(request, maxBytes) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError("Request body exceeded the size limit.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Sniff an image's MIME type from its magic bytes (never trust the client). */
export function sniffImageMime(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  )
    return "image/png";
  if (
    bytes.length >= 6 &&
    bytes[0] === 71 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 56 &&
    (bytes[4] === 55 || bytes[4] === 57) &&
    bytes[5] === 97
  )
    return "image/gif";
  if (
    bytes.length >= 12 &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return "image/webp";
  return null;
}

/** Strip EXIF (APP1) segments from a JPEG so uploaded photos don't leak GPS/metadata. */
export function stripJpegExif(bytes) {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return bytes;
  const out = new Uint8Array(bytes.length);
  out[0] = bytes[0];
  out[1] = bytes[1];
  let w = 2;
  let n = 2;
  while (n + 1 < bytes.length && bytes[n] === 255) {
    const marker = bytes[n + 1];
    if (marker === 217 || marker === 1 || (marker >= 208 && marker <= 215)) {
      out[w++] = bytes[n];
      out[w++] = bytes[n + 1];
      n += 2;
      continue;
    }
    if (n + 3 >= bytes.length) break;
    const segLen = (bytes[n + 2] << 8) | bytes[n + 3];
    const segEnd = n + 2 + segLen;
    if (segLen < 2 || segEnd > bytes.length) break;
    const isExif = marker === 225 && segLen >= 8 && bytes[n + 4] === 69 && bytes[n + 5] === 120 && bytes[n + 6] === 105 && bytes[n + 7] === 102;
    if (!isExif) {
      out.set(bytes.subarray(n, segEnd), w);
      w += segEnd - n;
    }
    n = segEnd;
    if (marker === 218) {
      out.set(bytes.subarray(n), w);
      w += bytes.length - n;
      return out.subarray(0, w);
    }
  }
  out.set(bytes.subarray(n), w);
  w += bytes.length - n;
  return out.subarray(0, w);
}

/**
 * Validate + normalize one field's raw form value against its schema entry.
 * Returns { ok: true, value } or { ok: false, message }.
 */
export function validateFieldValue(fieldSchema, rawValue) {
  const maxLength = fieldSchema.maxLength || DEFAULT_MAX_FIELD_LENGTH;
  const isEmpty = typeof rawValue !== "string" || rawValue.trim() === "";

  if (fieldSchema.required && isEmpty) {
    return { ok: false, message: `${fieldSchema.label || fieldSchema.key} is required.` };
  }
  if (isEmpty) return { ok: true, value: "" };

  const value = rawValue.slice(0, maxLength);

  if (fieldSchema.pattern && value) {
    try {
      const regex = new RegExp(fieldSchema.pattern);
      if (!regex.test(value)) {
        return { ok: false, message: fieldSchema.patternError || `${fieldSchema.label || fieldSchema.key} does not match required format.` };
      }
    } catch (_) {}
  }

  if (fieldSchema.type === "email" && !EMAIL_REGEX.test(value)) {
    return { ok: false, message: `${fieldSchema.label || fieldSchema.key} must be a valid email address.` };
  }

  if (fieldSchema.type === "url" && !/^https?:\/\/.+/i.test(value)) {
    return { ok: false, message: `${fieldSchema.label || fieldSchema.key} must be a valid URL starting with http:// or https://.` };
  }

  if (fieldSchema.type === "number") {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return { ok: false, message: `${fieldSchema.label || fieldSchema.key} must be a valid number.` };
    }
    if (Number.isFinite(fieldSchema.min) && num < fieldSchema.min) {
      return { ok: false, message: `${fieldSchema.label || fieldSchema.key} cannot be less than ${fieldSchema.min}.` };
    }
    if (Number.isFinite(fieldSchema.max) && num > fieldSchema.max) {
      return { ok: false, message: `${fieldSchema.label || fieldSchema.key} cannot be greater than ${fieldSchema.max}.` };
    }
    return { ok: true, value };
  }

  if ((fieldSchema.type === "select" || fieldSchema.type === "radio") && Array.isArray(fieldSchema.options) && fieldSchema.options.length > 0) {
    if (fieldSchema.options.includes(value)) return { ok: true, value };
    if (fieldSchema.allowOther && fieldSchema.options.includes("Other")) return { ok: true, value: "Other" };
    return { ok: false, message: `${fieldSchema.label || fieldSchema.key} must be one of the allowed options.` };
  }

  if (fieldSchema.type === "checkbox") {
    return { ok: true, value: value === "true" || value === "on" || value === "1" ? "true" : "false" };
  }

  return { ok: true, value };
}

/**
 * Validate a whole submitted form (a FormData object) against an app's field
 * schema. Returns { ok: true, data } or { ok: false, errors }.
 */
export function validateSubmission(fields, formData) {
  const data = {};
  const errors = [];
  for (const field of fields) {
    if (field.type === "file") continue; // handled separately
    const raw = formData.get(field.key);
    const result = validateFieldValue(field, typeof raw === "string" ? raw : "");
    if (!result.ok) {
      errors.push({ field: field.key, message: result.message });
      continue;
    }
    if (result.value !== "") data[field.key] = result.value;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data };
}
