import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const value = await redis.get("mykey");
      return res.status(200).json({ value });
    }

    if (req.method === "POST") {
      const { key, value } = req.body;
      await redis.set(key, value);
      return res.status(200).json({ message: "Value set successfully" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Redis error", details: error.message });
  }
}
