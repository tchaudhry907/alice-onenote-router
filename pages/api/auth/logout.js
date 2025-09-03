import { kv } from "@/lib/kv";
import { getTokenCookie, clearTokenCookie } from "@/lib/cookie";

export default async function handler(req, res) {
  try {
    const tok = getTokenCookie(req);
    if (tok?.key) {
      await kv.del(tok.key);
    }
    clearTokenCookie(res);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
