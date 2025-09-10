// lib/kv.js (JS)
// Provide a single KV client and export it under both names: `kv` and `redis`.
// Falls back to no-op methods if @vercel/kv isn't configured (keeps build happy).

import { kv as vercelKV } from "@vercel/kv";

const fallback = {
  get: async () => null,
  set: async () => null,
  hgetall: async () => ({}),
  zadd: async () => null,
  zrange: async () => [],
  del: async () => null,
};

const client = vercelKV ?? fallback;

export const kv = client;
// Alias so files importing `{ redis }` keep working:
export const redis = client;

export default client;
