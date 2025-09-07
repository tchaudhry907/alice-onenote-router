// pages/api/onenote/append-last.js
import { getBoundAccessToken } from "@/lib/auth";
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_INBOX_SECTION_ID } from "@/lib/constants";

function htmlEscape(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function fetchLatestPageId(accessToken) {
  // Prefer KV if we saved the last created page id
  const cached = await kvGet("onenote:lastCreatedPageId");
  if (cached) return cached;

  // Otherwise, take the most recently modified page in the Inbox section
  const secId =
    process.env.ONE_NOTE_INBOX_SECTION_ID ||
    ONE_NOTE_INBOX_SECTION_ID ||
    "";

  const url = `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(
    secId
  )}/pages?$orderby=lastModifiedDateTime desc&$top=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      JSON.stringify({ status: res.status, body: j })
    );
  }
  const pageId = j?.value?.[0]?.id;
  if (!pageId) throw new Error("No pages found in Inbox section.");
  return pageId;
}

async function appendToPage(accessToken, pageId, htmlFragment) {
  // Correct OneNote PATCH with multipart/related where the part is named "commands"
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

  const text = await res.text().catch(() => "");
  if (!res.ok) {
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

    const accessToken = await getBoundAccessToken();
    if (!accessToken) {
      return res.status(401).json({ ok: false, error: "Not authenticated (no bound access token)" });
    }

    const pageId = await fetchLatestPageId(accessToken);
    const safe = htmlEscape(String(text));
    const fragment = `<p>${safe}</p>`;

    await appendToPage(accessToken, pageId, fragment);

    return res.status(200).json({ ok: true, pageId });
  } catch (err) {
    let detail = String(err);
    try {
      const m = typeof err?.message === "string" ? err.message : String(err);
      detail = JSON.parse(m);
    } catch (_) {}
    return res.status(400).json({ ok: false, error: "Append failed", detail });
  }
}
