// pages/debug/diagnostics.js
import React, { useEffect, useState } from "react";

export default function Diagnostics() {
  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    async function fetchTokens() {
      const res = await fetch("/api/debug/tokens");
      const data = await res.json();
      setTokens(data);
    }
    fetchTokens();
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Diagnostics</h1>
      <h2>Tokens (full, not truncated)</h2>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {tokens ? JSON.stringify(tokens, null, 2) : "Loading..."}
      </pre>
    </div>
  );
}
