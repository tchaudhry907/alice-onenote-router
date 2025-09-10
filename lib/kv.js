// lib/kv.js
// Build-safe KV shim with the exact exports the rest of the app expects.
// No import of '@vercel/kv' so Next won't fail if the package isn't installed.
//
// NOTE: This is an in-memory fallback. It works for single-process flows
// like your device-code login + immediate Graph calls. If you later want
// persistent storage across instances, we can switch to Vercel KV in one edit.

const _mem = new Map();

const get = async (key) => (_mem.has(key) ? _mem.get(key) : null);
const set = async (key, value) => {
  _mem.set(key, value);
  return "OK";
};

// Minimal no-ops for other calls used in indexer/cron:
const hgetall = async () => ({});
const zadd = async () => null;
const zrange = async () => [];
const del = async (key) => {
  const had = _mem.delete(key);
  return had ? 1 : 0;
};

// "client" object to export under multiple names
const client = { get, set, hgetall, zadd, zrange, del };

// Named exports used across the codebase
export const kv = client;            // preferred handle
export const redis = client;         // legacy alias some files import
export const kvGet = get;            // legacy helpers
export const kvSet = set;

// Also export the plain functions
export { get, set, hgetall, zadd, zrange, del };

// Default export for convenience
export default client;
