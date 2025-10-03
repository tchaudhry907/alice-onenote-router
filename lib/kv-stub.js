// lib/kv-stub.js
// Minimal kv shim. Provides both default and named exports.

const kv = {
  async get(_k) { return null; },
  async set(_k, _v, _opts) { return "OK"; },
  async del(_k) { return 1; },
  async ttl(_k) { return -1; },
  async expire(_k, _s) { return 1; },
  async ping() { return "PONG"; },
};

export default kv;
export { kv };
