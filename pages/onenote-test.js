// pages/onenote-test.js
import { useEffect, useMemo, useState } from "react";

/**
 * One-stop health/dashboard for Alice OneNote Router.
 * - Auth check (/api/ok)
 * - Redis ping/set/get/ttl (/api/redis/*)
 * - OneNote append to last page (/api/onenote/append-last)
 * - OneNote page content fetch (/api/onenote/page-content?id=...)
 *
 * Usage: visit /onenote-test
 * If not logged in, click "Sign in" first, then "Run All".
 */

export default function OneNoteTest() {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState([]);
  const [lastPageId, setLastPageId] = useState("");
  const [appendSucceeded, setAppendSucceeded] = useState(false);

  const nowStamp = useMemo(() => new Date().toISOString(), []); // just to tag today’s run

  function pushRow(row) {
    setRows((r) => [...r, { id: String(r.length + 1), ...row }]);
  }

  async function fetchJson(url, opts) {
    const r = await fetch(url, opts);
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    return { status: r.status, ok: r.ok, body: parsed ?? text, raw: text, headers: r.headers };
  }

  async function runAll() {
    setRunning(true);
    setRows([]);
    setAppendSucceeded(false);

    // 1) Auth: /api/ok
    pushRow({ step: "Auth", detail: "Checking /api/ok…" });
    const ok = await fetchJson("/api/ok");
    if (!ok.ok) {
      pushRow({ step: "Auth", status: "fail", detail: `GET /api/ok → ${ok.status} ${ok.raw}` });
      setRunning(false);
      return;
    }
    pushRow({ step: "Auth", status: "pass", detail: `GET /api/ok → ${ok.status} ${ok.raw}` });

    // 2) Redis: ping
    pushRow({ step: "Redis", detail: "Pinging /api/redis/ping…" });
    const ping = await fetchJson("/api/redis/ping");
    pushRow({ step: "Redis", status: ping.ok ? "pass" : "fail", detail: `ping → ${ping.status} ${asStr(ping.body)}` });
    if (!ping.ok) return setRunning(false);

    // 3) Redis: set key with TTL & verify
    const tkey = "alice:test:selfcheck";
    pushRow({ step: "Redis", detail: `Setting ${tkey} with ttl=20…` });
    const rset = await fetchJson(`/api/redis/set?key=${encodeURIComponent(tkey)}&value=${encodeURIComponent("OK-"+nowStamp)}&ttl=20`);
    pushRow({ step: "Redis", status: rset.ok ? "pass" : "fail", detail: `set → ${rset.status} ${asStr(rset.body)}` });
    if (!rset.ok) return setRunning(false);

    pushRow({ step: "Redis", detail: `Getting ${tkey}…` });
    const rget = await fetchJson(`/api/redis/get?key=${encodeURIComponent(tkey)}`);
    pushRow({ step: "Redis", status: rget.ok ? "pass" : "fail", detail: `get → ${rget.status} ${asStr(rget.body)}` });
    if (!rget.ok) return setRunning(false);

    pushRow({ step: "Redis", detail: `TTL for ${tkey}…` });
    const rttl = await fetchJson(`/api/redis/ttl?key=${encodeURIComponent(tkey)}`);
    pushRow({ step: "Redis", status: rttl.ok ? "pass" : "fail", detail: `ttl → ${rttl.status} ${asStr(rttl.body)}` });
    if (!rttl.ok) return setRunning(false);

    // 4) Find lastPageId
    pushRow({ step: "OneNote", detail: "Reading last created page id (alice:lastPageId) from Redis…" });
    const last = await fetchJson(`/api/redis/get?key=${encodeURIComponent("alice:lastPageId")}`);
    if (!last.ok || !last.body?.value) {
      pushRow({
        step: "OneNote",
        status: "warn",
        detail:
          `No last page id found. Create one via /onenote-upload-file first. ` +
          `Response → ${last.status} ${asStr(last.body)}`
      });
      setRunning(false);
      return;
    }
    const pid = String(last.body.value);
    setLastPageId(pid);
    pushRow({ step: "OneNote", status: "pass", detail: `Found last page id: ${pid}` });

    // 5) Append to last page
    const sampleHtml = `<p><b>Self-check append</b> — ${escapeHtml(nowStamp)}</p>`;
    pushRow({ step: "OneNote", detail: "Appending to last page via /api/onenote/append-last…" });
    const app = await fetchJson("/api/onenote/append-last", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: sampleHtml })
    });
    // Graph returns 204 No Content on success
    const appendOK = app.status === 204;
    setAppendSucceeded(appendOK);
    pushRow({
      step: "OneNote",
      status: appendOK ? "pass" : "fail",
      detail: `append-last → ${app.status} ${appendOK ? "(OK 204)" : asStr(app.body)}`
    });
    if (!appendOK) return setRunning(false);

    // 6) Fetch page content to confirm route + give a link
    const encoded = encodeURIComponent(pid);
    pushRow({ step: "OneNote", detail: "Fetching page content (HTML)…" });
    const pc = await fetch(`/api/onenote/page-content?id=${encoded}`);
    const pageOk = pc.ok;
    pushRow({
      step: "OneNote",
      status: pageOk ? "pass" : "fail",
      detail: `page-content → ${pc.status} ${pageOk ? "OK" : "Check auth / DEFAULT_SECTION_ID / scopes"}`
    });

    setRunning(false);
  }

  useEffect(() => {
    // Auto-run once on mount for quick checks
    runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webLink = useMemo(() => {
    // We can’t derive the OneNote web link from id alone reliably here,
    // but the upload UI shows it. This page focuses on health + “does it work?”.
    return lastPageId ? `/api/onenote/page-content?id=${encodeURIComponent(lastPageId)}` : "";
  }, [lastPageId]);

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Alice OneNote Router — One-Click Test</h1>

      <div style={styles.actions}>
        <a href="/api/auth/login" style={styles.link}>Sign in</a>
        <a href="/onenote-upload-file" style={styles.link}>Upload new page (with file)</a>
        <button onClick={runAll} disabled={running} style={styles.button}>
          {running ? "Running…" : "Run All Tests"}
        </button>
      </div>

      <div style={styles.panel}>
        <Summary rows={rows} />
        <div style={{ marginTop: 10 }}>
          {lastPageId && (
            <div style={styles.meta}>
              <div><b>lastPageId:</b> <code style={styles.code}>{lastPageId}</code></div>
              <div>
                <b>View HTML:</b>{" "}
                <a href={webLink} target="_blank" rel="noreferrer">{webLink}</a>
              </div>
              {appendSucceeded && (
                <div style={{ color: "#047857", marginTop: 6 }}>
                  ✅ Append succeeded (HTTP 204). Open the HTML link above or your OneNote web link to verify visually.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <details style={styles.details}>
        <summary style={styles.summary}>What this page tests</summary>
        <ul>
          <li><b>Auth:</b> `/api/ok`</li>
          <li><b>Redis:</b> ping / set (with TTL) / get / ttl</li>
          <li><b>OneNote:</b> append to <code>alice:lastPageId</code> (set by your upload UI)</li>
          <li><b>OneNote Content:</b> fetch page HTML via `/api/onenote/page-content`</li>
        </ul>
        <p style={{ color: "#6b7280" }}>
          Tip: if you see “No last page id found”, create a page at <code>/onenote-upload-file</code> first.
        </p>
      </details>
    </main>
  );
}

function Summary({ rows }) {
  if (!rows.length) {
    return <div style={{ color: "#6b7280" }}>No results yet. Click “Run All Tests”.</div>;
  }
  const overall =
    rows.some((r) => r.status === "fail") ? "fail" :
    rows.some((r) => r.status === "warn") ? "warn" : "pass";
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <Badge kind={overall} />
      </div>
      <div style={styles.table}>
        {rows.map((r) => (
          <div key={r.id} style={styles.row}>
            <div style={styles.cellStep}>
              <Badge kind={r.status} />
              <span style={{ marginLeft: 8, fontWeight: 600 }}>{r.step || "-"}</span>
            </div>
            <div style={styles.cellDetail}>
              <pre style={styles.pre}>{r.detail || ""}</pre>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Badge({ kind }) {
  const k = kind || "info";
  const map = {
    pass: { bg: "#ecfdf5", border: "#86efac", fg: "#065f46", text: "PASS" },
    fail: { bg: "#fef2f2", border: "#fca5a5", fg: "#991b1b", text: "FAIL" },
    warn: { bg: "#fffbeb", border: "#fcd34d", fg: "#92400e", text: "WARN" },
    info: { bg: "#eef2ff", border: "#c7d2fe", fg: "#3730a3", text: "INFO" }
  }[k];
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      background: map.bg,
      color: map.fg,
      border: `1px solid ${map.border}`
    }}>
      {map.text}
    </span>
  );
}

function asStr(x) {
  if (x == null) return "null";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

const styles = {
  main: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 1000, margin: "0 auto" },
  h1: { fontSize: 24, margin: 0, marginBottom: 12 },
  actions: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" },
  link: { padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, textDecoration: "none", color: "#2563eb", background: "#f9fafb" },
  button: { padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa", cursor: "pointer" },
  panel: { border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, background: "#fff" },
  table: { display: "grid", gap: 8 },
  row: { display: "grid", gridTemplateColumns: "230px 1fr", gap: 8, alignItems: "start", borderBottom: "1px dashed #e5e7eb", paddingBottom: 8 },
  cellStep: { display: "flex", alignItems: "center" },
  cellDetail: { fontSize: 13, color: "#111827" },
  pre: { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  details: { marginTop: 12, border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#f9fafb" },
  summary: { cursor: "pointer", fontWeight: 600 },
  meta: { marginTop: 6, fontSize: 13 },
  code: { background: "#f3f4f6", padding: "2px 4px", borderRadius: 6 }
};
