import { useEffect, useState } from "react";

export default function HealthCheck() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/health");
      const j = await r.json();
      setData(j);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Optional: auto-refresh every 30s. Comment out if you don't want it.
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  const ok = data?.ok === true;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Alice OneNote Router — Health Check</h1>

      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid #eee",
          background: ok ? "#f0fff4" : "#fff5f5",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: ok ? "#22c55e" : "#ef4444",
          }}
        />
        <strong>Status:</strong>
        <span>{ok ? "OK" : "Degraded / Error"}</span>
        <button
          onClick={load}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fafafa",
            cursor: "pointer",
          }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <pre
        style={{
          background: "#f7f7f7",
          padding: 16,
          borderRadius: 12,
          marginTop: 16,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
{JSON.stringify(data ?? { ok: false, error: error || "loading…" }, null, 2)}
      </pre>

      <p style={{ color: "#666", marginTop: 8 }}>
        API endpoint: <code>/api/health</code>
      </p>
    </main>
  );
}
