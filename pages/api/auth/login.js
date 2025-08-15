// pages/auth/login.js
export default function Login() {
  const go = () => {
    window.location.href = "/api/auth/login";
  };
  return (
    <main style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
    }}>
      <div style={{maxWidth: 560, width: "100%", padding: 24}}>
        <h1 style={{margin: 0, fontSize: 28}}>Sign in to OneNote</h1>
        <p style={{marginTop: 8, color: "#666"}}>
          Click continue to sign in with Microsoft.
        </p>
        <button
          onClick={go}
          style={{marginTop: 16, padding: "12px 16px", fontSize: 16,
                  borderRadius: 8, border: "1px solid #ddd", cursor: "pointer"}}
        >
          Continue with Microsoft
        </button>
      </div>
    </main>
  );
}
