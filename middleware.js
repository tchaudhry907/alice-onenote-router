// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/debug")) {
    const allow = process.env.ALLOW_DEBUG;
    if (!allow || allow === "0" || allow.toLowerCase() === "false") {
      return new NextResponse("Diagnostics disabled. Set ALLOW_DEBUG=1 and redeploy.", { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/debug/:path*"]
};
