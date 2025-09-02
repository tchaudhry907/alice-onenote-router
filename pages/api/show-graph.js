export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    name: "show-graph",
    message: "Stub endpoint (no fetch). Build should pass now.",
    now: new Date().toISOString(),
  });
}
