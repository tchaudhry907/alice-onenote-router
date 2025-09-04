// pages/test.js
import { useState } from "react";

export default function TestDashboard() {
  const [result, setResult] = useState("");

  async function callApi(path, method = "GET") {
    try {
      const res = await fetch(path, { method });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>🚀 Alice OneNote Router – Test Dashboard</h1>
      <p>Use these buttons to test your API endpoints after logging in.</p>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={() => callApi("/api/debug/hello2")}>Test hello2</button>
      </div>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={() => callApi("/api/debug/ping")}>Ping</button>
      </div>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={() => callApi("/api/ok")}>Check OK</button>
      </div>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={() => callApi("/api/onenote/upload", "POST")}>
          Upload Test Page to OneNote
        </button>
      </div>

      <pre
        style={{
          marginTop: "2rem",
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "6px",
          whiteSpace: "pre-wrap",
        }}
      >
        {result}
      </pre>
    </div>
  );
}
