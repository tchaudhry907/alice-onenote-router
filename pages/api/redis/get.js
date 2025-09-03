import { ping } from "@/lib/kv";

export default async function handler(req, res) {
  try {
    const pong = await ping();
    res.status(200).json({ ok: true, ping: pong });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
