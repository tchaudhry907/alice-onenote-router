// pages/api/onenote/quick-log.js
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
    throw new Error(JSON.stringify({ status: res.status, body: j }));
  }
  return j; // includes id, links, etc.
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

export default requireAuth(async function handler(req, res, session) {
  // Handle preflight and accidental GETs
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  // Accept both POST (JSON body) and GET (?text=...)
  let text;
  if (req.method === "POST") {
    text = req.body?.text;
  } else if (req.method === "GET") {
    text = req.query?.text;
  } else {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: "Missing text" });
    }

    const accessToken = await getAccessToken(session);

    const sectionId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      ONE_NOTE_INBOX_SECTION_ID ||
      "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585"; // fallback

    const title = todayTitle();
    const kvKey = `daily:page:${title}`;

    // Reuse today's page if we already created it
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

    // Append the entry
    const safe = htmlEscape(String(text));
    const fragment = `<p>${safe}</p>`;
    await appendToPage(accessToken, pageId, fragment);

    return res.status(200).json({ ok: true, pageId, title });
  } catch (err) {
    let detail;
    try {
      detail = JSON.parse(err?.message || "{}");
    } catch {
      detail = String(err);
    }
    return res.status(400).json({ ok: false, error: "Append failed", detail });
  }
});
