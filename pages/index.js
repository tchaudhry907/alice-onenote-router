import { useState } from "react";

export default function Home() {
  const [output, setOutput] = useState("");

  async function callApi(path, options) {
    try {
      const res = await fetch(path, options);
      const json = await res.json();
      setOutput(JSON.stringify(json, null, 2));
    } catch (err) {
      setOutput("Error: " + err.message);
    }
  }

  async function doPing() {
    await callApi("/api/redis/ping");
  }

  async function doGet() {
    const key = prompt("Enter key to GET", "alice:test");
    if (key) {
      await callApi(`/api/redis/get?key=${encodeURIComponent(key)}`);
    }
  }

  async function doSet() {
    const key = prompt("Enter key to SET", "alice:test");
    const value = prompt("Enter value (will be stored as string/JSON)", "hello world");
    const ttl = prompt("Enter TTL in seconds (optional)", "60");
    const body = { key, value };
    if (ttl && !isNaN(Number(ttl))) body.ttl = Number(ttl);

    await callApi("/api/redis/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function doTTL() {
    const key = prompt("Enter key to check TTL", "alice:test");
    if (key) {
      await callApi(`/api/redis/ttl?key=${encodeURIComponent(key)}`);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Alice OneNote Router — Redis Tester</h1>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button onClick={doPing}>Ping</button>
        <button onClick={doSet}>Set</button>
        <button onClick={doGet}>Get</button>
        <button onClick={doTTL}>TTL</button>
      </div>
      <pre
        style={{
          background: "#f0f0f0",
          padding: "1rem",
          borderRadius: "8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {output || "Click a button to test Redis"}
      </pre>
    </main>
  );
}
