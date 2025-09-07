// /pages/onenote-upload.js
import { useState } from "react";

export default function OneNoteUpload() {
  const [title, setTitle] = useState("Alice Router — Upload Test");
  const [body, setBody] = useState("<p>Hello from Alice Router!</p>");
  const [result, setResult] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult("Submitting...");

    const res = await fetch("/api/onenote/page-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Alice OneNote Router — Upload</h1>
      <p>Creates a OneNote page in your default section.</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
        </div>
        <div>
          <label>Body [HTML/XHTML]</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            style={{ width: "100%", marginBottom: 10 }}
          />
        </div>
        <button type="submit">Create Page</button>
      </form>
      <div style={{ marginTop: 20 }}>
        <a href="/api/auth/login?state=/onenote-upload">Sign in</a>
      </div>
      <pre
        style={{
          background: "#f0f0f0",
          padding: 10,
          border: "1px solid #ccc",
          marginTop: 10,
        }}
      >
        {result}
      </pre>
    </div>
  );
}
