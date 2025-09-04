export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/debug/hello2",
    ts: new Date().toISOString(),
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown"
  });
}

