// lib/kv-stub.js
// Minimal stub to satisfy imports during build.
// If you don’t need debug/kv-alias-check in production, this is enough.

export const kv = {
  get: async () => null,
  set: async () => null,
  del: async () => null,
};
