import { useState } from "react";

export default function OneNoteUpload() {
  const [title, setTitle] = useState("Alice Router Test");
  const [body, setBody] = useState("<p>Hello from Alice Router.</p>");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function makeXHTML() {
    return `
<html xmlns="http://www.w3.org/1999/xhtml">
  <head><title>${escapeHtml(title || "Untitled")}</title></head>
  <body>
    ${body}
    <p style="color:#666;font-size:12px">Created via Alice Router at ${new Date().toISOString()}</p>
  </body>
</html>`.trim();
  }

  async function createPage(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const html = makeXHTML();
      const r = await fetch("/api/onenote/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The proxy will replace SECTION_ID with your DEFAULT_SECTION_ID env var.
          path: "/me/onenote/sections/SECTION_ID/pages",
          method: "POST",
          headers: { "Content-Type": "application/xhtml+xml" },
          body: html
        }),
      });

      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!r.ok) {
        setError(data.error || text);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Alice OneNote Router — Upload</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Creates a OneNote page in your default section (from <code>DEFAULT_SECTION_ID</code>).
      </p>

      <form onSubmit={createPage} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Body (HTML/XHTML)</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontFamily: "monospace" }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: loading ? "#f0f0f0" : "#fafafa",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Creating…" : "Create Page"}
          </button>

          <a href="/api/auth/login" style={{ alignSelf: "center", color: "#2563eb" }}>
            Sign in again
          </a>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 16, color: "#b91c1c", background: "#fee2e2", padding: 12, borderRadius: 10 }}>
          <strong>Error:</strong> {String(error)}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, background: "#f1f5f9", padding: 12, borderRadius: 10 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Created!</div>
          {"contentUrl" in result ? (
            <p>
              Open in OneNote:&nbsp;
              <a href={result.contentUrl} target="_blank" rel="noreferrer">{result.contentUrl}</a>
            </p>
          ) : null}
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </main>
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
