import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSigningKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return new TextEncoder().encode(secret);
}

/**
 * Issue a signed JWT for a user. Payload is intentionally minimal —
 * only what's needed to identify the user on subsequent requests.
 */
export async function issueToken(user) {
  const key = getSigningKey();
  return new SignJWT({ username: user.username, email: user.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
}

/**
 * Verify a JWT and return its payload, or null if invalid/expired.
 */
export async function verifyToken(token) {
  try {
    const key = getSigningKey();
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    return payload;
  } catch {
    return null;
  }
}

function extractBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Require a valid Bearer token. Returns { userId, username, email } on
 * success, or an error descriptor on failure.
 */
export async function requireAuth(request) {
  const token = extractBearerToken(request);
  if (!token) {
    return { error: true, status: 401, message: "Missing bearer token." };
  }
  const payload = await verifyToken(token);
  if (!payload || !payload.sub) {
    return { error: true, status: 401, message: "Invalid or expired token." };
  }
  return { error: false, userId: payload.sub, username: payload.username, email: payload.email };
}
