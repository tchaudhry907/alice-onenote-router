// lib/kv.js
// Minimal KV wrapper with an in-memory fallback for local/dev.
// Exports: get(key), set(key, value, opts?), del(key), isRemote()

let memory = new Map();
let kv = null;

try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // Only require when env is present to avoid bundling errors locally
    const { createClient } = require('@vercel/kv');
    kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch (_) {
  kv = null;
}

const PREFIX = process.env.KV_NAMESPACE || 'alice';

// namespace keys so multiple deployments don’t collide
const k = (key) => `${PREFIX}:${key}`;

async function get(key) {
  if (kv) return await kv.get(k(key));
  return memory.get(k(key));
}

async function set(key, value, opts = {}) {
  // opts.ex = seconds (TTL) if you pass it
  if (kv) return await kv.set(k(key), value, opts);
  memory.set(k(key), value);
  return 'OK';
}

async function del(key) {
  if (kv) return await kv.del(k(key));
  return memory.delete(k(key));
}

function isRemote() {
  return Boolean(kv);
}

module.exports = { get, set, del, isRemote };
