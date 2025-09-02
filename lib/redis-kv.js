import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export async function kvSet(key, value) {
  await redis.set(key, value);
}

export async function kvGet(key) {
  return await redis.get(key);
}
