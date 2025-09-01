// pages/journal.js
// Simple UI to post diary entries to OneNote (AliceChatGPT → Inbox)
// via /api/graph/journal-post (which you already added).

import { useState } from "react";

export default function Journal() {
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [status, setStatus] = useState("");
  const [resp, setResp]   = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("Saving…");
    setResp(null);
    try {
      const r = await fetch("/api/graph/journal-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined, // if blank, API will use YYYY-MM-DD
          body: body,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setStatus("Error");
        setResp(j);
        return;
      }
      setStatus("Saved ✓");
      setResp(j);
      setBody(""); // clear after success
    } catch (err) {
      setStatus("Network error");
      setResp({ error: String(err) });
    }
  }

  return (
    <main style={{maxWidth: 720, margin: "40px auto", padding: 20, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto"}}>
      <h1>Journal → OneNote (Inbox)</h1>

      <form onSubmit={onSubmit} style={{display:"grid", gap:12}}>
        <label>
          <div>Title (optional — defaults to today)</div>
          <input
            value={title}
            onChange={e=>setTitle(e.target.value)}
            placeholder="Daily Log 2025-09-01"
            style={{width:"100%", padding:10, fontSize:16}}
          />
        </label>

        <label>
          <div>Body (required)</div>
          <textarea
            value={body}
            onChange={e=>setBody(e.target.value)}
            placeholder="Type your entry…"
            rows={8}
            style={{width:"100%", padding:10, fontSize:16}}
            required
          />
        </label>

        <button type="submit" style={{padding:"10px 14px", fontSize:16, cursor:"pointer"}}>Save to OneNote</button>
      </form>

      <div style={{marginTop:12, color:"#555"}}>{status}</div>

      {resp && (
        <pre style={{marginTop:16, background:"#f6f8fa", padding:12, borderRadius:8, overflow:"auto"}}>
{JSON.stringify(resp, null, 2)}
        </pre>
      )}

      <hr style={{margin:"24px 0"}} />

      <div style={{display:"grid", gap:8}}>
        <a href="/api/auth/login">Re-sign in (if 401)</a>
        <a href="/api/debug/show-cookies">Show cookies (debug)</a>
        <a href="/api/graph/pages?sectionId=0-824A10198D31C608!scfd7de0686df4aa1bc663dd4e7769585&top=25&select=id,title,createdDateTime,lastModifiedDateTime,contentUrl">
          List recent Inbox pages
        </a>
      </div>
    </main>
  );
}
