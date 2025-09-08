// pages/quick-log.js
import { useState } from "react";

export default function QuickLog() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/onenote/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setMsg(`❌ ${j?.error || "Failed"} ${j?.detail ? JSON.stringify(j.detail) : ""}`);
      } else {
        setMsg(`✅ Logged to "${j.title}".`);
        setText("");
      }
    } catch (e) {
      setMsg(`❌ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function fallbackGet(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      // Fallback path: GET ?text=...
      const url = new URL("/api/onenote/quick-log", location.origin);
      url.searchParams.set("text", text);
      const r = await fetch(url.toString(), { method: "GET" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setMsg(`❌ (GET fallback) ${j?.error || "Failed"} ${j?.detail ? JSON.stringify(j.detail) : ""}`);
      } else {
        setMsg(`✅ (GET fallback) Logged to "${j.title}".`);
        setText("");
      }
    } catch (e) {
      setMsg(`❌ ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Quick Log → OneNote</h1>
      <p>Type a line (e.g., <em>“Breakfast: oatmeal 300 cals.”</em>) and hit Log.</p>

      <form onSubmit={submit}>
        <textarea
          rows={3}
          style={{ width: "100%", padding: 12, fontSize: 16 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your entry…"
        />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={busy || !text.trim()}
            style={{
              padding: "10px 16px",
              fontSize: 16,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Logging…" : "Log (POST)"}
          </button>

          <button
            onClick={fallbackGet}
            disabled={busy || !text.trim()}
            style={{
              padding: "10px 16px",
              fontSize: 16,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            type="button"
            title="Use GET ?text=... in case POST is blocked"
          >
            Log (GET fallback)
          </button>
        </div>
      </form>

      {msg && <pre style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>{msg}</pre>}

      <hr style={{ margin: "24px 0" }} />
      <p>
        Tip: if you see “not authenticated”, open{" "}
        <a href="/debug/diagnostics" target="_blank" rel="noreferrer">
          /debug/diagnostics
        </a>
        , click <strong>Hard Reset + Login</strong>, then come back here.
      </p>
    </div>
  );
}
