// lib/msgraph.js
// Minimal MS Graph helper that uses your server-stored access token in KV.

import { kv } from "@/lib/kv";

async function getAccessToken() {
  // Try the keys we used earlier
  const keys = ["ms:access_token", "graph:access_token", "access_token"];
  for (const k of keys) {
    const v = await kv.get(k);
    if (v && typeof v === "string") return v;
    if (v && v.access_token) return v.access_token;
  }
  throw new Error("No Graph access token found in KV");
}

export async function graphFetch(url, opts = {}) {
  const token = await getAccessToken();

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Graph ${res.status} ${res.statusText}: ${text?.slice(0, 500)}`
    );
  }
  return res;
}

// Creates a OneNote page by sectionId (fast path, no list calls)
export async function createOneNotePageBySectionId(sectionId, html) {
  // OneNote create page: POST to /onenote/sections/{id}/pages with multipart/related
  const boundary = "----alice-one-boundary-" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="Presentation"\r\n` +
    `Content-Type: text/html\r\n\r\n` +
    `${html}\r\n` +
    `--${boundary}--`;

  const res = await graphFetch(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  );
  return res.json();
}
