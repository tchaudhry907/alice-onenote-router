// pages/api/hooks/pair.js
//
// Creates a personal API key and stores your current refresh_token in Redis.
// Call this FROM your browser (so it can read your session tokens).
//
// GET or POST /api/hooks/pair
// Returns: { ok:true, apiKey:"...", curlExample:"..." }

import { kvSet } from "@/lib/kv";

const API_KEYS_NAMESPACE = "alice:apikey:";

/** Read session tokens we already store in cookies (/api/debug/tokens, same mechanism) */
async function readSessionTokens(req) {
  const base = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const r = await fetch(`${base}/api/debug/tokens?full=1`, {
    headers: { cookie: req.headers.cookie || "" },
  });
  const j = await r.json().catch(() => ({}));
  return j || {};
}

export default async function handler(req, res) {
  try {
    const t = await readSessionTokens(req);
    if (!t || !t.refresh_token) {
      return res.status(401).json({ ok: false, error: "No refresh_token in session. Use Diagnostics: Refresh Tokens, then Seed server with tokens." });
    }

    // Create a random API key
    const apiKey = "sk_" + [...crypto.getRandomValues(new Uint8Array(24))].map(x => x.toString(16).padStart(2, "0")).join("");

    // Store refresh_token + (optionally) client info; 30 days TTL (auto-extend later if you want)
    await kvSet(API_KEYS_NAMESPACE + apiKey, { refresh_token: t.refresh_token, client: { id: process.env.MS_CLIENT_ID || "" } }, 30 * 24 * 3600);

    const curlExample = [
      "curl -s -X POST https://alice-onenote-router.vercel.app/api/hooks/ingest \\",
      `  -H "X-Api-Key: ${apiKey}" -H "Content-Type: application/json" \\`,
      "  --data '{",
      '    \"action\":\"create\",',
      '    \"notebookName\":\"AliceChatGPT\",',
      '    \"sectionName\":\"Food\",',
      '    \"title\":\"[FOOD] Pumpkin pie — 300 kcal\",',
      '    \"html\":\"<p>Logged by webhook</p>\"',
      "  }'"
    ].join("\n");

    return res.status(200).json({ ok: true, apiKey, curlExample, tip: "Save your API key now; treat like a password." });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
