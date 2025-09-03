// pages/api/cron/worker.js
import { kv } from "@/lib/kv";
import { refreshAccessToken } from "@/lib/graph";

const CRON_TOKEN = process.env.CRON_TOKEN || "alice-cron-SECRET-123";
const MAX_JOBS_PER_RUN = 10;

export default async function handler(req, res) {
  try {
    const token = (req.query?.token || "").toString();
    if (token !== CRON_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized cron" });
    }

    // Prefer a dedicated service refresh token set during callback
    const serviceRefresh = await kv.get("alice:service:refreshToken");
    // Fallback to last user's refresh if needed
    const lastUserKey = await kv.get("alice:lastUserKey");
    const fallbackRefresh = lastUserKey ? await kv.get(lastUserKey) : null;
    const useRefresh = serviceRefresh || fallbackRefresh;
    if (!useRefresh) {
      return res.status(200).json({ ok: true, processed: 0, note: "No refresh token available" });
    }

    const fresh = await refreshAccessToken(useRefresh);
    const access = fresh?.access_token;
    if (!access) return res.status(200).json({ ok: true, processed: 0, note: "Could not refresh access token" });

    let processed = 0;
    let errors = 0;
    const details = [];

    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const raw = await kv.rpop?.("alice:append:queue");
      if (!raw) break;

      try {
        const job = JSON.parse(raw);
        if (job?.kind === "append") {
          await appendToPage(access, job.pageId, job.html);
          processed++;
          details.push({ pageId: job.pageId, ok: true });
        } else {
          details.push({ skipped: job?.kind });
        }
      } catch (err) {
        errors++;
        details.push({ error: String(err?.message || err) });
      }
    }

    res.status(200).json({ ok: true, processed, errors, details });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}

async function appendToPage(accessToken, pageId, html) {
  const url = `https://graph.microsoft.com/v1.0/me/onenote/pages/${encodeURIComponent(pageId)}/content`;
  const commands = [
    { target: "body", action: "append", position: "after", content: html || "<p>Appended</p>" }
  ];
  const r = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Graph ${r.status}: ${t}`);
  }
}
