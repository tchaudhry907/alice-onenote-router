export default async function handler(req, res) {
  try {
    const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    const data = await response.json();

    res.status(200).json({
      ok: true,
      source: "show-graph.js",
      data,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
