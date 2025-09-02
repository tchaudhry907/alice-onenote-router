export default function handler(req, res) {
  res.status(200).json({ poke: "alive", time: new Date().toISOString() });
}
