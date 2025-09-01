// pages/api/graph/page-create-to-inbox.js
// Creates a page in a named notebook+section (defaults: AliceChatGPT / Inbox)
// by resolving the section's true GUID, then using XHTML create with onenote-section-id.
//
// Usage (GET for convenience):
//   /api/graph/page-create-to-inbox?notebook=AliceChatGPT&section=Inbox
//     &title=Hello&body=Created%20with%20GUID
//
// Returns: { created: { id, title, section, notebook, createdDateTime, link }, raw }

export default async function handler(req, res) {
  try {
    const token = req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: "No access_token cookie" });

    const notebook = String(req.query.notebook || "AliceChatGPT").trim();
    const section  = String(req.query.section  || "Inbox").trim();
    const title    = String(req.query.title    || "Untitled from Router");
    const body     = String(req.query.body     || "No content provided");

    // 1) Resolve section GUID via our helper (same deployment origin)
    const resolveUrl = new URL(`${originFromReq(req)}/api/graph/sections-by-name`);
    resolveUrl.searchParams.set("notebook", notebook);
    resolveUrl.searchParams.set("section", section);

    const r1 = await fetch(resolveUrl.toString(), {
      headers: { cookie: req.headers.cookie || "" },
    });
    const j1 = await r1.json();
    if (!r1.ok) return res.status(r1.status).json(j1);

    const sectionGuid = j1.section.idGuid;

    // 2) XHTML body
    const xhtml =
`<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-US">
  <head>
    <title>${escapeXml(title)}</title>
    <meta name="created" content="${new Date().toISOString()}" />
  </head>
  <body>
    <p>${escapeXml(body)}</p>
  </body>
</html>`;

    // 3) Create page with onenote-section-id = GUID
    const createResp = await fetch("https://graph.microsoft.com/v1.0/me/onenote/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decodeURIComponent(token)}`,
        "Content-Type": "application/xhtml+xml",
        Accept: "application/json",
        "onenote-section-id": sectionGuid,
      },
      body: xhtml,
    });

    const created = await createResp.json();
    if (!createResp.ok) return res.status(createResp.status).json({ error: "Create failed", details: created });

    return res.status(201).json({
      created: {
        id: created.id,
        title: created.title,
        section,
        notebook,
        createdDateTime: created.createdDateTime,
        link: created?.links?.oneNoteClientUrl?.href || null,
      },
      raw: created,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function originFromReq(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host  = (req.headers.host || "").toString();
  return `${proto}://${host}`;
}
