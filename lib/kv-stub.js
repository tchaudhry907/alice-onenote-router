// lib/kv-stub.js
// Safe local stub for a KV client so builds never fail if something imports it.

export const kv = {
  async get(_key) { return null; },
  async set(_key, _value, _opts) { return "OK"; },
  async del(_key) { return 0; },
  async incr(_key) { return 0; },
  async decr(_key) { return 0; },
  async hget(_k, _f) { return null; },
  async hset(_k, _obj) { return "OK"; },
};

export default kv;
