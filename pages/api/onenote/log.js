// pages/api/onenote/log.js
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

/**
 * Tiny HTML escaper
 */
function htmlEscape(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Daily page title in UTC (to keep one page per day)
 */
function todayTitle() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `Daily Log — ${yyyy}-${mm}-${dd}`;
}

/**
 * Get the MS Graph access token from KV (key: "msauth:default")
 * Shape expected:
 *   {
 *     "access": "<access_token string>",
 *     "refresh": "<refresh_token string>",
 *     "id": "<id_token string>"
 *   }
 */
async function getAccessTokenFromKV() {
  const raw = await kvGet("msauth:default");
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed?.access || null;
  } catch {
    return null;
  }
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
      JSON.stringify({
        status: res.status,
        body: j,
        stage: "createDailyPage",
      })
    );
  }
  return j; // includes id, links, etc.
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  // OneNote requires a multipart/related PATCH with a part named "commands".
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
    throw new Error(
      JSON.stringify({
        status: res.status,
        body: text || "(no body)",
        stage: "appendToPage",
      })
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    // 1) Get access token straight from KV
    const accessToken = await getAccessTokenFromKV();
    if (!accessToken) {
      return res.status(401).json({
        ok: false,
        error:
          "No access token in KV. Visit /api/auth/refresh (while signed in) then /api/cron/bind, and try again.",
      });
    }

    // 2) Resolve Inbox section
    const sectionId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // your Inbox fallback

    // 3) Keep/reuse today's page id via KV
    const title = todayTitle();
    const kvKey = `daily:page:${title}`;
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

    // 4) Append the new line
    const safe = htmlEscape(String(text));
    const fragment = `<p>${safe}</p>`;
    await appendToPage(accessToken, pageId, fragment);

    return res.status(200).json({ ok: true, pageId, title });
  } catch (err) {
    let detail = String(err);
    try {
      detail = JSON.parse(err?.message || "{}");
    } catch {}
    return res.status(400).json({
      ok: false,
      error: "Append failed",
      detail,
    });
  }
}
