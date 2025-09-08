// pages/api/onenote/quick-log.js
// Accepts GET ?text=... or POST {text}. Creates/reuses today's page and appends a line.
// Uses whatever access token is in KV (opaque or JWT). Retries once on 401.

import { requireAuth } from "@/lib/auth";
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

function htmlEscape(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function todayTitle() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `Daily Log — ${yyyy}-${mm}-${dd}`;
}

async function refreshServerSide(req) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    `https://${req.headers.host}`;
  await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: { Cookie: req.headers.cookie || "" },
  }).catch(() => {});
}
async function getAccessFromKV() {
  const pack = await kvGet("msauth:default");
  return pack?.access || null;
}
async function ensureAccessToken(req) {
  let access = await getAccessFromKV();
  if (!access) {
    await refreshServerSide(req);
    access = await getAccessFromKV();
  }
  return access;
}

async function createDailyPage(accessToken, sectionId, initialHtml) {
  const html =
    initialHtml ||
    `<html><head><title>${todayTitle()}</title></head><body>
      <h1>${todayTitle()}</h1><hr/>
    </body></html>`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
      sectionId
    )}/pages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/html",
      },
      body: html,
    }
  );
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, body: j, stage: "createDailyPage" }));
  }
  return j; // has id
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  // IMPORTANT: OneNote expects application/json with an ARRAY of commands
  const commands = [
    { target: "body", action: "append", position: "after", content: htmlFragment },
  ];

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(JSON.stringify({
      status: res.status,
      body: text || "(no body)",
      stage: "appendToPage"
    }));
  }
}

export default requireAuth(async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  // Accept GET ?text=... or POST {text}
  let text;
  if (req.method === "POST") text = req.body?.text;
  else if (req.method === "GET") text = req.query?.text;
  else return res.status(405).json({ ok: false, error: "Method not allowed" });

  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: "Missing text" });
  }

  const sectionId =
    process.env.ONE_NOTE_INBOX_SECTION_ID ||
    ONE_NOTE_INBOX_SECTION_ID ||
    "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // fallback

  const title = todayTitle();
  const kvKey = `daily:page:${title}`;

  async function doOnce() {
    const accessToken = await ensureAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        error: "InvalidAuthenticationToken",
        message: "no access token in KV after refresh",
      });
    }

    // Reuse/create today's page
    let pageId = await kvGet(kvKey);
    if (!pageId) {
      const created = await createDailyPage(
        accessToken,
        sectionId,
        `<html><head><title>${title}</title></head><body><h1>${title}</h1><hr/></body></html>`
      );
      pageId = created?.id;
      if (!pageId) throw new Error("Create page returned no id");
      await kvSet(kvKey, pageId);
    }

    // Append
    const safe = htmlEscape(String(text));
    await appendToPage(accessToken, pageId, `<p>${safe}</p>`);
    return res.status(200).json({ ok: true, pageId, title });
  }

  try {
    await doOnce();
  } catch (err) {
    // If 401 from Graph, force refresh + retry once
    try {
      const parsed = typeof err?.message === "string" ? JSON.parse(err.message) : null;
      if (parsed?.status === 401) {
        await refreshServerSide(req);
        await doOnce();
        return;
      }
    } catch {}
    return res.status(400).json({
      ok: false,
      error: "Append failed",
      detail:
        typeof err?.message === "string"
          ? (() => { try { return JSON.parse(err.message); } catch { return err.message; } })()
          : String(err),
    });
  }
});
