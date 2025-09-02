// pages/api/show-graph.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    name: "show-graph",
    message: "Stub endpoint restored so imports resolve.",
    now: new Date().toISOString(),
  });
}
