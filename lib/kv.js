// lib/kv.js
import { kv } from '@vercel/kv';

export async function kvSet(key, value, ttlSeconds) {
  if (ttlSeconds) {
    await kv.set(key, value, { ex: ttlSeconds });
  } else {
    await kv.set(key, value);
  }
}

export async function kvGet(key) {
  return await kv.get(key);
}

export async function kvDel(key) {
  return await kv.del(key);
}
