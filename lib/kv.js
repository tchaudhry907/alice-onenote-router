// KV_FILE_VERSION: v5-2025-09-17
// lib/kv.js — Upstash Redis REST client (named + default export)

const BASE = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!BASE || !TOKEN) {
  console.warn('[kv] Missing UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN)');
}

async function call(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`[kv] ${res.status} ${res.statusText}: ${t}`);
  }
  return res.json();
}

export const kv = {
  async get(key) {
    const r = await call('GET', `/get/${encodeURIComponent(key)}`);
    if (r?.result == null) return null;
    try { return JSON.parse(r.result); } catch { return r.result; }
  },
  async set(key, value, opts = {}) {
    const p = new URLSearchParams();
    if (opts.ex) p.set('ex', String(opts.ex));
    if (opts.px) p.set('px', String(opts.px));
    const qs = p.toString() ? `?${p}` : '';
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    const r = await call('POST', `/set/${encodeURIComponent(key)}${qs}`, val);
    return r.result === 'OK';
  },
  async del(key) {
    const r = await call('DELETE', `/del/${encodeURIComponent(key)}`);
    return r.result || 0;
  },
  async ping() {
    try {
      await this.set('kv:ping', '1', { ex: 5 });
      const v = await this.get('kv:ping');
      return { ok: v === '1' || v === 1 || v === '"1"' };
    } catch (e) { return { ok: false, error: e.message }; }
  },
};

export default kv;
