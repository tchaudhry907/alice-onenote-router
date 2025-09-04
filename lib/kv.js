// /lib/kv.js
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

function getClient() {
  if (!url || !token) throw new Error("UPSTASH env vars missing");
  return new Redis({ url, token });
}

export async function ping()   { return getClient().ping(); }
export async function get(key) { return getClient().get(key); }
export async function set(key, value, opts = {}) { return getClient().set(key, value, opts); }
export async function del(key) { return getClient().del(key); }
export async function expire(key, seconds) { return getClient().expire(key, seconds); }
export async function ttl(key) { return getClient().ttl(key); }
