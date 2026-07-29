const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH_BITS = 256;
function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}
function fromBase64(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
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
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}
function getEncryptionKey(env) {
  const key = env?.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is not set.");
  return fromBase64(key);
}
async function importEncryptionKey(env) {
  const raw = getEncryptionKey(env);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptSecret(envOrText, maybeText) {
  const env = maybeText !== undefined ? envOrText : null;
  const plaintext = maybeText !== undefined ? maybeText : envOrText;
  if (plaintext === null || plaintext === undefined || plaintext === "") return "";
  const key = await importEncryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(String(plaintext))
  );
  return `${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}
export async function decryptSecret(envOrText, maybeText) {
  const env = maybeText !== undefined ? envOrText : null;
  const stored = maybeText !== undefined ? maybeText : envOrText;
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return "";
  const [ivB64, cipherB64] = stored.split(":");
  try {
    const key = await importEncryptionKey(env);
    const iv = fromBase64(ivB64);
    const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fromBase64(cipherB64));
    return new TextDecoder().decode(plainBuf);
  } catch {
    return "";
  }
}
