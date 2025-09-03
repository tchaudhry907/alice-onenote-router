// pages/onenote-upload-file.js
import { useState } from "react";

export default function OneNoteUploadFile() {
  const [title, setTitle] = useState("Alice Router — Upload with Attachment");
  const [body, setBody] = useState("<p>Hello from Alice Router with a file attached.</p>");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    try {
      const fd = new FormData(e.currentTarget);
      const r = await fetch("/api/onenote/upload", { method: "POST", body: fd });
      const text = await r.text();
      setResult(`Status ${r.status}\n\n` + text);
    } catch (err) {
      setResult("Error: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Alice OneNote Router — File Upload</h1>
      <p>Uploads a page to your default section (from <code>DEFAULT_SECTION_ID</code>) with the selected file(s) attached.</p>

      <form onSubmit={onSubmit} encType="multipart/form-data" style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Title</div>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Body (HTML/XHTML)</div>
          <textarea name="body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Attach file(s)</div>
          <input name="file" type="file" multiple />
          <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
            Tip: You can attach PDFs, images, etc. Each file is embedded as an <code>&lt;object data-attachment=…&gt;</code>.
          </div>
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: loading ? "#f0f0f0" : "#fafafa" }}>
            {loading ? "Uploading…" : "Create Page with Attachment(s)"}
          </button>
          <a href="/api/auth/login" style={{ alignSelf: "center", color: "#2563eb" }}>Sign in again</a>
        </div>
      </form>

      {result && (
        <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#f8fafc", padding: 12, borderRadius: 10 }}>
{result}
        </pre>
      )}
    </main>
  );
}
