// pages/api/graph/onenote.js
//
// Lists the signed‑in user's OneNote notebooks using Microsoft Graph.
//
// Requirements:
// - An access token stored in the "access_token" cookie (from your /api/auth/login + callback flow)
// - The app must have the Notes.Read (or Notes.ReadWrite) delegated permission granted
//
// Usage (after you're signed in):
//   GET /api/graph/onenote
//
// Optional query params:
//   ?top=50               -> page size (1–100; default 50)
//   ?select=id,displayName,lastModifiedDateTime  -> select specific fields
//
// Response:
//   200 JSON: { notebooks: [...], rawNextLink?: string }
//   401 JSON: { error: "Not signed in." }
//   502/503 JSON on transient Graph errors with correlation ids for debugging

export default async function handler(req, res) {
  try {
    // 1) Ensure we have an access token (set by your auth flow)
    const token = req.cookies?.access_token;
    if (!token) {
      res.status(401).json({
        error: "Not signed in.",
        hint: "Visit /login to start the Microsoft sign‑in flow.",
      });
      return;
    }

    // 2) Build Graph request
    const top =
      Math.max(1, Math.min(100, parseInt(req.query.top, 10) || 50)) || 50;

    // Pick a reasonable default field selection; callers can override with ?select=
    const select =
      (req.query.select &&
        String(req.query.select)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",")) ||
      "id,displayName,lastModifiedDateTime,isDefault,links,sectionGroupsUrl,sectionsUrl";

    // Base endpoint for notebooks
    const baseUrl = new URL(
      `https://graph.microsoft.com/v1.0/me/onenote/notebooks`
    );
    baseUrl.searchParams.set("$top", String(top));
    baseUrl.searchParams.set("$select", select);
    // Sort newest first to make it nice when many notebooks exist
    baseUrl.searchParams.set("$orderby", "lastModifiedDateTime desc");

    // 3) Call Graph
    const r = await fetch(baseUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    // 4) Handle auth/consent related errors cleanly
    if (r.status === 401) {
      res.status(401).json({
        error: "Access token expired or invalid.",
        next: "Re-run the sign-in flow at /login.",
      });
      return;
    }
    if (r.status === 403) {
      res.status(403).json({
        error:
          "Forbidden from Graph. This usually means the app lacks OneNote permissions.",
        requiredScopes:
          "Notes.Read (or Notes.ReadWrite) delegated permission for personal Microsoft accounts.",
        next:
          "Re-consent the app so Graph shows the OneNote permission screen, then try again.",
      });
      return;
    }

    // 5) Parse Graph response
    const json = await r.json();

    // Normalize output for your UI/next steps
    const notebooks =
      Array.isArray(json.value) &&
      json.value.map((n) => ({
        id: n.id,
        name: n.displayName,
        lastModified: n.lastModifiedDateTime,
        isDefault: n.isDefault ?? false,
        // Helpful links for future calls:
        webUrl: n?.links?.oneNoteWebUrl?.href || null,
        clientUrl: n?.links?.oneNoteClientUrl?.href || null,
        sectionsUrl: n.sectionsUrl || null,
        sectionGroupsUrl: n.sectionGroupsUrl || null,
      }));

    res.status(200).json({
      notebooks: notebooks || [],
      rawNextLink: json["@odata.nextLink"] || null, // in case you want to follow more pages later
    });
  } catch (err) {
    // 6) Robust error surface with correlation if Graph sent one
    const status = err?.statusCode || 502;
    res.status(status).json({
      error: "Graph call failed",
      details:
        err?.message ||
        "Unexpected error while calling Microsoft Graph /me/onenote/notebooks.",
    });
  }
}
