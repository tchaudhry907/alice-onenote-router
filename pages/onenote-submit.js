// /pages/onenote-submit.js
import { useState } from "react";

export default function OneNoteSubmit() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("<p></p>");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  function arrayBufferToBase64(ab) {
    const bytes = new Uint8Array(ab);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  async function fileToBase64Obj(f) {
    if (!f) return null;
    const buf = await f.arrayBuffer();
    return { name: f.name, type: f.type || "application/octet-stream", dataBase64: arrayBufferToBase64(buf) };
    // NOTE: Send to /api/onenote/page-create-file (JSON, not multipart)
  }

  async function safeFetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, body: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, body: text }; }
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg("Submitting…");
    try {
      const fileObj = await fileToBase64Obj(file);
      const r = await safeFetchJson("/api/onenote/page-create-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Untitled", body: body || "<p></p>", file: fileObj }),
      });
      if (r.ok && r.body?.links?.oneNoteWebUrl?.href) {
        setMsg(`Created ✅ — open in OneNote Web: ${r.body.links.oneNoteWebUrl.href}`);
      } else {
        setMsg(`Response (${r.status}): ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`);
      }
    } catch (err) {
      setMsg(`ERROR: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", maxWidth: 780, margin: "0 auto" }}>
      <h1>Submit to OneNote</h1>
      <p>Create a new OneNote page (optional attachment). You must be signed in.</p>

      <div style={{ marginBottom: 12 }}>
        <a href="/api/auth/login?state=/onenote-submit">Sign in</a>
        {" · "}
        <a href="/onenote-test">Diagnostics</a>
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 4 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Body (HTML/XHTML)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ width: "100%", padding: 8, marginTop: 4 }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Attachment (optional)</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>

        <button type="submit" disabled={submitting} style={{ padding: "10px 14px" }}>
          {submitting ? "Submitting…" : "Create Page"}
        </button>
      </form>

      {msg && (
        <pre style={{ background: "#f6f8fa", padding: 12, border: "1px solid #e5e7eb", marginTop: 16, whiteSpace: "pre-wrap" }}>
          {msg}
        </pre>
      )}
    </div>
  );
}
