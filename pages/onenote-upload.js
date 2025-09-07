// /pages/onenote-upload.js
import { useState } from "react";

export default function OneNoteUpload() {
  const [title, setTitle] = useState("Alice Router — Upload");
  const [body, setBody] = useState("<p>Hello from Alice Router!</p>");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function safeFetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return { ok: res.ok, status: res.status, body: parsed ?? text };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResult("Submitting…");

    try {
      const r = await safeFetchJson("/api/onenote/page-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });

      setResult(JSON.stringify(r.body, null, 2));
    } catch (err) {
      setResult(`ERROR: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1>Alice OneNote Router — Upload</h1>
      <p>Creates a OneNote page in your default section.</p>

      <div style={{ marginBottom: 12 }}>
        <a href="/api/auth/login?state=/onenote-upload">Sign in</a>
        {" · "}
        <a href="/onenote-test">Test dashboard</a>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 10 }}>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Body [HTML/XHTML]</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            style={{ width: "100%", marginTop: 4, padding: 8 }}
          />
        </div>

        <button type="submit" disabled={submitting} style={{ padding: "8px 12px" }}>
          {submitting ? "Submitting…" : "Create Page"}
        </button>
      </form>

      <pre style={{ background: "#f6f8fa", padding: 12, border: "1px solid #e5e7eb", marginTop: 12, whiteSpace: "pre-wrap" }}>
        {result}
      </pre>
    </div>
  );
}
