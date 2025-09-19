// This endpoint only works if the alias to a local stub is active.
// It imports '@vercel/kv' ON PURPOSE to test your webpack alias.
import kv from "@vercel/kv";  // should resolve to lib/kv-stub.js if alias works

export default function handler(req, res) {
  res.status(200).json({ ok: true, type: typeof kv, keys: Object.keys(kv || {}) });
}
