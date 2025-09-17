// pages/api/hooks/ingest.js
//
// Secure webhook I (the assistant) can call with X-Api-Key.
// Your server looks up your stored refresh_token by that key,
// silently refreshes an access_token, then creates the OneNote page.
//
// POST /api/hooks/ingest
// Headers: X-Api-Key: <your personal key>
// Body: {
//   "action": "create",
//   "notebookName": "AliceChatGPT",
//   "sectionName": "Food",
//   "title": "[FOOD] Pumpkin pie — 300 kcal",
//   "html": "<p>whatever</p>"
// }

import { kvGet } from "@/lib/kv";

const API_KEYS_NAMESPACE = "alice:apikey:";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  try {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(401).json({ ok: false, error: "Missing X-Api-Key" });
    }

    // Load the record we stored when you “paired” on Diagnostics
    const record = await kvGet(API_KEYS_NAMESPACE + apiKey);
    if (!record || !record.refresh_token) {
      return res.status(401).json({ ok: false, error: "Invalid or expired API key" });
    }

    // 1) Use your stored refresh_token to mint a fresh access_token
    const { access_token } = await refreshAccessTokenWithRefreshToken(record.refresh_token, record.client);
    if (!access_token) throw new Error("Could not refresh access token");

    // 2) Perform the requested action (right now: create page)
    const { action, notebookName, sectionName, title, html } = req.body || {};
    if (action !== "create") return res.status(400).json({ ok: false, error: "Unsupported action" });
    if (!notebookName || !sectionName || !title || !html) {
      return res.status(400).json({ ok: false, error: "Missing notebookName/sectionName/title/html" });
    }

    // Resolve notebook id
    const nb = await graph(`https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName`, access_token);
    const notebook = (nb.value || []).find(n => (n.displayName || "").trim().toLowerCase() === String(notebookName).toLowerCase());
    if (!notebook) return res.status(404).json({ ok: false, error: `Notebook not found: ${notebookName}` });

    // Resolve section id
    const sec = await graph(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, access_token);
    const section = (sec.value || []).find(s => (s.displayName || "").trim().toLowerCase() === String(sectionName).toLowerCase());
    if (!section) return res.status(404).json({ ok: false, error: `Section not found: ${sectionName}` });

    // Build proper OneNote multipart
    const boundary = "----AliceIngest" + Math.random().toString(36).slice(2);
    const htmlDoc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${html}</body></html>`;
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlDoc + `\r\n` +
      `--${boundary}--\r\n`;

    const createRes = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return res.status(createRes.status).json({ ok: false, error: `graph POST create page -> ${createRes.status}`, details: created });
    }

    return res.status(200).json({ ok: true, created, version: "hook-v1" });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

async function graph(url, access_token) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`graph GET ${url} -> ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

// Uses your existing Microsoft app credentials from env (same ones you’ve already configured)
async function refreshAccessTokenWithRefreshToken(refresh_token, client) {
  const {
    MS_CLIENT_ID,
    MS_TENANT_ID = "consumers",
    MS_REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient",
    MS_CLIENT_SECRET = "",
  } = process.env;

  // Public client flow (no secret) or confidential (with secret) – support both
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID || client?.id || "",
    scope: "offline_access Notes.ReadWrite.All User.Read",
    refresh_token,
    grant_type: "refresh_token",
    redirect_uri: MS_REDIRECT_URI,
  });
  if (MS_CLIENT_SECRET) params.set("client_secret", MS_CLIENT_SECRET);

  const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const tok = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`token refresh -> ${tokenRes.status}: ${JSON.stringify(tok)}`);
  return tok; // contains access_token, refresh_token (rotated), etc.
}
