// pages/api/onenote/quick-log.js
//
// Quick logger that works with either GET ?text=... or POST JSON {text}
// It forces a refresh, then reads tokens directly from KV (msauth:default)
// to avoid stale/opaque session values. Retries once if Graph returns 401.

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

function looksJWT(t) {
  return !!t && typeof t === "string" && t.split(".").length >= 3;
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

async function ensureGoodAccessToken(req) {
  // 1) Try KV
  let access = await getAccessFromKV();

  // 2) If not a JWT, force refresh, then re-read
  if (!looksJWT(access)) {
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
  return j; // includes id
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  const boundary = "batch_" + Date.now();
  const commands = [
    { target: "body", action: "append", position: "after", content: htmlFragment },
  ];

  const body =
    `--${boundary}\r\nContent-Type: application/json\r\n` +
    `Content-Disposition: form-data; name="commands"\r\n\r\n` +
    JSON.stringify(commands) + `\r\n--${boundary}--`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(JSON.stringify({ status: res.status, body: text || "(no body)", stage: "appendToPage" }));
  }
}

export default requireAuth(async function handler(req, res /* session unused here intentionally */) {
  let text;
  if (req.method === "POST") {
    text = req.body?.text;
  } else if (req.method === "GET") {
    text = req.query?.text;
  } else if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  } else {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

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
    const accessToken = await ensureGoodAccessToken(req);
    if (!looksJWT(accessToken)) {
      const pack = await kvGet("msauth:default").catch(() => null);
      return res.status(401).json({
        ok: false,
        error: "InvalidAuthenticationToken",
        message: "access token malformed (no JWT) after refresh",
        kv: {
          access: pack?.access ? `[len:${pack.access.length}]` : null,
          refresh: pack?.refresh ? `[len:${pack.refresh.length}]` : null,
          id: pack?.id ? `[len:${pack.id.length}]` : null,
        },
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
    // If Graph said 401, try one forced refresh + retry
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
