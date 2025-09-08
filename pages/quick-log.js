import { useState } from "react";

export default function QuickLog() {
  const [text, setText] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);

  async function logNow() {
    setBusy(true);
    setOut(null);
    try {
      // Refresh tokens (safe if already fresh)
      const r1 = await fetch("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" } });
      const j1 = await r1.json().catch(() => ({}));
      if (!r1.ok || !j1?.ok) {
        setOut({ ok: false, error: "Token refresh failed", detail: j1 });
        setBusy(false);
        return;
      }

      // Append via existing router endpoint that uses your cookies
      const r2 = await fetch("/api/onenote/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const j2 = await r2.json().catch(() => ({}));
      setOut(j2);
    } catch (e) {
      setOut({ ok: false, error: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1>Quick Log</h1>
      <p>Enter a line to append to today's OneNote daily log.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: 12, fontSize: 16 }}
        placeholder='e.g. "Lunch: turkey wrap 420 cals."'
      />
      <div style={{ marginTop: 12 }}>
        <button onClick={logNow} disabled={busy || !text.trim()} style={{ padding: "10px 16px", fontSize: 16 }}>
          {busy ? "Logging…" : "Log"}
        </button>
      </div>
      {out && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 16, whiteSpace: "pre-wrap" }}>
{JSON.stringify(out, null, 2)}
        </pre>
      )}
    </main>
  );
}
