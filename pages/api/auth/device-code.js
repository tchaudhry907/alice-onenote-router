// pages/api/auth/device-code.js
import { beginDeviceFlow, pollDeviceFlow, resetDeviceFlow } from "../../../lib/auth-device.js";

// Helper to read bearer (if your flow needs it)
function readBearer(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : "";
}

export default async function handler(req, res) {
  // CORS + allowed methods
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");

  if (req.method === "OPTIONS") {
    // Preflight success
    return res.status(200).json({ ok: true });
  }

  // Accept both GET ?action=... and POST {action:"..."}
  const method = req.method;
  const action =
    (method === "GET" ? req.query?.action : req.body?.action) || "";

  if (!["GET", "POST"].includes(method)) {
    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!action) {
    return res.status(400).json({ ok: false, error: "Missing 'action' (reset|begin|poll)" });
  }

  try {
    const bearer = readBearer(req); // if your downstream helpers validate tenant/app per bearer

    switch (action) {
      case "reset": {
        const out = await resetDeviceFlow({ bearer });
        return res.status(200).json({ ok: true, step: "reset", ...out });
      }
      case "begin": {
        const out = await beginDeviceFlow({ bearer });
        // Expect: { user_code, verification_uri, expires_in, message }
        return res.status(200).json({ ok: true, step: "begin", ...out });
      }
      case "poll": {
        const out = await pollDeviceFlow({ bearer });
        // Expect: { ok: true } when approved; otherwise { ok:false, pending:true }
        return res.status(200).json(out);
      }
      default:
        return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
