# ==========================
# 1) lib/kv.js (place in /lib/kv.js)
# ==========================
cat > lib/kv.js <<'EOF'
// lib/kv.js
// Upstash Redis REST client — supports both named + default import

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
EOF

# ==========================
# 2) pages/api/kv/health.js (place in /pages/api/kv/health.js)
# ==========================
mkdir -p pages/api/kv
cat > pages/api/kv/health.js <<'EOF'
// pages/api/kv/health.js
import { kv } from '@/lib/kv';

export default async function handler(req, res) {
  try {
    const payload = { ok: true, ts: Date.now() };
    await kv.set('health:kv', payload, { ex: 30 });
    const got = await kv.get('health:kv');
    await kv.del('health:kv');
    res.status(200).json({
      wrote: payload,
      read: got,
      match: JSON.stringify(payload) === JSON.stringify(got),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
EOF

# ==========================
# 3) Verify env vars in Vercel
# ==========================
# Go to Project → Settings → Environment Variables
# Add these (scope: Development + Preview + Production):
#
# UPSTASH_REDIS_REST_URL = https://expert-roughy-32174.upstash.io
# UPSTASH_REDIS_REST_TOKEN = AX2uAAIncDFmOTEzYmEzNGU1OTc0YjlmYTdkY2Y4MzM0MDA4MTliZHAxMzIxNzQ
# MS_CLIENT_ID = <your Alice OneNote Router app id>
# MS_CLIENT_SECRET = <your secret>
# MS_TENANT = common
# APP_BASE_URL = https://alice-onenote-router.vercel.app
# REDIRECT_URI = https://alice-onenote-router.vercel.app/api/auth/callback
#
# After saving → redeploy with "Skip Build Cache"

# ==========================
# 4) Test after deploy
# ==========================
BASE="https://alice-onenote-router.vercel.app"

# KV health check
curl -s "$BASE/api/kv/health" | jq

# Redis ping (if you kept /api/redis/ping)
curl -s "$BASE/api/redis/ping" | jq
