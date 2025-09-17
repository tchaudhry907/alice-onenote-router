// pages/debug/diagnostics.js
// One-stop Diagnostics with all the buttons you need on one page.

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
  const [msg, setMsg] = useState('Idle');

  async function copyGraphAccessToken() {
    setMsg('Fetching token from KV…');
    try {
      const r = await fetch('/api/onenote/access-token?fmt=txt', { cache: 'no-store' });
      const t = await r.text();
      if (!r.ok || !t || t === 'NO_TOKEN') {
        setMsg('No Graph access_token in KV. Seed first.');
        return;
      }
      await navigator.clipboard.writeText(t);
      setMsg(`Copied Graph access_token (eyJ… len=${t.length})`);
    } catch (e) {
      setMsg('Copy failed: ' + e.message);
    }
  }

  async function seedFromClipboardSmart() {
    setMsg('Reading clipboard…');
    try {
      const clip = await navigator.clipboard.readText();
      // Try to find eyJ JWT first
      const mJwt = clip.match(/\b(eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)\b/);
      if (mJwt) {
        setMsg('Seeding JWT token…');
        const r = await fetch('/api/onenote/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: mJwt[1] }),
        });
        const j = await r.json();
        setMsg(r.ok ? 'Seeded JWT OK.' : 'Seed error: ' + JSON.stringify(j));
        return;
      }
      // Else try refresh_token (starts with M.C… often)
      const mRefresh = clip.match(/"refresh_token"\s*:\s*"([^"]+)"/) || clip.match(/\b(M\.C[^\s"]+)\b/);
      const refreshToken = mRefresh?.[1];
      if (refreshToken) {
        setMsg('Seeding via refresh_token…');
        const r = await fetch('/api/onenote/seed-any', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const j = await r.json();
        setMsg(r.ok ? 'Refreshed + seeded OK.' : 'Refresh/seed error: ' + JSON.stringify(j));
        return;
      }
      setMsg('Clipboard has neither a JWT (eyJ…) nor refresh_token.');
    } catch (e) {
      setMsg('Seed failed: ' + e.message);
    }
  }

  async function probe() {
    setMsg('Probing Graph /me…');
    try {
      const r = await fetch('/api/onenote/probe', { cache: 'no-store' });
      const j = await r.json();
      setMsg(r.ok && j.ok ? 'Probe OK: 200' : 'Probe failed: ' + JSON.stringify(j));
    } catch (e) {
      setMsg('Probe error: ' + e.message);
    }
  }

  async function logoutAll() {
    setMsg('Logging out (cookies + KV)…');
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      const j = await r.json();
      // Best-effort client clears
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      document.cookie.split(';').forEach(c => {
        const n = c.split('=')[0].trim();
        if (n) document.cookie = `${n}=; Path=/; Max-Age=0; SameSite=Lax`;
      });
      setMsg(r.ok ? 'Logged out. Now click Force Microsoft Login.' : 'Logout error: ' + JSON.stringify(j));
    } catch (e) {
      setMsg('Logout failed: ' + e.message);
    }
  }

  async function clearServerTokens() {
    setMsg('Clearing server tokens…');
    try {
      const r = await fetch('/api/onenote/token-clear', { method: 'POST' });
      const j = await r.json();
      setMsg(r.ok ? 'Server tokens cleared.' : 'Clear error: ' + JSON.stringify(j));
    } catch (e) {
      setMsg('Clear failed: ' + e.message);
    }
  }

  async function createTestPage() {
    setMsg('Creating OneNote test page…');
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
      setMsg(r.ok ? `Create OK` : 'Create failed: ' + JSON.stringify(j));
    } catch (e) {
      setMsg('Create failed: ' + e.message);
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', padding: 24, lineHeight: 1.5 }}>
      <h1>Alice Diagnostics</h1>

      <h3>Tokens</h3>
      <div style={row}>
        <button style={btn} onClick={copyGraphAccessToken}>📋 Copy Graph access_token (from KV)</button>
        <button style={btn} onClick={seedFromClipboardSmart}>🌱 Seed Server from Clipboard (JWT or refresh_token)</button>
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

      <p style={{ marginTop: 16, color: '#555' }}><b>Status:</b> {msg}</p>

      <hr style={{ margin: '20px 0' }} />
      <ol>
        <li>Click <b>🚪 Logout</b> if things feel stuck.</li>
        <li>Click <b>🌱 Seed Server from Clipboard</b> (copy either full tokens JSON containing <code>refresh_token</code> or copy the actual JWT that starts with <code>eyJ</code>).</li>
        <li>Click <b>🧪 Probe Graph /me</b>. If OK, you’re good to log pages.</li>
      </ol>
    </div>
  );
}
