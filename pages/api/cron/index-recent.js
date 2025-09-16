// pages/api/cron/index-recent.js
export default async function handler(_req, res) {
  return res.status(200).json({
    ok: true,
    message: "Cron disabled in v2 during setup. Use Diagnostics buttons instead.",
  });
}
