// pages/debug/diagnostics.js
// Unified diagnostics page to aggregate all our debug endpoints in one view.

export async function getServerSideProps(ctx) {
  const { req } = ctx;

  // Build absolute base URL that works on Vercel + locally
  const proto =
    req.headers["x-forwarded-proto"]?.toString().split(",")[0] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}`;

  async function jget(path) {
    try {
      const r = await fetch(`${base}${path}`, {
        headers: {
          cookie: req.headers.cookie || "",
        },
      });
      const text = await r.text();
      // Try JSON first; if not JSON, return raw text to display error bodies.
      try {
        return { ok: r.ok, status: r.status, data: JSON.parse(text) };
      } catch {
        return { ok: r.ok, status: r.status, data: text };
      }
    } catch (e) {
      return { ok: false, status: 0, data: String(e) };
    }
  }

  const [env, session, tokens, headers, cookies] = await Promise.all([
    jget("/api/debug/env"),
    jget("/api/debug/session"),
    jget("/api/debug/tokens"),
    jget("/api/debug/headers"),
    jget("/api/debug/show-cookies"),
  ]);

  // Redact obvious secrets/tokens if present
  function redact(obj) {
    const mask = (s) =>
      typeof s === "string" && s.length > 12
        ? s.slice(0, 4) + "…" + s.slice(-4)
        : s;

    function walk(v) {
      if (v === null || v === undefined) return v;
      if (Array.isArray(v)) return v.map(walk);
      if (typeof v === "object") {
        const out = {};
        for (const k of Object.keys(v)) {
          const low = k.toLowerCase();
          if (
            low.includes("token") ||
            low.includes("secret") ||
            low.includes("password") ||
            low.includes("cookie")
          ) {
            out[k] = mask(v[k]);
          } else {
            out[k] = walk(v[k]);
          }
        }
        return out;
      }
      return v;
    }
    return walk(obj);
  }

  // Convenience booleans for UI badges
  const envOk =
    env?.ok &&
    env?.data &&
    typeof env.data === "object" &&
    !!env.data.APP_BASE_URL &&
    !!env.data.MS_CLIENT_ID &&
    !!env.data.REDIRECT_URI &&
    !!env.data.MS_TENANT;

  const sessionOk =
    session?.ok &&
    session?.data &&
    typeof session.data === "object" &&
    (!!session.data.pkce_verifier || !!session.data.code_verifier);

  const tokensOk =
    tokens?.ok &&
    tokens?.data &&
    typeof tokens.data === "object" &&
    !!tokens.data.refresh_token;

  return {
    props: {
      base,
      env: { ...env, data: redact(env.data) },
      session: { ...session, data: redact(session.data) },
      tokens: { ...tokens, data: redact(tokens.data) },
      headers: { ...headers, data: redact(headers.data) },
      cookies: { ...cookies, data: redact(cookies.data) },
      flags: { envOk, sessionOk, tokensOk },
    },
  };
}

export default function Diagnostics({
  base,
  env,
  session,
  tokens,
  headers,
  cookies,
  flags,
}) {
  const Badge = ({ ok, label }) => (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        color: ok ? "#064e3b" : "#7f1d1d",
        background: ok ? "#d1fae5" : "#fee2e2",
        border: `1px solid ${ok ? "#10b981" : "#ef4444"}`,
        marginRight: 8,
      }}
    >
      {label}: {ok ? "OK" : "Missing/Invalid"}
    </span>
  );

  const Block = ({ title, payload }) => (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ margin: "8px 0" }}>{title}</h3>
      <div
        style={{
          fontSize: 12,
          background: "#0b1220",
          color: "#d1d5db",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #1f2937",
          overflowX: "auto",
          whiteSpace: "pre",
        }}
      >
        {typeof payload === "string"
          ? payload
          : JSON.stringify(payload, null, 2)}
      </div>
    </div>
  );

  const link = (href, label) => (
    <a
      href={href}
      style={{
        display: "inline-block",
        marginRight: 12,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #374151",
        textDecoration: "none",
      }}
    >
      {label}
    </a>
  );

  return (
    <div style={{ maxWidth: 960, margin: "24px auto", padding: "0 16px" }}>
      <h1>Alice OneNote Router — Diagnostics</h1>
      <p style={{ marginTop: 8, color: "#4b5563" }}>
        Base URL detected: <code>{base}</code>
      </p>

      <div style={{ margin: "12px 0 24px" }}>
        <Badge ok={flags.envOk} label="Env" />
        <Badge ok={flags.sessionOk} label="Session" />
        <Badge ok={flags.tokensOk} label="Tokens" />
      </div>

      <div style={{ marginBottom: 16 }}>
        {link("/api/auth/login?force=1", "Force Microsoft Login")}
        {link("/api/debug/clear-cookies", "Clear Session/Cookies")}
        {link("/api/auth/logout", "Logout (App)")}
        {link("/", "Home")}
      </div>

      <Block title="Environment (/api/debug/env)" payload={env} />
      <Block title="Session (/api/debug/session)" payload={session} />
      <Block title="Tokens (/api/debug/tokens)" payload={tokens} />
      <Block title="Headers (/api/debug/headers)" payload={headers} />
      <Block title="Cookies (/api/debug/show-cookies)" payload={cookies} />

      <p style={{ color: "#6b7280", fontSize: 12 }}>
        Tip: Use this page in a **Private/Incognito window** when testing auth,
        to avoid stale PKCE/cookies.
      </p>
    </div>
  );
}
