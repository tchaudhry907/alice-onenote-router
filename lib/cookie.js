// lib/cookie.js
import { serialize, parse } from "cookie";

const COOKIE_NAME = "alice_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function setTokenCookie(res, data) {
  const value = JSON.stringify(data || {});
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: COOKIE_MAX_AGE
  }));
}

export function getTokenCookie(req) {
  const raw = req?.headers?.cookie || "";
  const jar = parse(raw);
  if (!jar[COOKIE_NAME]) return null;
  try { return JSON.parse(jar[COOKIE_NAME]); } catch { return null; }
}

export function clearTokenCookie(res) {
  res.setHeader("Set-Cookie", serialize(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0
  }));
}
