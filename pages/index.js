// pages/index.js
import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [todayText, setTodayText] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshTokens() {
    // Safely refresh cookies/KV before any action
    await fetch("/api/auth/refresh", { method: "POST" }).catch(() => {});
  }

  async function logNow() {
    if (!text.trim()) {
      setStatus("Please enter something to log.");
      return;
    }
    setLoading(true);
    setStatus("Refreshing tokens…");
    await refreshTokens();

    setStatus("Saving to OneNote…");
    try {
      const res = await fetch("/api/onenote/quick-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus(`✅ Logged to "${data.title || "Daily Log — today"}"`);
        setText("");
      } else {
        setStatus(`❌ ${data.error || "Failed"} ${data.message ? "— " + data.message : ""}`);
      }
    } catch (e) {
      setStatus(`❌ Network error`);
    } finally {
      setLoading(false);
    }
  }

  async function showToday() {
    setLoading(true);
    setStatus("Refreshing tokens…");
    await refreshTokens();

    setStatus("Fetching today’s page…");
    try {
      // 1) get latest page id
      const latest = await fetch("/api/onenote/page-latest");
      const latestJson = await latest.json();
      if (!latest.ok || !latestJson.ok) {
        setStatus(`❌ Could not find today's page`);
        setLoading(false);
        return;
      }
      // 2) pull plain text
      const url = new URL("/api/onenote/page-text", window.location.origin);
      url.searchParams.set("id", latestJson.id);
      const txtRes = await fetch(url.toString());
      const txtJson = await txtRes.json();
      if (txtRes.ok && txtJson.ok) {
        setTodayText(txtJson.text || "");
        setStatus("✅ Fetched.");
      } else {
        setStatus(`❌ Read failed`);
      }
    } catch {
      setStatus("❌ Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1>Alice OneNote Router — Quick Log</h1>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="log" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
          What do you want to log?
        </label>
        <textarea
          id="log"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g., "Lunch: turkey wrap 420 cals."'
          style={{ width: "100%", padding: 12, fontSize: 16 }}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={logNow} disabled={loading} style={{ padding: "8px 14px" }}>
            {loading ? "Working…" : "Log"}
          </button>
          <button onClick={showToday} disabled={loading} style={{ padding: "8px 14px" }}>
            {loading ? "Working…" : "Show today’s log"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, minHeight: 24 }}>
        {status && <div>{status}</div>}
      </div>

      {todayText && (
        <div style={{ marginTop: 16 }}>
          <h3>Today’s page (plain text)</h3>
          <pre
            style={{
              padding: 12,
              background: "#f6f6f6",
              border: "1px solid #e5e5e5",
              whiteSpace: "pre-wrap",
            }}
          >
            {todayText}
          </pre>
        </div>
      )}
    </main>
  );
}
