import { useEffect, useMemo, useState } from "react";

type ApiResp =
  | { ok: true; pageId?: string; title?: string }
  | { ok: false; error?: string; detail?: any; message?: string };

export default function QuickLog() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Breakfast: chicken crumble with pancakes — 620 cals, 32g protein. #breakfast #home");
  const [status, setStatus] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);
  const [lastTitle, setLastTitle] = useState<string | null>(null);

  const base = useMemo(() => {
    // Works on Vercel and locally
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href);
    return `${u.protocol}//${u.host}`;
  }, []);

  async function callJSON(url: string, init?: RequestInit) {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: `Non-JSON from ${url}`, detail: text } as ApiResp;
    }
  }

  async function bootstrap() {
    setStatus("Warming up…");
    // 1) ping
    await fetch(`${base}/api/ok`, { cache: "no-store" }).catch(() => {});
    // 2) refresh tokens → cookies + KV
    const r = await callJSON(`${base}/api/auth/refresh`, { method: "POST" });
    if ((r as any)?.ok) {
      setStatus("Ready");
      setReady(true);
    } else {
      setStatus(`Auth refresh failed: ${JSON.stringify(r)}`);
    }
  }

  useEffect(() => {
    if (base) bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  async function doLog() {
    if (!ready || !msg.trim()) return;
    setBusy(true);
    setStatus("Logging…");
    const resp = (await callJSON(`${base}/api/onenote/quick-log`, {
      method: "POST",
      body: JSON.stringify({ text: msg.trim() }),
    })) as ApiResp;

    if (resp.ok) {
      setStatus("Logged ✓  (fetching latest page…)");

      // Optional: fetch latest page to confirm id/title
      const latest = await callJSON(`${base}/api/onenote/page-latest`);
      if (latest?.ok) {
        setLastId(latest.id);
        setLastTitle(latest.title);
        setStatus(`Logged ✓  → ${latest.title}`);
      } else {
        setStatus("Logged ✓");
      }
    } else {
      setStatus(`❌ ${resp.error || resp.message || "Append failed"}`);
    }

    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Quick Log → OneNote</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Type a natural note (meal, steps, workout). I’ll refresh tokens and append to your daily OneNote page.
      </p>

      <div style={{ margin: "16px 0", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <label style={{ display: "block", fontSize: 13, color: "#444", marginBottom: 6 }}>Entry</label>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={4}
          placeholder='e.g. "Lunch: turkey wrap 420 cals. #lunch #home"'
          style={{
            width: "100%",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 10,
            fontSize: 15,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            onClick={bootstrap}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Refresh Auth
          </button>
          <button
            onClick={doLog}
            disabled={!ready || busy || !msg.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #0ea5e9",
              background: "#0ea5e9",
              color: "#fff",
              cursor: ready && msg.trim() && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Logging…" : "Log to OneNote"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 14, color: "#222", minHeight: 24 }}>{status}</div>

      {lastId && (
        <div style={{ marginTop: 10, fontSize: 14 }}>
          <div>Latest page: <strong>{lastTitle}</strong></div>
          <div style={{ marginTop: 6 }}>
            <a
              href={`${base}/api/onenote/page-text?id=${encodeURIComponent(lastId)}`}
              target="_blank"
              rel="noreferrer"
            >
              View plain text
            </a>
            {" · "}
            <a
              href={`${base}/api/onenote/page-content?id=${encodeURIComponent(lastId)}`}
              target="_blank"
              rel="noreferrer"
            >
              View raw HTML
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
