// pages/debug/diagnostics.js
// Single page with all controls + live output pane.
// Buttons:
//  • Refresh Tokens
//  • Seed Server from Clipboard (auto-detects JWT or refresh_token)
//  • Probe Graph /me
//  • Logout (clear cookies + KV)
//  • Clear Server Tokens
//  • View Tokens JSON
//  • Create Test Page (Food & Nutrition – Meals)

import { useState } from 'react';

const btn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #ccc',
  background: '#f7f7f7',
  cursor: 'pointer',
};

const row = { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 };

export default function Diagnostics() {
  const [status, setStatus] = useState('Idle');
  const [log, setLog] = useState([]);

  function append(name, payload) {
    setLog((prev) => [
      { ts: new Date().toLocaleTimeString(), name, payload },
      ...prev.slice(0, 199),
    ]);
  }

  async function refreshTokens() {
    setStatus('Refreshing tokens…');
    try {
      const r = await fetch('/api/debug/tokens?refresh=1', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      append('Refresh Tokens', j);
      setStatus('Refresh done.');
    } catch (e) { setStatus('Refresh failed'); append('Refresh Tokens (error)', e.message); }
  }

  async function seedFromClipboardSmart() {
    setStatus('Reading clipboard…');
    try {
      const clip = await navigator.clipboard.readText();

      // Try to locate a JWT (eyJ…)
      const mJwt = clip.match(/\b(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)\b/);
      if (mJwt) {
        setStatus('Seeding JWT…');
        const r = await fetch('/api/onenote/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: mJwt[1] }),
        });
        const j = await r.json();
        append('Seed JWT', j);
        setStatus(r.ok ? 'Seeded JWT OK.' : 'Seed error.');
        return;
      }

      // Fallback: try to locate a refresh_token (from the JSON dump)
      const mRefresh = clip.match(/"refresh_token"\s*:\s*"([^"]+)"/) || clip.match(/\b(M\.C[^\s"]+)\b/);
      const refreshToken = mRefresh?.[1];
      if (refreshToken) {
        setStatus('Seeding via refresh_token…');
        const r = await fetch('/api/onenote/seed-any', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const j = await r.json();
        append('Seed via refresh_token', j);
        setStatus(r.ok ? 'Refreshed + seeded OK.' : 'Refresh/seed error.');
        return;
      }

      setStatus('Clipboard had neither a JWT nor refresh_token.');
      append('Seed from Clipboard', { error: 'No JWT or refresh_token found in clipboard' });
    } catch (e) { setStatus('Seed failed'); append('Seed from Clipboard (error)', e.message); }
  }

  async function probe() {
    setStatus('Probing Graph /me…');
    try {
      const r = await fetch('/api/onenote/probe', { cache: 'no-store' });
      const j = await r.json();
      append('Probe /me', j);
      setStatus(r.ok && j.ok ? 'Probe OK: 200' : 'Probe failed');
    } catch (e) { setStatus('Probe error'); append('Probe /me (error)', e.message); }
  }

  async function logoutAll() {
    setStatus('Logging out…');
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      const j = await r.json();
      append('Logout', j);

      // Best-effort client clears
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      document.cookie.split(';').forEach(c => {
        const n = c.split('=')[0].trim();
        if (n) document.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax`;
      });

      setStatus('Logged out. Click Force Microsoft Login if needed.');
    } catch (e) { setStatus('Logout failed'); append('Logout (error)', e.message); }
  }

  async function clearServerTokens() {
    setStatus('Clearing server tokens…');
    try {
      const r = await fetch('/api/onenote/token-clear', { method: 'POST' });
      const j = await r.json();
      append('Token Clear', j);
      setStatus('Server tokens cleared.');
    } catch (e) { setStatus('Clear failed'); append('Token Clear (error)', e.message); }
  }

  async function createTestPage() {
    setStatus('Creating test page…');
    try {
      const r = await fetch('/api/onenote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          act: 'create',
          notebookName: 'AliceChatGPT',
          sectionName: 'Food and Nutrition – Meals',
          title: `[FOOD] Smoke test (${new Date().toLocaleString()})`,
          html: 'ok',
        }),
      });
      const j = await r.json();
      append('Create Page', j);
      setStatus(r.ok ? 'Create OK' : 'Create failed');
    } catch (e) { setStatus('Create failed'); append('Create Page (error)', e.message); }
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 24, lineHeight: 1.5 }}>
      <h1>Alice Diagnostics</h1>

      <h3>Tokens</h3>
      <div style={row}>
        <button style={btn} onClick={refreshTokens}>🔄 Refresh Tokens</button>
        <button style={btn} onClick={seedFromClipboardSmart}>🌱 Seed Server from Clipboard</button>
        <button style={btn} onClick={probe}>🧪 Probe Graph /me</button>
        <a href="/api/debug/tokens?full=1" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>🔎 View Tokens JSON</a>
      </div>

      <h3 style={{ marginTop: 24 }}>Session</h3>
      <div style={row}>
        <button style={btn} onClick={logoutAll}>🚪 Logout (clear cookies + KV)</button>
        <button style={btn} onClick={clearServerTokens}>🧹 Clear Server Tokens</button>
        <a href="/api/onenote/token-peek" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>👀 Token Peek</a>
      </div>

      <h3 style={{ marginTop: 24 }}>OneNote</h3>
      <div style={row}>
        <button style={btn} onClick={createTestPage}>📝 Create Test Page (Food & Nutrition – Meals)</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Status</h3>
      <p><b>{status}</b></p>

      <h3>Output</h3>
      <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee', width: 120 }}>Time</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee', width: 180 }}>Action</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {log.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{row.ts}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3' }}>{row.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f3f3', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap' }}>
                  {typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload, null, 2)}
                </td>
              </tr>
            ))}
            {log.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 12, color: '#888' }}>No output yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <hr style={{ marginTop: 24 }} />
      <ol>
        <li>Click <b>🔄 Refresh Tokens</b>.</li>
        <li>Copy either your tokens JSON (it contains <code>refresh_token</code>) or a raw JWT (starts with <code>eyJ</code>) to clipboard.</li>
        <li>Click <b>🌱 Seed Server from Clipboard</b>.</li>
        <li>Click <b>🧪 Probe Graph /me</b>. If OK, you’re ready to log pages.</li>
      </ol>
    </div>
  );
}
