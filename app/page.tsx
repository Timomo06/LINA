"use client";

/**
 * LINA Chat-Seite (/lina)
 * Identisch zur Hauptseite, mit eigenem Pfad.
 */

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function LinaPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "m1", role: "assistant", content: "Hi, ich bin LINA. Wie kann ich dir heute helfen? 😊" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  function toApiHistory(ms: Msg[]) {
    return ms.map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendMessage() {
    if (!canSend) return;

    const userMsg: Msg = { id: "u" + Date.now(), role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/lina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          history: toApiHistory(messages),
        }),
      });

      let replyText = "";
      try {
        const data = await res.json();
        replyText =
          (typeof data?.reply === "string" && data.reply.trim()) ||
          (await res.text()) ||
          "Ich habe gerade keine Antwort gefunden.";
      } catch {
        replyText = "Ich konnte die Antwort nicht verarbeiten.";
      }

      const reply: Msg = { id: "a" + Date.now(), role: "assistant", content: replyText };
      setMessages((m) => [...m, reply]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: "e" + Date.now(),
          role: "assistant",
          content:
            "Ups – ich konnte gerade nicht mit der API sprechen. Prüfe bitte, ob /app/api/lina/route.ts existiert und dein OPENAI_API_KEY gesetzt ist.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage();
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.brandLeft}>
          <div style={styles.avatarRing}>
            <img src="/lina-avatar.png" alt="LINA" style={styles.avatarImg} />
          </div>
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontWeight: 600, fontSize: 18 }}>LINA</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Learning Intelligent Network Assistant</div>
          </div>
        </div>
        <div style={styles.online}>
          <span style={styles.dot} />
          online
        </div>
      </header>

      {/* Chat-Container */}
      <main style={styles.main}>
        <div ref={listRef} style={styles.list}>
          {messages.map((m) => (
            <div key={m.id}
                 style={{ display: "flex", gap: 10, padding: "6px 0",
                          justifyContent: m.role === "assistant" ? "flex-start" : "flex-end" }}>
              {m.role === "assistant" && (
                <div style={{ ...styles.avatarRing, width: 28, height: 28, boxShadow: "0 0 16px rgba(61,169,252,.35)" }}>
                  <img src="/lina-avatar.png" alt="LINA" style={styles.avatarImg} />
                </div>
              )}
              <div style={{
                ...styles.bubbleBase,
                ...(m.role === "assistant" ? styles.bubbleLina : styles.bubbleUser),
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 8, padding: "6px 0" }}>
              <span style={{ ...styles.typingDot, animationDelay: "0s" }} />
              <span style={{ ...styles.typingDot, animationDelay: ".2s" }} />
              <span style={{ ...styles.typingDot, animationDelay: ".4s" }} />
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer style={styles.footer}>
        <div style={styles.composer}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frag LINA etwas… (Enter oder ⌘/Ctrl + Enter)"
            style={styles.input}
          />
          <button
            onClick={sendMessage}
            disabled={!canSend}
            style={{
              ...styles.sendBtn,
              opacity: canSend ? 1 : 0.5,
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            Senden
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .6; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Styles ---------- */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "radial-gradient(circle at top center, #0d1b2a 0%, #000000 100%)",
    color: "#e6f1ff",
    position: "relative",
  },
  header: {
    position: "sticky" as const, top: 0,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 12, padding: "16px 20px", backdropFilter: "blur(8px)", zIndex: 2,
  },
  brandLeft: { display: "flex", alignItems: "center", gap: 12 },
  avatarRing: {
    position: "relative", width: 36, height: 36, borderRadius: "50%",
    overflow: "hidden", border: "1px solid rgba(61,169,252,0.4)",
    boxShadow: "0 0 22px rgba(61,169,252,0.35)",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  online: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.8 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#3da9fc", boxShadow: "0 0 12px #3da9fc" },
  main: { flex: 1, display: "flex", justifyContent: "center" },
  list: {
    flex: 1, overflowY: "auto", padding: 16, width: "100%", maxWidth: 900, margin: "0 auto",
    borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)", boxShadow: "0 0 40px rgba(61,169,252,0.2)",
  },
  bubbleBase: { maxWidth: "80%", borderRadius: 14, padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: 1.5 },
  bubbleLina: {
    background: "rgba(14, 32, 53, 0.6)", border: "1px solid rgba(61,169,252,0.3)",
    boxShadow: "0 0 14px rgba(61,169,252,0.15)", color: "#dcefff",
  },
  bubbleUser: { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)", color: "#ffffff" },
  typingDot: { width: 8, height: 8, borderRadius: "50%", background: "#3da9fc", animation: "dotBounce 1.4s infinite ease-in-out" },
  footer: { position: "sticky" as const, bottom: 0, padding: 16, backdropFilter: "blur(8px)", zIndex: 2 },
  composer: {
    maxWidth: 900, margin: "0 auto", display: "flex", gap: 8, alignItems: "center",
    borderRadius: 16, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)",
    padding: 8, boxShadow: "0 6px 24px -6px rgba(61,169,252,0.45)",
  },
  input: { flex: 1, background: "transparent", border: "none", outline: "none", color: "white", padding: "10px 12px", fontSize: 15 },
  sendBtn: { padding: "10px 14px", borderRadius: 12, border: "none", color: "white", background: "linear-gradient(135deg, #40b3ff 0%, #2a7cc9 100%)" },
};
