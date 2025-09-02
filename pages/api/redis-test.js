// pages/api/redis-test.js
import { NextResponse } from "next/server"; // harmless if unused on pages api
import { Redis } from "@upstash/redis";

function makeRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars on Vercel."
    );
  }
  return new Redis({ url, token });
}

export default async function handler(req, res) {
  try {
    const redis = makeRedis();

    // Quick switch for simple ops
    const { op = "ping", key = "alice:router:test", value } = req.query;

    if (op === "ping") {
      const pong = await redis.ping();
      return res.status(200).json({ ok: true, op, pong });
    }

    if (op === "set") {
      const v = value ?? `saved@${new Date().toISOString()}`;
      // set with a short TTL to keep things tidy
      await redis.set(key, v, { ex: 300 });
      const readBack = await redis.get(key);
      return res.status(200).json({ ok: true, op, key, wrote: v, readBack });
    }

    if (op === "get") {
      const got = await redis.get(key);
      return res.status(200).json({ ok: true, op, key, value: got });
    }

    if (op === "info") {
      // A tiny “who am I” to confirm the client config
      const ttl = await redis.ttl(key).catch(() => null);
      return res
        .status(200)
        .json({ ok: true, op, key, ttl, urlSet: !!process.env.UPSTASH_REDIS_REST_URL });
    }

    return res.status(400).json({
      ok: false,
      error: "Unknown op",
      allowed: ["ping", "set", "get", "info"],
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: String(err?.message || err),
    });
  }
}
