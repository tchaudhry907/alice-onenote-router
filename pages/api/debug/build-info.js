export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    when: new Date().toISOString(),
    sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    msg: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    tag: "build-marker-v2"
  });
}
