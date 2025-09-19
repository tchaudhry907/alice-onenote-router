// pages/api/debug/kv-alias-check.js
// Simple endpoint proving we are using the local stub (no '@vercel/kv').

import kv from "@/lib/kv-stub";

export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    type: typeof kv,
    keys: Object.keys(kv || {}),
    note: "Resolved from lib/kv-stub (no alias, no external package)"
  });
}
