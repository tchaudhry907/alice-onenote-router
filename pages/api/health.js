export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: "alice-onenote-router",
    uptime: Math.round(process.uptime()),
  });
}
