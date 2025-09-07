// pages/api/onenote/log.js
import { getBoundAccessToken } from "@/lib/auth";
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

/** HTML-escape to keep fragments safe */
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

  const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
    sectionId
  )}/pages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/html",
    },
    body: html,
  });

  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify({ status: res.status, body: j }));
  return j; // includes id, title, links...
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  // OneNote requires a multipart PATCH with a part named "commands"
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
    throw new Error(JSON.stringify({ status: res.status, body: text || "(no body)" }));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const accessToken = await getBoundAccessToken(); // <-- no browser session required
    if (!accessToken) {
      return res
        .status(401)
        .json({ ok: false, error: "Not bound. Visit /api/cron/bind once while signed in." });
    }

    const { text, sectionId: sectionIdInBody } = req.body || {};
    const sectionId =
      sectionIdInBody ||
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // your Inbox fallback

    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const title = todayTitle();
    const kvKey = `daily:page:${title}`;

    // reuse today's page if we already created it
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

    const fragment = `<p>${htmlEscape(text)}</p>`;
    await appendToPage(accessToken, pageId, fragment);

    return res.status(200).json({ ok: true, pageId, title });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "Append failed",
      detail: (() => {
        try {
          return JSON.parse(err?.message || "");
        } catch {
          return String(err?.message || err);
        }
      })(),
    });
  }
}
