// /lib/kv.js
import { Redis } from '@upstash/redis';

// Read env once
const url = process.env.UPSTASH_REDIS_REST_URL || '';
const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';

let client;

/** Lazily create a single Redis client instance */
export function getClient() {
  if (!client) {
    if (!url || !token) {
      const missing = [];
      if (!url) missing.push('UPSTASH_REDIS_REST_URL');
      if (!token) missing.push('UPSTASH_REDIS_REST_TOKEN');
      throw new Error(`Upstash Redis env missing: ${missing.join(', ')}`);
    }
    client = new Redis({ url, token });
  }
  return client;
}

// Thin wrappers you can import elsewhere
export async function ping()         { return getClient().ping(); }
export async function get(key)       { return getClient().get(key); }
export async function set(key,val,opt={}) { return getClient().set(key, val, opt); }
export async function del(key)       { return getClient().del(key); }
export async function expire(key,s)  { return getClient().expire(key, s); }
export async function ttl(key)       { return getClient().ttl(key); }
