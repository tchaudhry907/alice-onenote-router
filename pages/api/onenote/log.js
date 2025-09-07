// pages/api/onenote/log.js
//
// Writes a line of text to today's "Daily Log — YYYY-MM-DD" page in OneNote.
// It uses the *bound* refresh_token stored in Upstash (set by /api/cron/bind),
// so no browser session/cookies are required for this endpoint.
//
// ENV required:
//   MS_CLIENT_ID
//   MS_CLIENT_SECRET
//   MS_TENANT_ID            (use "common" if unsure)
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Optional:
//   ONE_NOTE_INBOX_SECTION_ID  (your Inbox section id; fallback provided below)
//   BIND_KEY_PREFIX            (default "msauth:")
//   BIND_REFRESH_KEY_SUFFIX    (default "refresh_token")
//   DAILY_PAGE_KV_PREFIX       (default "daily:page:")
//
// POST body:
//   { "text": "Breakfast: blueberry oatmeal 300 cals." }
//
// Response:
//   { ok: true, pageId: "<id>", title: "Daily Log — 2025-09-07" }

function json(res, code, body) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function todayTitle() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `Daily Log — ${yyyy}-${mm}-${dd}`;
}

function htmlEscape(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureTrailingSlash(u) {
  return u.endsWith("/") ? u : u + "/";
}

async function upstashGet(url, token, key) {
  const getUrl = new URL(`get/${encodeURIComponent(key)}`, ensureTrailingSlash(url));
  const r = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Upstash GET failed (${r.status})`);
  const t = await r.text();
  // Upstash returns JSON like {"result":"value"} or {"result":null}
  try {
    const j = JSON.parse(t);
    return j?.result ?? null;
  } catch {
    return null;
  }
}

async function upstashSet(url, token, key, value, ttlSeconds) {
  const path = new URL(
    `set/${encodeURIComponent(key)}/${encodeURIComponent(value)}` +
      (ttlSeconds ? `/ex/${ttlSeconds}` : ""),
    ensureTrailingSlash(url)
  );
  const r = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Upstash SET failed (${r.status}): ${txt}`);
  }
  return true;
}

async function fetchAccessTokenFromRefresh(refreshToken) {
  const tenant = process.env.MS_TENANT_ID || "common";
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing MS_CLIENT_ID/MS_CLIENT_SECRET");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("grant_type", "refresh_token");
  // Scopes must include Notes.ReadWrite / Notes.ReadWrite.All etc.
  form.set(
    "scope",
    "openid profile offline_access User.Read Notes.ReadWrite Notes.ReadWrite.All Notes.Create Files.ReadWrite.All"
  );
  form.set("refresh_token", refreshToken);

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      `Token refresh failed (${r.status}): ${typeof j === "object" ? JSON.stringify(j) : String(j)}`
    );
  }

  if (!j.access_token) {
    throw new Error("Token refresh returned no access_token");
  }
  return {
    accessToken: j.access_token,
    // Optionally rotate stored refresh token if present
    refreshToken: j.refresh_token || null,
    expiresIn: j.expires_in || 3600,
  };
}

async function createDailyPage(accessToken, sectionId, title) {
  const html = `<html><head><title>${title}</title></head><body><h1>${title}</h1><hr/></body></html>`;
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/html",
      },
      body: html,
    }
  );
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(
      `Create page failed (${r.status}): ${typeof j === "object" ? JSON.stringify(j) : String(j)}`
    );
  }
  if (!j.id) throw new Error("Create page returned no id");
  return j.id;
}

async function appendToPage(accessToken, pageId, htmlFragment) {
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

  const r = await fetch(
    `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Append failed (${r.status}): ${t}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }
  try {
    const { text } = (req.body || {});
    if (!text) return json(res, 400, { ok: false, error: "Missing text" });

    // Load bound refresh token from Upstash
    const U_URL = process.env.UPSTASH_REDIS_REST_URL;
    const U_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!U_URL || !U_TOKEN) {
      return json(res, 500, { ok: false, error: "Redis not configured on server" });
    }

    const prefix = process.env.BIND_KEY_PREFIX || "msauth:";
    const refreshSuffix = process.env.BIND_REFRESH_KEY_SUFFIX || "refresh_token";
    const keyBase = `${prefix}default`;
    const refreshKey = `${keyBase}:${refreshSuffix}`;

    const boundRefresh = await upstashGet(U_URL, U_TOKEN, refreshKey);
    if (!boundRefresh) {
      return json(res, 401, {
        ok: false,
        error: "No bound refresh token. Visit /api/cron/bind after login.",
      });
    }

    // Exchange refresh -> access
    const { accessToken, refreshToken: rotated } = await fetchAccessTokenFromRefresh(boundRefresh);

    // If MS rotated refresh_token, persist it back so we never go stale.
    if (rotated && rotated !== boundRefresh) {
      await upstashSet(U_URL, U_TOKEN, refreshKey, rotated, 60 * 60 * 24 * 30);
    }

    // Get (or create) today's page id from KV to avoid duplicates
    const pageKvPrefix = process.env.DAILY_PAGE_KV_PREFIX || "daily:page:";
    const title = todayTitle();
    const pageKey = `${pageKvPrefix}${title}`;
    let pageId = await upstashGet(U_URL, U_TOKEN, pageKey);

    const inboxSectionId =
      process.env.ONE_NOTE_INBOX_SECTION_ID ||
      // Fallback to your Inbox section id (you can keep this, or remove once env is set)
      "0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585";

    if (!pageId) {
      pageId = await createDailyPage(accessToken, inboxSectionId, title);
      // Cache id for 2 days
      await upstashSet(U_URL, U_TOKEN, pageKey, pageId, 60 * 60 * 48);
    }

    const fragment = `<p>${htmlEscape(text)}</p>`;
    await appendToPage(accessToken, pageId, fragment);

    return json(res, 200, { ok: true, pageId, title });
  } catch (err) {
    return json(res, 400, {
      ok: false,
      error: err?.message || String(err),
    });
  }
}
