import { serialize, parse } from "cookie";

const TOKEN_COOKIE = "alice_tokens";

// Save tokens in an HTTP-only cookie
export function setTokenCookie(res, tokens) {
  const cookie = serialize(TOKEN_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  res.setHeader("Set-Cookie", cookie);
}

// Read tokens from cookie
export function getTokenCookie(req) {
  const cookies = parse(req.headers.cookie || "");
  if (!cookies[TOKEN_COOKIE]) return null;
  try {
    return JSON.parse(cookies[TOKEN_COOKIE]);
  } catch {
    return null;
  }
}

// Clear tokens
export function clearTokenCookie(res) {
  const cookie = serialize(TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: -1
  });
  res.setHeader("Set-Cookie", cookie);
}
