// pages/voice.js
// Hands-free Voice Logger: speak → POST /api/log → OneNote.
// Uses Web Speech API (Chrome/Edge/Android/iOS Safari). One tap to start.

import { useEffect, useRef, useState } from "react";

export default function VoiceLogger() {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [lastText, setLastText] = useState("");
  const [status, setStatus] = useState("Idle");
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setStatus("Listening…");
    rec.onerror = (e) => {
      setStatus(`Mic error: ${e.error || "unknown"}`);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      if (status === "Listening…") setStatus("Tap Start to speak");
    };
    rec.onresult = async (evt) => {
      const text = Array.from(evt.results)
        .map(r => r[0]?.transcript || "")
        .join(" ")
        .trim();
      setLastText(text);

      // When result is final, log it.
      if (evt.results[evt.results.length - 1].isFinal && text) {
        setStatus("Logging…");
        try {
          const resp = await fetch("/api/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          const data = await resp.json();
          if (data?.ok) {
            setStatus(`Logged ✅ → ${data.routed?.sectionName || "?"}`);
          } else {
            setStatus(`Log failed ❌ ${data?.error || resp.statusText}`);
          }
        } catch (err) {
          setStatus(`Network error ❌ ${String(err)}`);
        }
      }
    };

    recRef.current = rec;
  }, [status]);

  const start = () => {
    if (!recRef.current) return;
    try {
      recRef.current.start();
      setListening(true);
      setStatus("Listening…");
    } catch {
      // start() can throw if already started; ignore
    }
  };

  return (
    <div style={{
      maxWidth: 680, margin: "40px auto", padding: 24,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    }}>
      <h1 style={{ margin: 0 }}>Voice Log</h1>
      <p style={{ marginTop: 8, opacity: 0.75 }}>
        Say things like <i>“walked 10,000 steps”</i>, <i>“workout upper body 45 min”</i>,
        <i>“pumpkin spice latte 300 calories”</i>. I’ll route it to the correct OneNote section.
      </p>

      {!supported ? (
        <div style={{ color: "#b00020", fontWeight: 600 }}>
          Your browser doesn’t support speech recognition. Use Chrome/Edge/Android or iOS Safari.
        </div>
      ) : (
        <>
          <button
            onClick={start}
            disabled={listening}
            style={{
              fontSize: 18, padding: "14px 22px", borderRadius: 12,
              border: "none", cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.12)"
            }}>
            {listening ? "Listening…" : "Start"}
          </button>

          <div style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
            Status: {status}
          </div>

          {lastText ? (
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 12,
              background: "#f6f6f8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
            }}>
              {lastText}
            </div>
          ) : null}

          <div style={{ marginTop: 20, fontSize: 13, opacity: 0.7 }}>
            Tip: add this page to your phone’s Home Screen for 1-tap logging.
          </div>
        </>
      )}
    </div>
  );
}
