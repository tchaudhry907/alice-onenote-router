// /lib/redis.js
import { Redis } from "@upstash/redis";

let client;

export function getRedis() {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("Missing UPSTASH_REDIS_REST_URL or _TOKEN env vars");
    }
    client = new Redis({ url, token });
  }
  return client;
}
