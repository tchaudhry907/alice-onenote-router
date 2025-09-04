// pages/test.js
import { useState, useEffect } from "react";

export default function TestPage() {
  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [notebookId, setNotebookId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // Generic API caller
  const callApi = async (endpoint, method = "GET", body) => {
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
      return data;
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // Fetch notebooks
  const fetchNotebooks = async () => {
    const data = await callApi("/api/graph/notebooks");
    if (data && data.value) setNotebooks(data.value);
  };

  // Fetch sections (based on notebookId if provided)
  const fetchSections = async () => {
    let endpoint = "/api/graph/sections";
    if (notebookId) endpoint += `?notebookId=${encodeURIComponent(notebookId)}`;
    const data = await callApi(endpoint);
    if (data && data.value) setSections(data.value);
  };

  // Upload test page
  const uploadTestPage = async () => {
    await callApi("/api/onenote/upload", "POST", {
      title: "Test Page from Alice Router",
      content: "<p>Hello from the Alice Router test dashboard 🚀</p>",
      notebookId: notebookId || undefined,
      sectionId: sectionId || undefined,
    });
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
      <button onClick={() => callApi("/api/debug/env")}>
        Show Env Vars
      </button>
      <button onClick={() => callApi("/api/debug/session")}>
        Show Session
      </button>

      <h2>OneNote – Explore</h2>
      <button onClick={fetchNotebooks}>List Notebooks</button>
      {notebooks.length > 0 && (
        <ul>
          {notebooks.map((nb) => (
            <li key={nb.id}>
              <b>{nb.displayName}</b> – {nb.id}
              <button onClick={() => setNotebookId(nb.id)}>Select</button>
            </li>
          ))}
        </ul>
      )}

      <button onClick={fetchSections}>List Sections</button>
      {sections.length > 0 && (
        <ul>
          {sections.map((sec) => (
            <li key={sec.id}>
              <b>{sec.displayName}</b> – {sec.id}
              <button onClick={() => setSectionId(sec.id)}>Select</button>
            </li>
          ))}
        </ul>
      )}

      <h2>Upload Test Page</h2>
      <p>
        Notebook: <code>{notebookId || "Default"}</code>
        <br />
        Section: <code>{sectionId || "Default"}</code>
      </p>
      <button onClick={uploadTestPage}>Upload Test Page</button>
    </div>
  );
}
