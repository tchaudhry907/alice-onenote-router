// lib/kv-stub.js
// Safe local stub for '@vercel/kv' so builds never fail even if something imports it.

export const kv = {
  async get() { return null; },
  async set() { return "OK"; },
  async del() { return 0; },
  async incr() { return 0; },
  async decr() { return 0; },
  async hget() { return null; },
  async hset() { return "OK"; }
};

export default kv;
