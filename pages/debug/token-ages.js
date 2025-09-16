// pages/debug/token-ages.js
import { useEffect, useState } from "react";

export default function TokenAges() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    try {
      const r = await fetch("/api/auth/token-age", { credentials: "include" });
      const j = await r.json();
      if (!j.ok) setErr(j.error || "Unknown error");
      setData(j);
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(t);
  }, []);

  const nowISO = data?.nowEpoch ? new Date(data.nowEpoch * 1000).toLocaleString() : "";

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1>Token Ages</h1>
      <p>Now: {nowISO}</p>
      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button className="btn" onClick={load}>Reload</button>
        <a className="btn" href="/api/debug/diagnostics">Back to Diagnostics</a>
      </div>

      {err ? <p style={{ color: "#b00020" }}>Error: {err}</p> : null}

      <Card title="Access Token">{renderToken(data?.access_token, "Access")}</Card>
      <Card title="ID Token">{renderToken(data?.id_token, "ID")}</Card>

      <Card title="Raw JSON">
        <pre style={{ whiteSpace: "pre-wrap" }}>{data ? JSON.stringify(data, null, 2) : "—"}</pre>
      </Card>

      <style jsx>{`
        .btn { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; background:#f7f7f9; cursor:pointer; }
        .btn:hover { background:#eee; }
        .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; }
      `}</style>
    </main>
  );
}

function renderToken(t, label) {
  if (!t) return <p>—</p>;
  if (!t.present) return <p>Not present</p>;
  if (!t.jwt) return <p>{label} token is not a decodeable JWT{t.error ? ` (${t.error})` : ""}</p>;

  const secs = t.ttlSeconds ?? 0;
  let bg = "#d1e7dd", text = "#0f5132", msg = `${label} healthy`;
  if (secs <= 0) { bg = "#f8d7da"; text = "#842029"; msg = `${label} expired`; }
  else if (secs < 30 * 60) { bg = "#fff3cd"; text = "#664d03"; msg = `${label} < 30m`; }
  else if (secs < 60 * 60) { bg = "#fff3cd"; text = "#664d03"; msg = `${label} < 60m`; }

  return (
    <>
      <p>
        <span className="badge" style={{ background: bg, color: text, marginRight: 8 }}>{msg}</span>
        Expires: <code>{t.expiresAtISO || "unknown"}</code> · Time left: <strong>{t.ttlHuman || "?"}</strong>
      </p>
      <p style={{ color: "#555" }}>Issued: <code>{t.issuedAtISO || "unknown"}</code></p>
    </>
  );
}

function Card({ title, children }) {
  return (
    <section style={{ marginTop: 16 }}>
      <h3 style={{ margin: "6px 0" }}>{title}</h3>
      <div style={{ background: "#0d1117", color: "#c9d1d9", padding: 12, borderRadius: 6, overflowX: "auto" }}>
        {children}
      </div>
    </section>
  );
}
