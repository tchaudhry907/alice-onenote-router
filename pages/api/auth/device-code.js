// pages/api/auth/device-code.js
import { requireAuth, beginDeviceFlow, pollDeviceFlow, clearTokens } from '../../../lib/auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  if (!requireAuth(req, res)) return;

  const { action } = req.body || {};
  try {
    if (action === 'begin') {
      const info = await beginDeviceFlow();
      return res.status(200).json({ ok:true, step:'begin', ...info });
    }
    if (action === 'poll') {
      const r = await pollDeviceFlow();
      return res.status(200).json(r);
    }
    if (action === 'reset') {
      await clearTokens();
      return res.status(200).json({ ok:true, step:'reset' });
    }
    return res.status(400).json({ ok:false, error:'action must be begin | poll | reset' });
  } catch (err) {
    return res.status(500).json({ ok:false, error: err?.message || 'Internal Error' });
  }
}
