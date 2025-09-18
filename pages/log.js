// pages/log.js
import { useState } from 'react';

export default function LogPage() {
  const [text, setText] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true); setOut(null);
    try {
      const r = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const j = await r.json();
      setOut(j);
      // clear the box on success for rapid-fire logging
      if (j?.ok) setText('');
    } catch (e) {
      setOut({ ok: false, error: String(e) });
    }
    setBusy(false);
  }

  const webUrl = out?.page?.links?.oneNoteWebUrl?.href;

  return (
    <div style={{ fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', padding:24, maxWidth:820 }}>
      <h1>Quick Log</h1>
      <p>Type what you did. I’ll route it to the right OneNote section.</p>

      <textarea
        value={text}
        onChange={(e)=>setText(e.target.value)}
        rows={3}
        style={{ width:'100%', padding:12, borderRadius:8, border:'1px solid #ccc' }}
        placeholder='e.g., "walked 10000 steps", "workout upper body 45 min", "ate chicken salad"'
      />

      <div style={{ marginTop:12, display:'flex', gap:12, alignItems:'center' }}>
        <button onClick={submit} disabled={busy}
          style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #ccc', background:'#f7f7f7', cursor:'pointer' }}>
          {busy ? 'Logging…' : 'Log It'}
        </button>
        <a href="/debug/diagnostics" style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #eee', textDecoration:'none' }}>
          Diagnostics
        </a>
        {webUrl && (
          <a href={webUrl} target="_blank" rel="noreferrer"
             style={{ marginLeft:'auto', padding:'10px 14px', borderRadius:10, border:'1px solid #d0e1ff', background:'#eef5ff', textDecoration:'none' }}>
            Open in OneNote ↗
          </a>
        )}
      </div>

      {out && (
        <pre style={{ marginTop:16, background:'#fafafa', padding:12, borderRadius:8, whiteSpace:'pre-wrap', maxHeight:380, overflow:'auto' }}>
{JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
