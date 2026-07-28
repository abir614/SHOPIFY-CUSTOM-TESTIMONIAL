export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const DEFAULT_MAX_FIELD_LENGTH = 1000;
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_FORM_FIELDS = 40;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
export const USERNAME_RE = /^[a-z0-9]{4,10}$/;

export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const FIELD_TYPES = ["text", "textarea", "email", "select", "checkbox", "date", "number", "tel", "url", "radio", "file"];

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

export function sniffMimeType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return "image/png";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
      && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "application/zip";
  if (bytes.length >= 12) {
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === "ftyp") return "video/mp4";
    if (box === "wide" || box === "mdat") return "video/quicktime";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return "video/webm";
  return null;
}

export function stripJpegExif(bytes) {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return bytes;
  const out = new Uint8Array(bytes.length);
  out[0] = bytes[0]; out[1] = bytes[1];
  let w = 2, n = 2;
  while (n + 1 < bytes.length && bytes[n] === 255) {
    const marker = bytes[n + 1];
    if (marker === 217 || marker === 1 || (marker >= 208 && marker <= 215)) {
      out[w++] = bytes[n]; out[w++] = bytes[n + 1]; n += 2; continue;
    }
    if (n + 3 >= bytes.length) break;
    const segLen = (bytes[n + 2] << 8) | bytes[n + 3];
    const segEnd = n + 2 + segLen;
    if (segLen < 2 || segEnd > bytes.length) break;
    const isExif = marker === 225 && segLen >= 8 &&
      bytes[n + 4] === 69 && bytes[n + 5] === 120 && bytes[n + 6] === 105 && bytes[n + 7] === 102;
    if (!isExif) { out.set(bytes.subarray(n, segEnd), w); w += segEnd - n; }
    n = segEnd;
    if (marker === 218) { out.set(bytes.subarray(n), w); w += bytes.length - n; return out.subarray(0, w); }
  }
  out.set(bytes.subarray(n), w); w += bytes.length - n;
  return out.subarray(0, w);
}

export function validateFieldValue(fieldSchema, rawValue) {
  const maxLength = fieldSchema.maxLength || DEFAULT_MAX_FIELD_LENGTH;
  const isEmpty = typeof rawValue !== "string" || rawValue.trim() === "";

  if (fieldSchema.required && isEmpty) {
    return { ok: false, message: `${fieldSchema.label || fieldSchema.key} is required.` };
  }
  if (isEmpty) return { ok: true, value: "" };

  const sanitized = sanitizeText(rawValue);
  const value = sanitized.slice(0, maxLength);

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

export function validateSubmission(fields, formData) {
  const data = {};
  const errors = [];
  for (const field of fields) {
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

export const sniffImageMime = sniffMimeType;
