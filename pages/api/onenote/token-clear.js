// pages/api/onenote/token-clear.js
import { kvDel } from '@/lib/kv';

export default async function handler(req, res) {
  const keys = ['ms:access_token','graph:access_token','access_token'];
  const results = {};
  for (const k of keys) results[k] = await kvDel(k);
  res.status(200).json({ ok: true, deleted: results });
}
