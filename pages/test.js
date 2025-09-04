// pages/test.js

export default function TestPage() {
  const callApi = async (endpoint, method = "GET") => {
    try {
      const res = await fetch(endpoint, { method, credentials: "include" });
      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
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
      <button onClick={() => callApi("/api/onenote/upload", "POST")}>
        Upload Test Page
      </button>
    </div>
  );
}
