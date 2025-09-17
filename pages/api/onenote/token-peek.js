// pages/api/onenote/token-peek.js
import { kvGet } from '@/lib/kv';

export default async function handler(req, res) {
  const keys = ['ms:access_token','graph:access_token','access_token'];
  const out = {};
  for (const k of keys) {
    const v = await kvGet(k);
    if (typeof v === 'string') {
      out[k] = {
        present: true,
        startsWith_eyJ: v.startsWith('eyJ'),
        length: v.length,
        head: v.slice(0, 16),
        dots: (v.match(/\./g) || []).length
      };
    } else {
      out[k] = { present: false };
    }
  }
  res.status(200).json(out);
}
