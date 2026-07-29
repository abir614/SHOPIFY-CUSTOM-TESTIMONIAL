import { SignJWT, jwtVerify } from "jose";
const ALG = "HS256";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
function getSigningKey(env) {
  const secret = env?.JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return new TextEncoder().encode(secret);
}
export async function issueToken(envOrUser, maybeUser) {
  const env = maybeUser !== undefined ? envOrUser : null;
  const user = maybeUser !== undefined ? maybeUser : envOrUser;
  const key = getSigningKey(env);
  return new SignJWT({ username: user.username, email: user.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(String(user._id))
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
}
export async function verifyToken(envOrToken, maybeToken) {
  const env = maybeToken !== undefined ? envOrToken : null;
  const token = maybeToken !== undefined ? maybeToken : envOrToken;
  try {
    const key = getSigningKey(env);
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
