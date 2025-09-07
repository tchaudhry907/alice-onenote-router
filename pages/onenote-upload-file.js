// /pages/onenote-upload-file.js
import { useState } from "react";

export default function OneNoteUploadFile() {
  const [title, setTitle] = useState("Alice Router — Upload with Attachment");
  const [body, setBody] = useState("<p>Hello from Alice Router with a file attached.</p>");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult("Submitting...");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("body", body);
    if (file) formData.append("file", file);

    const res = await fetch("/api/onenote/page-create-file", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Alice OneNote Router — File Upload</h1>
      <p>Uploads a page to your default section with the selected file(s) attached.</p>
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
        <div>
          <label>Attach file(s)</label>
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        </div>
        <button type="submit">Create Page (with Attachment)</button>
      </form>
      <div style={{ marginTop: 20 }}>
        <a href="/api/auth/login?state=/onenote-upload-file">Sign in</a>
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
