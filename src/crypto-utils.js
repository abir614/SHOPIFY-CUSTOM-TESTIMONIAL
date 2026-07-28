// All primitives here use the standard Web Crypto API (globalThis.crypto),
// available natively in Node.js 19+ (and via --experimental-global-webcrypto in 18).

const PBKDF2_ITERATIONS = 100_000; // OWASP recommended minimum for PBKDF2-SHA256
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH_BITS = 256;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * Hash a plaintext password. Returns a single string safe to store in Mongo:
 *   pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 */
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(derived))}`;
}

/**
 * Verify a plaintext password against a stored hash string from hashPassword().
 * Also supports legacy hashes using 10_000 iterations.
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: PBKDF2_HASH },
      keyMaterial,
      KEY_LENGTH_BITS
    )
  );
  if (derived.length !== expected.length) return false;
  // Constant-time compare to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set.");
  return fromBase64(key);
}

async function importEncryptionKey() {
  const raw = getEncryptionKey();
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Encrypt a secret (e.g. a Shopify Admin API token or Turnstile secret key)
 * before storing it in MongoDB. Returns "ivBase64:cipherBase64".
 */
export async function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === "") return "";
  const key = await importEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(String(plaintext))
  );
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

/**
 * Decrypt a value produced by encryptSecret(). Returns "" if empty/invalid.
 */
export async function decryptSecret(stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return "";
  const [ivB64, cipherB64] = stored.split(":");
  try {
    const key = await importEncryptionKey();
    const iv = fromBase64(ivB64);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(cipherB64));
    return new TextDecoder().decode(plainBuf);
  } catch {
    return "";
  }
}
