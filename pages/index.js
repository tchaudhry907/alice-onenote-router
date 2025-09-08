import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [todayLog, setTodayLog] = useState("");
  const [todayId, setTodayId] = useState("");
  const [autorefresh, setAutorefresh] = useState(true);

  // Helpers
  const json = async (res) => {
    const t = await res.text();
    try {
      return JSON.parse(t);
    } catch {
      return { ok: false, error: `Non-JSON response`, raw: t };
    }
  };

  const refreshTokens = useCallback(async () => {
    setStatus("Refreshing tokens…");
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    const j = await json(res);
    if (!res.ok || j?.ok === false) {
      setStatus(`❌ Token refresh failed: ${j?.error || res.status}`);
      return false;
    }
    setStatus("✅ Tokens refreshed");
    return true;
  }, []);

  const quickLog = useCallback(
    async (value) => {
      if (!value || !value.trim()) {
        setStatus("Please type something to log.");
        return;
      }
      setBusy(true);
      setStatus("Logging to OneNote…");
      try {
        if (autorefresh) {
          const ok = await refreshTokens();
          if (!ok) {
            setBusy(false);
            return;
          }
        }
        const res = await fetch("/api/onenote/quick-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        });
        const j = await json(res);
        if (!res.ok || j?.ok === false) {
          setStatus(
            `❌ Append failed: ${
              j?.detail?.body || j?.message || j?.error || res.status
            }`
          );
          return;
        }
        setStatus(`✅ Logged to OneNote (page: ${j.pageId || "today"})`);
        setText("");
        await loadToday(); // Refresh the visible log
      } catch (err) {
        setStatus(`❌ Network error: ${String(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [autorefresh, refreshTokens]
  );

  const loadToday = useCallback(async () => {
    setStatus("Loading today’s log…");
    try {
      // Get latest page (our “Daily Log — YYYY-MM-DD”)
      const latestRes = await fetch("/api/onenote/page-latest");
      const latest = await json(latestRes);
      if (!latestRes.ok || latest?.ok === false || !latest?.id) {
        setStatus(
          `❌ Could not find today's page: ${latest?.error || latestRes.status}`
        );
        setTodayLog("");
        setTodayId("");
        return;
      }
      const id = latest.id;
      setTodayId(id);

      // Fetch plain text of that page
      const textRes = await fetch(
        `/api/onenote/page-text?id=${encodeURIComponent(id)}`
      );
      const txt = await json(textRes);
      if (!textRes.ok || txt?.ok === false) {
        setStatus(
          `❌ Could not read page text: ${txt?.error || textRes.status}`
        );
        setTodayLog("");
        return;
      }
      // The API returns { ok:true, text: "..." }
      setTodayLog(txt.text || "");
      setStatus("✅ Loaded today’s log");
    } catch (err) {
      setStatus(`❌ Load failed: ${String(err)}`);
    }
  }, []);

  // Small convenience: Ctrl/Cmd+Enter submits
  const taRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (
        (e.key === "Enter" || e.keyCode === 13) &&
        (e.metaKey || e.ctrlKey)
      ) {
        e.preventDefault();
        quickLog(text);
      }
    };
    const el = taRef.current;
    if (el) el.addEventListener("keydown", handler);
    return () => el && el.removeEventListener("keydown", handler);
  }, [text, quickLog]);

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "32px auto",
        padding: 16,
        fontFamily:
          "-apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h1 style={{ margin: 0 }}>Alice OneNote Router</h1>
      <p style={{ marginTop: 4, color: "#666" }}>
        Type what you ate and press{" "}
        <code>Log</code> (or <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd>). I’ll append it
        to <em>Daily Log — YYYY-MM-DD</em> in OneNote.
      </p>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "1fr auto",
          alignItems: "end",
          marginTop: 12,
        }}
      >
        <textarea
          ref={taRef}
          rows={3}
          placeholder='e.g., "Lunch: turkey wrap 420 cals."'
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          style={{
            width: "100%",
            resize: "vertical",
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
          }}
        />
        <div style={{ display: "grid", gap: 8 }}>
          <button
            onClick={() => quickLog(text)}
            disabled={busy || !text.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #222",
              background: busy ? "#ddd" : "#111",
              color: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {busy ? "Working…" : "Log"}
          </button>

          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              userSelect: "none",
              fontSize: 14,
            }}
            title="Automatically refresh access tokens before each write"
          >
            <input
              type="checkbox"
              checked={autorefresh}
              onChange={(e) => setAutorefresh(e.target.checked)}
            />
            Auto-refresh tokens
          </label>

          <button
            onClick={refreshTokens}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #999",
              background: "#f5f5f5",
              color: "#111",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            Refresh tokens now
          </button>

          <button
            onClick={loadToday}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #999",
              background: "#f5f5f5",
              color: "#111",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            Show today’s log
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, minHeight: 24, color: "#333" }}>
        {status && <div>{status}</div>}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3 style={{ margin: "8px 0" }}>
          Today’s OneNote text{" "}
          {todayId ? (
            <small style={{ color: "#666", fontWeight: 400 }}>
              (page id: {todayId})
            </small>
          ) : null}
        </h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#fafafa",
            border: "1px solid #eee",
            padding: 12,
            borderRadius: 8,
            minHeight: 80,
          }}
        >
{todayLog || "— nothing loaded yet —"}
        </pre>
      </div>

      <div style={{ marginTop: 28, color: "#666", fontSize: 13 }}>
        <details>
          <summary>Troubleshooting</summary>
          <ul>
            <li>
              If you see <code>InvalidAuthenticationToken</code>, click{" "}
              <em>Refresh tokens now</em> (or toggle <em>Auto-refresh</em> on)
              and try again.
            </li>
            <li>
              If you see <code>415</code> on append, we already fixed the
              multipart; try again or refresh tokens once.
            </li>
            <li>
              The buttons call existing routes:{" "}
              <code>/api/onenote/quick-log</code>,{" "}
              <code>/api/onenote/page-latest</code>,{" "}
              <code>/api/onenote/page-text</code>, <code>/api/auth/refresh</code>.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
