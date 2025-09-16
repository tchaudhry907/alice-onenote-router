// pages/api/notes/food.js
// POST { name, calories, whenISO? }  OR  { items: [{name, calories, whenISO?}, ...] }
// Uses Authorization header OR session cookies set by Diagnostics.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) return res.status(401).json({ ok: false, error: "No access token (header or cookie)" });

  try {
    // Normalize payload
    const body = req.body || {};
    const items = Array.isArray(body.items)
      ? body.items
      : (body.name ? [{ name: body.name, calories: body.calories, whenISO: body.whenISO }] : []);

    if (!items.length) return res.status(400).json({ ok: false, error: "Provide { name, calories } or items[]" });

    // 1) Find notebook "AliceChatGPT"
    const nbResp = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks?$select=id,displayName", {
      headers: { Authorization: bearer },
    });
    const nbJson = await nbResp.json();
    if (!nbResp.ok) throw new Error(`graph GET notebooks -> ${nbResp.status}: ${JSON.stringify(nbJson)}`);
    const notebook = (nbJson.value || []).find(n => (n.displayName || "").trim().toLowerCase() === "alicechatgpt");
    if (!notebook) throw new Error("Notebook not found: AliceChatGPT");

    // 2) Find (or later: create) section "Food"
    const secResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/notebooks/${encodeURIComponent(notebook.id)}/sections?$select=id,displayName`, {
      headers: { Authorization: bearer },
    });
    const secJson = await secResp.json();
    if (!secResp.ok) throw new Error(`graph GET sections -> ${secResp.status}: ${JSON.stringify(secJson)}`);
    const section = (secJson.value || []).find(s => (s.displayName || "").trim().toLowerCase() === "food");
    if (!section) throw new Error("Section not found: Food");

    // 3) Build page title + HTML
    const now = new Date();
    const fmtTime = (iso) => {
      try { return new Date(iso).toLocaleString(); } catch { return ""; }
    };
    const title = items.length === 1
      ? `[FOOD] ${items[0].name || "Item"} — ${items[0].calories ?? "?"} kcal`
      : `[FOOD] ${now.toLocaleDateString()} — ${items.length} items`;

    const rows = items.map((it) => {
      const whenTxt = it.whenISO ? ` <em>(${fmtTime(it.whenISO)})</em>` : "";
      const kcal = (it.calories ?? "").toString().trim();
      return `<tr><td>${escapeHtml(it.name || "")}${whenTxt}</td><td style="text-align:right">${kcal ? kcal + " kcal" : ""}</td></tr>`;
    }).join("");

    const htmlBody = `
<!DOCTYPE html>
<html>
  <head><title>${escapeHtml(title)}</title></head>
  <body>
    <h2>${escapeHtml(title)}</h2>
    <table border="0" style="width:100%;border-collapse:collapse">
      <thead><tr><th align="left">Item</th><th align="right">Calories</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`.trim();

    // 4) Correct multipart
    const boundary = "----AliceFoodBoundary" + Math.random().toString(36).slice(2);
    const mp =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="Presentation"\r\n` +
      `Content-Type: text/html\r\n\r\n` +
      htmlBody + `\r\n` +
      `--${boundary}--\r\n`;

    const createResp = await fetch(`https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(section.id)}/pages`, {
      method: "POST",
      headers: { Authorization: bearer, "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: mp,
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
