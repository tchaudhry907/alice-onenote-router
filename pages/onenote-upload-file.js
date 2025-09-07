// /pages/onenote-upload-file.js
import { useState } from "react";

export default function OneNoteUploadFile() {
  const [title, setTitle] = useState("Alice Router — Upload with Attachment");
  const [body, setBody] = useState("<p>Hello from Alice Router with a file attached.</p>");
  const [file, setFile] = useState(null);
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
      const formData = new FormData();
      formData.append("title", title);
      formData.append("body", body);
      if (file) formData.append("file", file);

      const r = await safeFetchJson("/api/onenote/page-create-file", {
        method: "POST",
        body: formData,
      });

      setResult(typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2));
    } catch (err) {
      setResult(`ERROR: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1>Alice OneNote Router — File Upload</h1>
      <p>Uploads a page in your default section with an attachment.</p>

      <div style={{ marginBottom: 12 }}>
        <a href="/api/auth/login?state=/onenote-upload-file">Sign in</a>
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

        <div style={{ marginBottom: 10 }}>
          <label>Attach file</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <button type="submit" disabled={submitting} style={{ padding: "8px 12px" }}>
          {submitting ? "Submitting…" : "Create Page (with Attachment)"}
        </button>
      </form>

      <pre style={{ background: "#f6f8fa", padding: 12, border: "1px solid #e5e7eb", marginTop: 12, whiteSpace: "pre-wrap" }}>
        {result}
      </pre>
    </div>
  );
}
