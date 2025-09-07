// middleware.js — TEMP pass-through to unblock 500s
import { NextResponse } from "next/server";

export function middleware() {
  // Always allow while we verify routes. No redirects here.
  return NextResponse.next();
}

// Run on all paths (safe, because we just pass-through)
export const config = {
  matcher: ["/:path*"],
};
