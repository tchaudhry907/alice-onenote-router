// pages/api/cleanup.js
// Stub to unblock build. Returns 501 until we wire up deletion.
// (We purposely avoid importing '@vercel/kv' here.)

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  return res
    .status(501)
    .json({ ok: false, error: "Cleanup not implemented in this build (stub)" });
}
