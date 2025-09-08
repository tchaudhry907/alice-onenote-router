// pages/api/onenote/page-text.js
import { get as kvGet } from "@/lib/kv";

/**
 * Get a bearer token to call Graph:
 * 1) Prefer KV stash set by /api/auth/refresh: key=msauth:default
 * 2) Fall back to cookies (rarely needed if you're using cookies.txt + refresh)
 */
async function getBearerFromKVorCookies(req) {
  // Try KV first
  try {
    const kv = await kvGet("msauth:default");
    if (kv && kv.access && typeof kv.access === "string") {
      return kv.access;
    }
  } catch (_) {
    // ignore
  }

  // Very light fallback: look for access_token cookie (if your stack ever sets it)
  const cookie = req.headers?.cookie || "";
  const match = cookie.match(/access_token=([^;]+)/);
  if (match) {
    // URL-decoding in case it was encoded
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return null;
}

function stripHtmlToText(html = "") {
  // Remove script/style
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
             .replace(/<style[\s\S]*?<\/style>/gi, "");
  // Replace <br> and block tags with newlines for readability
  html = html.replace(/<(?:br|BR)\s*\/?>/g, "\n");
  html = html.replace(/<\/(p|div|h[1-6]|li|ul|ol|table|tr|th|td)>/gi, "\n");
  // Strip the rest of tags
  html = html.replace(/<[^>]+>/g, "");
  // Collapse multiple newlines/spaces
  html = html.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return html;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { id } = req.query || {};
  if (!id || typeof id !== "string") {
    return res.status(400).json({ ok: false, error: "Missing ?id" });
  }

  try {
    const accessToken = await getBearerFromKVorCookies(req);
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no access token in KV or cookies)" });
    }

    // 1) Get HTML content from Graph (users/{userPrincipalName}/onenote/pages/{id}/content)
    // We target your MSA user principal you’ve been using everywhere.
    const base = "https://graph.microsoft.com/v1.0/users/tchaudhry907@gmail.com/onenote/pages";
    const url = `${base}/${encodeURIComponent(id)}/content`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "text/html",
      },
    });

    const body = await resp.text();
    if (!resp.ok) {
      // Graph sometimes returns HTML error pages (ASP.NET yellow screen) — surface them as JSON
      return res.status(resp.status).json({
        ok: false,
        error: body,
      });
    }

    // 2) Convert HTML -> plain text
    const text = stripHtmlToText(body);

    return res.status(200).json({
      ok: true,
      id,
      length: text.length,
      text,
    });
  } catch (err) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
