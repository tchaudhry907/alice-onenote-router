// pages/api/onenote/quick-log.js
//
// Self-healing logger:
// - Accepts POST (JSON) and GET (?text=...)
// - Handles OPTIONS preflight
// - Pulls access token from KV (msauth:default)
// - If missing/invalid, calls /api/auth/refresh using the caller's cookies
// - Retries once after refresh
//
// Requires:
// - lib/kv exports get/set as kvGet/kvSet
// - lib/constants exports ONE_NOTE_INBOX_SECTION_ID
//
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

function looksLikeJwt(t) {
  // A valid compact JWS has 2 dots
  return typeof t === "string" && t.split(".").length === 3;
}

async function refreshUsingCallerCookies(req) {
  try {
    const base =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      `https://${req.headers.host}`;
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: {
        // forward the user's cookies so /api/auth/refresh can find the refresh_token cookie
        cookie: req.headers.cookie || "",
      },
    });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok && j?.ok, resStatus: res.status, body: j };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function getAccessTokenBound(req, tryRefresh = true) {
  // Primary source of truth: KV key msauth:default
  const bag = await kvGet("msauth:default");
  let access = bag?.access;

  if (!looksLikeJwt(access) && tryRefresh) {
    const r = await refreshUsingCallerCookies(req);
    if (r.ok) {
      const bag2 = await kvGet("msauth:default");
      access = bag2?.access;
    }
  }
  if (!looksLikeJwt(access)) {
    const reason = access ? "malformed" : "missing";
    const debug = await kvGet("msauth:default");
    const masked = debug
      ? {
          ...debug,
          access: debug.access ? `[len:${debug.access.length}]` : null,
          refresh: debug.refresh ? `[len:${debug.refresh.length}]` : null,
          id: debug.id ? `[len:${debug.id.length}]` : null,
        }
      : null;
    const err = new Error(
      JSON.stringify({
        status: 401,
        error: "InvalidAuthenticationToken",
        message: `access token ${reason} (no JWT)`,
        kv: masked,
      })
    );
    err.statusCode = 401;
    throw err;
  }
  return access;
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
    const err = new Error(
      JSON.stringify({ status: res.status, body: j, stage: "createDailyPage" })
    );
    err.statusCode = res.status || 500;
    throw err;
  }
  return j; // includes id, links, etc.
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  // Build a correct multipart/related PATCH with part named "commands"
  const boundary = "batch_" + Date.now();
  const commands = [
    {
      target: "body",
      action: "append",
      position: "after",
      content: htmlFragment,
    },
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
    const err = new Error(
      JSON.stringify({
        status: res.status,
        body: text || "(no body)",
        stage: "appendToPage",
      })
    );
    err.statusCode = res.status || 500;
    throw err;
  }
}

export default async function handler(req, res) {
  // CORS / preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  // Accept POST with JSON body or GET ?text=...
  let text;
  if (req.method === "POST") {
    text = req.body?.text;
  } else if (req.method === "GET") {
    text = req.query?.text;
  } else {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!text || !String(text).trim()) {
    return res.status(400).json({ ok: false, error: "Missing text" });
  }

  try {
    // 1) Get/refresh a valid access token (uses KV + caller cookies)
    const accessToken = await getAccessTokenBound(req);

    // 2) Reuse today's page (cache id in KV)
    const sectionId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585";

    const title = todayTitle();
    const kvKey = `daily:page:${title}`;

    let pageId = await kvGet(kvKey);

    if (!pageId) {
      const created = await createDailyPage(
        accessToken,
        sectionId,
        `<html><head><title>${title}</title></head>
         <body><h1>${title}</h1><hr/></body></html>`
      );
      pageId = created?.id;
      if (!pageId) throw new Error("Create page returned no id");
      await kvSet(kvKey, pageId);
    }

    // 3) Append the entry
    const safe = htmlEscape(String(text));
    const fragment = `<p>${safe}</p>`;
    await appendToPage(accessToken, pageId, fragment);

    return res.status(200).json({ ok: true, pageId, title });
  } catch (err) {
    // If it smells like a token problem, one last automatic refresh+retry
    const parsed =
      typeof err?.message === "string" ? (() => { try { return JSON.parse(err.message); } catch { return null; } })() : null;
    const isAuthError =
      err?.statusCode === 401 ||
      parsed?.status === 401 ||
      /InvalidAuthenticationToken|token|auth/i.test(err?.message || "");

    if (isAuthError) {
      try {
        const r = await refreshUsingCallerCookies(req);
        if (r.ok) {
          // Retry once after refresh
          const accessToken = await getAccessTokenBound(req, /*tryRefresh*/ false);

          const sectionId =
            process.env.ONE_NOTE_INBOX_SECTION_ID ||
            ONE_NOTE_INBOX_SECTION_ID ||
            "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585";

          const title = todayTitle();
          const kvKey = `daily:page:${title}`;
          let pageId = await kvGet(kvKey);
          if (!pageId) {
            const created = await createDailyPage(accessToken, sectionId);
            pageId = created?.id;
            await kvSet(kvKey, pageId);
          }
          const safe = htmlEscape(String(req.method === "POST" ? req.body?.text : req.query?.text));
          await appendToPage(accessToken, pageId, `<p>${safe}</p>`);
          return res.status(200).json({ ok: true, pageId, title });
        }
      } catch (_) {
        // fall through to error response
      }
    }

    // Final error
    return res.status(400).json({
      ok: false,
      error: "Append failed",
      detail:
        typeof err?.message === "string" ? (() => { try { return JSON.parse(err.message); } catch { return err.message; } })() : String(err),
    });
  }
}
