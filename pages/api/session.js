// pages/api/session.js
// Simple session probe using YOUR KV wrapper (no @vercel/kv).

import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const user = await kv.get("session:user");
    res.status(200).json({ ok: true, user: user || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
