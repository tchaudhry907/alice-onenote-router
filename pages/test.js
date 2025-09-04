// pages/test.js
import { useState, useMemo } from "react";

export default function TestDashboard() {
  // ---------- state ----------
  const [baseUrl, setBaseUrl] = useState("");
  const [last, setLast] = useState({ when: null, status: null, data: null, text: "" });

  // OneNote/Graph selections
  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [notebookId, setNotebookId] = useState("");
  const [sectionId, setSectionId] = useState("");

  // Redis
  const [redisKey, setRedisKey] = useState("alice:test");
  const [redisVal, setRedisVal] = useState("hello");
  const [redisTTL, setRedisTTL] = useState(60);

  // Generic request form
  const [reqPath, setReqPath] = useState("/api/debug/env");
  const [reqMethod, setReqMethod] = useState("GET");
  const [reqBody, setReqBody] = useState("{\n  \n}");

  const full = (p) => {
    // Allow absolute URLs or join with baseUrl
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    if (!baseUrl) return p;
    return `${baseUrl.replace(/\/+$/,"")}/${p.replace(/^\/+/,"")}`;
  };

  // ---------- utils ----------
  const show = (status, data, text = "") =>
    setLast({ when: new Date().toLocaleString(), status, data, text });

  const call = async (endpoint, method = "GET", bodyObj) => {
    try {
      const res = await fetch(full(endpoint), {
        method,
        credentials: "include",
        headers: bodyObj ? { "Content-Type": "application/json" } : undefined,
        body: bodyObj ? JSON.stringify(bodyObj) : undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
      show(res.status, data, data ? "" : text);
      return { status: res.status, data, text };
    } catch (e) {
      show("error", { error: e.message });
      return { status: "error", data: { error: e.message } };
    }
  };

  const extractOneNoteLink = useMemo(() => {
    const d = last?.data;
    if (!d || typeof d !== "object") return null;
    // Common Graph-style link shapes
    if (d.webUrl) return d.webUrl;
    if (d.links?.oneNoteWebUrl?.href) return d.links.oneNoteWebUrl.href;
    if (d.value && Array.isArray(d.value) && d.value[0]?.webUrl) return d.value[0].webUrl;
    return null;
  }, [last]);

  // ---------- Auth ----------
  const login = () => (window.location.href = full("/api/auth/login"));
  const logout = () => call("/api/auth/logout", "POST");
  const session = () => call("/api/debug/session");
  const tokens = () => call("/api/debug/tokens");

  // ---------- Debug ----------
  const hello2 = () => call("/api/debug/hello2");
  const okGET = () => call("/api/ok", "GET");
  const okPOST = () => call("/api/ok", "POST", { ok: true });
  const envVars = () => call("/api/debug/env");
  const routes = () => call("/api/debug/routes");
  const headers = () => call("/api/debug/headers");
  const cookies = () => call("/api/debug/show-cookies");
  const ping = () => call("/api/debug/ping");
  const health = () => call("/api/health");

  // ---------- Graph / OneNote ----------
  const graphMe = () => call("/api/graph/me");
  const listNotebooks = async () => {
    const { data } = await call("/api/graph/notebooks");
    if (data?.value) setNotebooks(data.value);
  };
  const listSections = async () => {
    let ep = "/api/graph/sections";
    if (notebookId) ep += `?notebookId=${encodeURIComponent(notebookId)}`;
    const { data } = await call(ep);
    if (data?.value) setSections(data.value);
  };
  const openLatestJournal = () => call("/api/graph/open-latest-journal");
  const showGraph = () => call("/api/graph/show-graph");

  // Upload page (simple)
  const [uploadTitle, setUploadTitle] = useState("Test Page from Dashboard");
  const [uploadHtml, setUploadHtml] = useState(
    `<p>Hello from the test dashboard 🚀</p><p>Time: ${new Date().toLocaleString()}</p>`
  );
  const uploadViaUploadEndpoint = () =>
    call("/api/onenote/upload", "POST", {
      title: uploadTitle,
      content: uploadHtml,
      notebookId: notebookId || undefined,
      sectionId: sectionId || undefined,
    });

  // Optional helpers present in your routes
  const appendLast = () =>
    call("/api/onenote/append-last", "POST", { html: "<p>Appended from dashboard ✅</p>" });
  const pageContent = () => call("/api/onenote/page-content");

  // Multipart by sectionId (exists in your routes list)
  const createBySectionMultipart = () =>
    call("/api/graph/page-create-by-sectionid-multipart", "POST", {
      sectionId: sectionId || "",
      title: uploadTitle,
      html: uploadHtml,
    });

  // ---------- Redis ----------
  const redisPing = () => call("/api/redis/ping");
  const redisPing2 = () => call("/api/redis/ping2"); // optional route present
  const redisSet = () =>
    call("/api/redis/set", "POST", {
      key: redisKey,
      value: redisVal,
      ttl: Number(redisTTL) || undefined,
    });
  const redisGet = () => call(`/api/redis/get?key=${encodeURIComponent(redisKey)}`);
  const redisTTLCheck = () => call(`/api/redis/ttl?key=${encodeURIComponent(redisKey)}`);
  const redisExpire = () =>
    call("/api/redis/expire", "POST", { key: redisKey, ttl: Number(redisTTL) || 60 });
  const redisDel = () => call("/api/redis/del", "POST", { key: redisKey });

  // ---------- Queue / misc ----------
  const queueAppend = () =>
    call("/api/queue/append", "POST", { value: { at: Date.now(), note: "hello from dashboard" } });
  const selfTest = () => call("/api/self-test");
  const ingest = () => call("/api/ingest");
  const hello = () => call("/api/hello");

  // ---------- Generic requester ----------
  const sendGeneric = () => {
    let body = undefined;
    if (reqMethod !== "GET" && reqBody.trim()) {
      try {
        body = JSON.parse(reqBody);
      } catch (e) {
        alert("Request body is not valid JSON.");
        return;
      }
    }
    return call(reqPath, reqMethod, body);
  };

  // ---------- UI ----------
  return (
    <div style={styles.wrap}>
      <h1 style={{ marginBottom: 8 }}>Alice OneNote Router — All-in-One Test Dashboard</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        One page to test auth, debug, Graph/OneNote, Redis, and generic API calls.
      </p>

      <section style={styles.card}>
        <h2>0) Base URL (optional)</h2>
        <p style={{ marginTop: 0 }}>
          Leave blank to use same origin. If testing from a different domain, set your deploy base
          URL (e.g. <code>https://alice-onenote-router.vercel.app</code>).
        </p>
        <input
          style={styles.input}
          placeholder="https://your-deployment.vercel.app"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </section>

      <section style={styles.card}>
        <h2>1) Auth</h2>
        <div style={styles.row}>
          <button onClick={login}>Login (Microsoft)</button>
          <button onClick={logout}>Logout</button>
          <button onClick={session}>Show Session</button>
          <button onClick={tokens}>Show Tokens</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2>2) Debug & Health</h2>
        <div style={styles.row}>
          <button onClick={hello2}>/api/debug/hello2</button>
          <button onClick={okGET}>/api/ok (GET)</button>
          <button onClick={okPOST}>/api/ok (POST)</button>
          <button onClick={envVars}>/api/debug/env</button>
          <button onClick={routes}>/api/debug/routes</button>
          <button onClick={headers}>/api/debug/headers</button>
          <button onClick={cookies}>/api/debug/show-cookies</button>
          <button onClick={ping}>/api/debug/ping</button>
          <button onClick={health}>/api/health</button>
          <button onClick={hello}>/api/hello</button>
          <button onClick={selfTest}>/api/self-test</button>
          <button onClick={ingest}>/api/ingest</button>
          <button onClick={showGraph}>/api/graph/show-graph</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2>3) OneNote / Graph</h2>
        <div style={styles.row}>
          <button onClick={graphMe}>/api/graph/me</button>
          <button onClick={openLatestJournal}>Open Latest Journal</button>
          <button onClick={listNotebooks}>List Notebooks</button>
          <button onClick={listSections}>List Sections</button>
        </div>

        {notebooks?.length > 0 && (
          <>
            <h3>Notebooks</h3>
            <ul style={styles.list}>
              {notebooks.map((nb) => (
                <li key={nb.id} style={styles.li}>
                  <b>{nb.displayName}</b> <code style={styles.code}>{nb.id}</code>
                  <button style={styles.smallBtn} onClick={() => setNotebookId(nb.id)}>
                    Select
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {sections?.length > 0 && (
          <>
            <h3>Sections</h3>
            <ul style={styles.list}>
              {sections.map((s) => (
                <li key={s.id} style={styles.li}>
                  <b>{s.displayName}</b> <code style={styles.code}>{s.id}</code>
                  <button style={styles.smallBtn} onClick={() => setSectionId(s.id)}>
                    Select
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <p style={{ margin: 0 }}>
            Selected Notebook: <code style={styles.code}>{notebookId || "Default"}</code>
          </p>
          <p style={{ margin: "4px 0 12px" }}>
            Selected Section: <code style={styles.code}>{sectionId || "Default"}</code>
          </p>

          <label style={styles.label}>Title</label>
          <input
            style={styles.input}
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
          <label style={styles.label}>HTML Content</label>
          <textarea
            style={styles.textarea}
            rows={6}
            value={uploadHtml}
            onChange={(e) => setUploadHtml(e.target.value)}
          />

          <div style={styles.row}>
            <button onClick={uploadViaUploadEndpoint}>Upload via /api/onenote/upload</button>
            <button onClick={createBySectionMultipart} disabled={!sectionId}>
              Create via /api/graph/page-create-by-sectionid-multipart
            </button>
            <button onClick={appendLast}>/api/onenote/append-last</button>
            <button onClick={pageContent}>/api/onenote/page-content</button>
          </div>

          {extractOneNoteLink && (
            <div style={{ marginTop: 8 }}>
              <a href={extractOneNoteLink} target="_blank" rel="noreferrer">
                Open last OneNote webUrl →
              </a>
            </div>
          )}
        </div>
      </section>

      <section style={styles.card}>
        <h2>4) Redis</h2>
        <div style={styles.row}>
          <button onClick={redisPing}>/api/redis/ping</button>
          <button onClick={redisPing2}>/api/redis/ping2</button>
        </div>

        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>Key</label>
            <input style={styles.input} value={redisKey} onChange={(e) => setRedisKey(e.target.value)} />
          </div>
          <div>
            <label style={styles.label}>TTL (seconds)</label>
            <input
              style={styles.input}
              type="number"
              value={redisTTL}
              onChange={(e) => setRedisTTL(e.target.value)}
            />
          </div>
        </div>
        <label style={styles.label}>Value</label>
        <input style={styles.input} value={redisVal} onChange={(e) => setRedisVal(e.target.value)} />

        <div style={styles.row}>
          <button onClick={redisSet}>SET</button>
          <button onClick={redisGet}>GET</button>
          <button onClick={redisTTLCheck}>TTL</button>
          <button onClick={redisExpire}>EXPIRE</button>
          <button onClick={redisDel}>DEL</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2>5) Queue / Misc</h2>
        <div style={styles.row}>
          <button onClick={queueAppend}>/api/queue/append</button>
          <button onClick={() => (window.location.href = full("/journal"))}>Open /journal page</button>
          <button onClick={() => (window.location.href = full("/health-check"))}>Open /health-check page</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2>6) Generic Request</h2>
        <div style={styles.grid2}>
          <div>
            <label style={styles.label}>Path or URL</label>
            <input
              style={styles.input}
              value={reqPath}
              onChange={(e) => setReqPath(e.target.value)}
              placeholder="/api/debug/env or https://…"
            />
          </div>
          <div>
            <label style={styles.label}>Method</label>
            <select style={styles.input} value={reqMethod} onChange={(e) => setReqMethod(e.target.value)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>PATCH</option>
              <option>DELETE</option>
            </select>
          </div>
        </div>
        <label style={styles.label}>JSON Body (for non-GET)</label>
        <textarea
          style={styles.textarea}
          rows={6}
          value={reqBody}
          onChange={(e) => setReqBody(e.target.value)}
        />
        <div style={styles.row}>
          <button onClick={sendGeneric}>Send Request</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2>Last Response</h2>
        <div style={styles.responseBox}>
          <div style={styles.responseBar}>
            <span>Status: <b>{String(last.status ?? "")}</b></span>
            <span>Time: {last.when || "-"}</span>
            <button
              style={styles.smallBtn}
              onClick={() => {
                const txt = last.data ? JSON.stringify(last.data, null, 2) : last.text || "";
                navigator.clipboard.writeText(txt || "");
              }}
            >
              Copy
            </button>
          </div>
          <pre style={styles.pre}>
{last.data ? JSON.stringify(last.data, null, 2) : (last.text || "—")}
          </pre>
        </div>
        {extractOneNoteLink && (
          <p style={{ marginTop: 8 }}>
            OneNote link:{" "}
            <a href={extractOneNoteLink} target="_blank" rel="noreferrer">
              {extractOneNoteLink}
            </a>
          </p>
        )}
      </section>

      <footer style={{ opacity: 0.6, fontSize: 12, marginTop: 24 }}>
        Tip: if you’re testing from a different domain, set “Base URL” at the top so buttons hit the right deployment.
      </footer>
    </div>
  );
}

const styles = {
  wrap: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    padding: "24px",
    lineHeight: 1.35,
    maxWidth: 1100,
    margin: "0 auto",
  },
  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
  },
  row: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 8,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  textarea: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  label: { display: "block", fontSize: 13, opacity: 0.8, margin: "12px 0 6px" },
  list: { margin: "8px 0", paddingLeft: 18 },
  li: { margin: "6px 0" },
  smallBtn: {
    marginLeft: 8,
    padding: "4px 8px",
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
  code: {
    background: "#f3f4f6",
    padding: "2px 6px",
    borderRadius: 6,
    marginLeft: 6,
    fontSize: 12,
  },
  responseBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  responseBar: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 14,
  },
  pre: {
    margin: 0,
    padding: 12,
    maxHeight: 360,
    overflow: "auto",
    background: "#fff",
    fontSize: 13,
  },
};
