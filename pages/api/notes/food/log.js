// pages/api/notes/food/log.js
// Thin wrapper that writes a "[FOOD] … — N kcal" page into the "Food" section

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  // Accept header or cookie (Diagnostics can seed cookies)
  const bearer =
    req.headers.authorization ||
    (req.cookies?.access_token ? `Bearer ${req.cookies.access_token}` : "");

  if (!bearer) {
    return res
      .status(401)
      .json({ ok: false, error: "No access token (header or cookie)" });
  }

  try {
    const {
      item = "Unknown food",
      calories = 0,
      notebookName = process.env.DEFAULT_NOTEBOOK_NAME || "AliceChatGPT",
      sectionName = "Food",
      // Optionals to let us pass raw HTML if we want:
      html,
    } = (req.body || {});

    const title = `[FOOD] ${item} — ${calories} kcal`;
    const bodyHtml =
      html ??
      `<p>${item} — <strong>${calories} kcal</strong></p><p>Logged via Diagnostics.</p>`;

    // Call the working route that resolves names -> IDs and builds the proper multipart
    const createResp = await fetch(
      `${originFromReq(req)}/api/graph/create-read-link`,
      {
        method: "POST",
        headers: {
          Authorization: bearer,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notebookName,
          sectionName,
          title,
          html: bodyHtml,
        }),
      }
    );

    const created = await createResp.json();
    if (!createResp.ok || created?.ok === false) {
      // Normalize error shape
      return res
        .status(200)
        .json({ ok: false, error: created?.error || "Create failed" });
    }

    return res.status(200).json({ ok: true, created });
  } catch (e) {
    return res
      .status(200)
      .json({ ok: false, error: String(e?.message || e) });
  }
}

// Build absolute origin for server-to-server call (works on Vercel/local)
function originFromReq(req) {
  const proto =
    req.headers["x-forwarded-proto"]?.split(",")[0] ||
    (req.socket.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}
