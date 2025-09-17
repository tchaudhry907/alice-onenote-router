// pages/api/onenote/token-clear.js
import { kvDel } from '@/lib/kv';

export default async function handler(req, res) {
  const keys = ['graph:access_token','ms:access_token','access_token','ms:refresh_token','auth:access_token'];
  const results = {};
  for (const k of keys) results[k] = await kvDel(k);
  res.status(200).json({ ok: true, deleted: results });
}
