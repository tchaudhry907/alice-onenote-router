// pages/api/debug/build-info.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    when: new Date().toISOString(),
    // Vercel injects these at build time:
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    msg: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    tag: "alice-one-router build marker v1"
  });
}
