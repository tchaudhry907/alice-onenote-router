// pages/test.js
import { useState } from "react";

export default function TestPage() {
  const [notebookId, setNotebookId] = useState("");
  const [sectionId, setSectionId] = useState("");

  const callApi = async (endpoint, method = "GET") => {
    try {
      const res = await fetch(endpoint, { method, credentials: "include" });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const uploadTestPage = async () => {
    try {
      const res = await fetch("/api/onenote/upload", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Test Page from Alice Router",
          content: "<p>Hello from the Alice Router test dashboard 🚀</p>",
          notebookId: notebookId || undefined,
          sectionId: sectionId || undefined,
        }),
      });
      const data = await res.json();
      alert("Upload result:\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div style={{ fontFamily: "Arial", padding: "2rem" }}>
      <h1>Alice OneNote Router – Test Dashboard</h1>

      <h2>Auth</h2>
      <button onClick={() => (window.location.href = "/api/auth/login")}>
        Login
      </button>
      <button onClick={() => callApi("/api/auth/logout", "POST")}>
        Logout
      </button>

      <h2>Debug</h2>
      <button onClick={() => callApi("/api/debug/hello2")}>
        Test /api/debug/hello2
      </button>
      <button onClick={() => callApi("/api/ok")}>Test /api/ok</button>

      <h2>OneNote</h2>
      <label>
        Notebook ID:{" "}
        <input
          type="text"
          value={notebookId}
          onChange={(e) => setNotebookId(e.target.value)}
          placeholder="Leave empty for default"
          style={{ width: "400px" }}
        />
      </label>
      <br />
      <label>
        Section ID:{" "}
        <input
          type="text"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          placeholder="Leave empty for default"
          style={{ width: "400px" }}
        />
      </label>
      <br />
      <button onClick={uploadTestPage} style={{ marginTop: "1rem" }}>
        Upload Test Page to OneNote
      </button>
    </div>
  );
}
