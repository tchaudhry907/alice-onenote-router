// pages/debug/session-tools.js
import { useState } from 'react';

export default function SessionTools() {
  const [msg, setMsg] = useState('Ready');

  async function hardLogout() {
    setMsg('Logging out…');
    try {
      // 1) Server-side: clear KV + expire cookies
      const r = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      const j = await r.json();

      // 2) Client-side: nuke localStorage/sessionStorage + visible cookies
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      // Best-effort client cookie clear (non-HttpOnly)
      document.cookie.split(';').forEach(c => {
        const n = c.split('=')[0].trim();
        if (n) document.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax`;
      });

      setMsg(r.ok ? 'Logged out. All tokens/cookies cleared.' : 'Logout error: ' + JSON.stringify(j));
    } catch (e) {
      setMsg('Logout failed: ' + e.message);
    }
  }

  async function clearServerTokens() {
    setMsg('Clearing server tokens…');
    const r = await fetch('/api/onenote/token-clear', { method: 'POST' });
    const j = await r.json();
    setMsg(r.ok ? 'Server tokens cleared.' : 'Clear error: ' + JSON.stringify(j));
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 24 }}>
      <h1>Session Tools</h1>
      <p>Use these to reset everything when tokens get stuck.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={hardLogout} style={btn}>🚪 Logout (clear cookies + KV)</button>
        <button onClick={clearServerTokens} style={btn}>🧹 Clear Server Tokens</button>
        <a href="/debug/diagnostics" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>🧭 Open Diagnostics</a>
        <a href="/api/debug/tokens?full=1" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>🔎 View Tokens JSON</a>
      </div>
      <p style={{ marginTop: 16 }}><b>Status:</b> {msg}</p>
      <hr />
      <ol>
        <li>Click <b>Logout</b>.</li>
        <li>Then open <code>/debug/diagnostics</code> and click <b>Force Microsoft Login</b>.</li>
        <li>Click <b>Refresh Tokens</b> → <b>Seed Server with Tokens</b>.</li>
      </ol>
    </div>
  );
}

const btn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #ccc',
  background: '#f7f7f7',
  cursor: 'pointer'
};
