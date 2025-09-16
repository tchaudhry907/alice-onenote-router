// pages/api/auth/device-code.js
import { beginDeviceFlow, pollDeviceFlow, resetDeviceFlow } from "../../../lib/auth-device.js";

function readBearer(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : "";
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  const action = (req.method === "GET" ? req.query?.action : req.body?.action) || "";
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!action) return res.status(400).json({ ok: false, error: "Missing 'action' (reset|begin|poll)" });

  try {
    const bearer = readBearer(req);

    if (action === "reset") {
      const out = await resetDeviceFlow({ bearer });
      return res.status(200).json({ ok: true, step: "reset", ...out });
    }
    if (action === "begin") {
      const out = await beginDeviceFlow({ bearer });
      return res.status(200).json({ ok: true, step: "begin", ...out });
    }
    if (action === "poll") {
      const out = await pollDeviceFlow({ bearer });
      return res.status(200).json(out);
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
