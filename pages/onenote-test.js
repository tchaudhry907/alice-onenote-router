// /pages/onenote-test.js
import { useState } from "react";

export default function OneNoteTest() {
  const [output, setOutput] = useState("");

  const runTests = async () => {
    setOutput("Running tests...\n");

    const tests = [
      { name: "Auth", url: "/api/ok" },
      { name: "Auth", url: "/api/redis/ping" },
      { name: "Redis", url: "/api/redis/set?key=alice:test&value=hello" },
      { name: "Redis", url: "/api/redis/get?key=alice:test" },
      { name: "Redis", url: "/api/redis/ttl?key=alice:test" },
      { name: "OneNote", url: "/api/onenote/page-latest" },
    ];

    for (const test of tests) {
      try {
        const res = await fetch(test.url);
        const text = await res.text();
        setOutput((prev) => prev + `\n[${test.name}] ${test.url}\n${text}\n`);
      } catch (err) {
        setOutput((prev) => prev + `\n[${test.name}] ${test.url}\nERROR ${err}\n`);
      }
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Alice OneNote Router — One-Click Test</h1>
      <div style={{ marginBottom: 20 }}>
        <a href="/api/auth/login?state=/onenote-test">Sign in</a> |{" "}
        <a href="/onenote-upload">Upload new page (no file)</a> |{" "}
        <a href="/onenote-upload-file">Upload new page (with file)</a> |{" "}
        <button onClick={runTests}>Run All Tests</button>
      </div>
      <pre
        style={{
          background: "#f0f0f0",
          padding: 10,
          border: "1px solid #ccc",
          maxHeight: 500,
          overflow: "auto",
        }}
      >
        {output}
      </pre>
    </div>
  );
}
