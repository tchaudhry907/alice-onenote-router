import { NextResponse } from "next/server";

export function middleware(req) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/debug/diagnostics")) {
    const allow = process.env.ALLOW_DEBUG === "1";
    if (!allow) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }
  // add a tiny signal header for the page gate
  const res = NextResponse.next();
  if (process.env.ALLOW_DEBUG === "1") res.headers.set("x-allow-debug", "1");
  return res;
}
