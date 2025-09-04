export default function handler(req, res) {
  res.status(200).json({
    text: "hello2",
    UPSTREAM_REDIS_REST_URL: process.env.UPSTREAM_REDIS_REST_URL || "unknown",
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    timestamp: new Date().toISOString()
  })
}
