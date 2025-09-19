// Local stub for '@vercel/kv' so imports never break the build.
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
