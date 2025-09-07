import { requireAuth, getAccessToken } from "@/lib/auth";
import { get as kvGet, set as kvSet } from "@/lib/kv";
import { ONE_NOTE_NOTEBOOK_NAME } from "@/lib/constants";

function stripHtmlToText(html = "") {
  // quick + dirty: remove tags and decode some entities we care about
  const noTags = html.replace(/<[^>]*>/g, " ");
  return noTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchNotebookId(accessToken, name) {
  const r = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify({ status: r.status, body: j }));
  const match = (j.value || []).find(
    (n) => (n.displayName || "").toLowerCase() === (name || "").toLowerCase()
  );
  return match?.id || null;
}

async function fetchPagesInNotebook(accessToken, notebookId, limit = 50) {
  const url = `https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(
    notebookId
  )}/pages?$top=${encodeURIComponent(limit)}&$select=id,title,createdDateTime,lastModifiedDateTime`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify({ status: r.status, body: j }));
  return j.value || [];
}

async function fetchPageHtml(accessToken, pageId) {
  const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(
    pageId
  )}/content`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const html = await r.text();
  if (!r.ok) throw new Error(JSON.stringify({ status: r.status, body: html }));
  return html;
}

export default requireAuth(async function handler(req, res, session) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { pageId, notebook, limit } = req.body || {};
    const accessToken = await getAccessToken(session);

    const indexKey = "idx:list"; // stores array of pageIds we’ve indexed
    let list = (await kvGet(indexKey)) || [];

    let targets = [];

    if (pageId) {
      targets = [{ id: pageId }];
    } else {
      const nbName = notebook || process.env.ONE_NOTE_NOTEBOOK_NAME || ONE_NOTE_NOTEBOOK_NAME || "AliceChatGPT";
      const nbId = await fetchNotebookId(accessToken, nbName);
      if (!nbId) {
        return res.status(404).json({ ok: false, error: `Notebook not found: ${nbName}` });
      }
      const pages = await fetchPagesInNotebook(accessToken, nbId, Number(limit) || 50);
      targets = pages.map((p) => ({ id: p.id, title: p.title }));
    }

    let added = 0;
    for (const t of targets) {
      const html = await fetchPageHtml(accessToken, t.id);
      const text = stripHtmlToText(html);
      await kvSet(`idx:text:${t.id}`, text);
      if (!list.includes(t.id)) {
        list.push(t.id);
        added++;
      }
    }
    await kvSet(indexKey, list);

    return res.status(200).json({ ok: true, countIndexed: targets.length, newlyAdded: added });
  } catch (err) {
    let detail = String(err);
    try {
      detail = JSON.parse(err?.message || "");
    } catch {}
    return res.status(400).json({ ok: false, error: "Index failed", detail });
  }
});
