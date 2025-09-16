// pages/api/graph/food-log.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");
  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  const {
    notebookName = "AliceChatGPT",
    sectionName = "Food",
    item,
    calories,
    note = "",
    whenISO = new Date().toISOString(),
  } = req.body || {};

  if (!item || typeof item !== "string") return res.status(400).json({ ok: false, error: "Missing 'item' (string)" });
  const kcal = calories != null ? Number(calories) : undefined;
  if (kcal != null && Number.isNaN(kcal)) return res.status(400).json({ ok: false, error: "'calories' must be a number" });

  try {
    // resolve notebook
    const nb = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
      headers: { Authorization: bearer },
    }).then(jok);
    const notebook = (nb.value || []).find(n => (n.displayName || "").toLowerCase() === notebookName.toLowerCase());
    if (!notebook) throw new Error(`Notebook not found: ${notebookName}`);

    // resolve section
    const secs = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, {
      headers: { Authorization: bearer },
    }).then(jok);
    const section = (secs.value || []).find(s => (s.displayName || "").toLowerCase() === sectionName.toLowerCase());
    if (!section) throw new Error(`Section not found: ${sectionName}`);

    // build HTML
    const dt = new Date(whenISO);
    const title = `[FOOD] ${item} — ${kcal != null ? `${kcal} kcal` : ""}`.trim();
    const pretty = dt.toLocaleString("en-US", { hour12: true });
    const htmlBody = `
      <h2>${escapeHtml(item)}</h2>
      <p><b>When:</b> ${escapeHtml(pretty)}</p>
      ${kcal != null ? `<p><b>Calories:</b> ${kcal}</p>` : ""}
      ${note ? `<p><b>Note:</b> ${escapeHtml(note)}</p>` : ""}
    `.trim();
    const htmlDoc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title></head><body>${htmlBody}</body></html>`;

    const boundary = "----AliceFoodBoundary" + Math.random().toString(36).slice(2);
    const body =
      `--${boundary}\r\nContent-Disposition: form-data; name="Presentation"\r\nContent-Type: text/html\r\n\r\n` +
      htmlDoc + `\r\n--${boundary}--\r\n`;

    const createResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages`, {
      method: "POST",
      headers: {
        Authorization: bearer,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    const created = await createResp.json();
    if (!createResp.ok) throw new Error(`graph POST create page -> ${createResp.status}: ${JSON.stringify(created)}`);
    return res.status(200).json({ ok: true, created });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}
async function jok(r) {
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j));
  return j;
}
