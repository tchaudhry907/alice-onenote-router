// pages/api/redis/ping.js
import { kv } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const pong = await kv.ping(); // returns "PONG"
    res.status(200).json({ ok: true, pong });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
