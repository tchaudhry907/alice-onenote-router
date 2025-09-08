// pages/api/onenote/quick-log.js
//
// Session-based quick logger that supports:
// - POST JSON:  { "text": "hello" }
// - GET:        ?text=hello
//
// It never reads tokens from KV. It uses the signed session,
// and if it detects a malformed access token (no '.'), it will
// call /api/auth/refresh on the server (forwarding cookies) and
// retry once.

import { requireAuth, getAccessToken } from "@/lib/auth";
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

function htmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function todayTitle() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `Daily Log — ${yyyy}-${mm}-${dd}`;
}

async function createDailyPage(accessToken, sectionId, initialHtml) {
  const html =
    initialHtml ||
    `<html><head><title>${todayTitle()}</title></head><body>
      <h1>${todayTitle()}</h1>
      <hr/>
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
    throw new Error(
      JSON.stringify({ status: res.status, body: j, stage: "createDailyPage" })
    );
  }
  return j; // includes id
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  const boundary = "batch_" + Date.now();
  const commands = [
    { target: "body", action: "append", position: "after", content: htmlFragment },
  ];

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Disposition: form-data; name="commands"\r\n\r\n` +
    JSON.stringify(commands) +
    `\r\n--${boundary}--`;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
      pageId
    )}/content`,
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
    throw new Error(
      JSON.stringify({
        status: res.status,
        body: text || "(no body)",
        stage: "appendToPage",
      })
    );
  }
}

function looksOpaqueOrBad(token) {
  // Graph access tokens are JWTs (contain two dots). If not, try to refresh.
  return !token || typeof token !== "string" || token.split(".").length < 3;
}

async function refreshServerSide(req) {
  // Call our own refresh endpoint, forwarding incoming cookies.
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    `https://${req.headers.host}`;
  const res = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: req.headers.cookie || "",
    },
  });
  // ignore body; if it failed, the next getAccessToken() will still fail
  return res.ok;
}

export default requireAuth(async function handler(req, res, session) {
  // Accept POST JSON or GET ?text=...
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

  async function doWorkOnce() {
    // get a token from the session
    let accessToken = await getAccessToken(session);

    // if it looks wrong/opaque, try a server-side refresh and re-read
    if (looksOpaqueOrBad(accessToken)) {
      await refreshServerSide(req);
      accessToken = await getAccessToken(session);
    }

    if (looksOpaqueOrBad(accessToken)) {
      // still bad after refresh
      const kvProbe = {}; // helpful for your diagnostics
      return res.status(401).json({
        ok: false,
        error: "InvalidAuthenticationToken",
        message: "access token malformed (no JWT) after server refresh",
        kv: kvProbe,
      });
    }

    // reuse/create today's page
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

    // append the new line
    const safe = htmlEscape(String(text));
    await appendToPage(accessToken, pageId, `<p>${safe}</p>`);
    return res.status(200).json({ ok: true, pageId, title });
  }

  try {
    await doWorkOnce();
  } catch (err) {
    // Graph 401s sometimes come from an expired token; refresh once and retry.
    let retried = false;
    try {
      const parsed =
        typeof err?.message === "string" ? JSON.parse(err.message) : null;
      if (parsed?.status === 401 && !retried) {
        retried = true;
        await refreshServerSide(req);
        await doWorkOnce();
        return; // success after retry
      }
    } catch {
      // ignore parse errors and fall through
    }

    return res.status(400).json({
      ok: false,
      error: "Append failed",
      detail:
        typeof err?.message === "string"
          ? (() => {
              try {
                return JSON.parse(err.message);
              } catch {
                return err.message;
              }
            })()
          : String(err),
    });
  }
});
