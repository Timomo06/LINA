"use client";

/**
 * LINA Chat (/lina)
 * - Canvas-Wellen (Sinus, full-screen, fixiert)
 * - Weiche Übergänge Idle <-> Denken (lerp), beim Denken moderates Tempo
 * - Auto-Scroll bis zur letzten Nachricht
 * - Enter = senden | Shift+Enter = neue Zeile
 * - Mobile Fix: Eingabe nie verdeckt (fixed Footer + Safe-Area) & Button-Logik
 */

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; content: string };

const ACCENT = "#90adc3";
const BASE_FS = 18;
const BIG_FS = "1.14rem";
const CHIP_FS = 16;

/* -------- Waves (Canvas) mit weichen Übergängen -------- */
function WavesBackground({ thinking }: { thinking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const ampRef = useRef(6);
  const speedRef = useRef(0.025);
  const alphaRef = useRef(0.2);

  const target = () => ({
    amp: thinking ? 16 : 6,
    speed: thinking ? 0.06 : 0.022,
    alpha: thinking ? 0.42 : 0.2,
  });
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;
    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      const tgt = target();
      ampRef.current = lerp(ampRef.current, tgt.amp, 0.08);
      speedRef.current = lerp(speedRef.current, tgt.speed, 0.08);
      alphaRef.current = lerp(alphaRef.current, tgt.alpha, 0.08);

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(247,250,252,1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const amp = ampRef.current;
      const alpha = alphaRef.current;

      const waves = [
        { amp: amp * 1.0, freq: 2.6, width: 3.0, alpha: alpha * 1.0 },
        { amp: amp * 0.85, freq: 2.2, width: 2.2, alpha: alpha * 0.85 },
        { amp: amp * 0.7, freq: 1.8, width: 1.8, alpha: alpha * 0.75 },
        { amp: amp * 0.55, freq: 1.4, width: 1.5, alpha: alpha * 0.65 },
      ] as const;

      const midY = h * 0.6;
      const spacing = h * 0.1;

      waves.forEach((wv, i) => {
        const y0 = midY + (i - 1.5) * spacing;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const y =
            y0 + Math.sin((x / w) * Math.PI * wv.freq + t * (2 + i * 0.2)) * wv.amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = hexToRgba(ACCENT, wv.alpha);
        ctx.lineWidth = wv.width;
        ctx.lineCap = "round";
        ctx.stroke();
      });

      t += speedRef.current;
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [thinking]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
}

function hexToRgba(hex: string, a = 1) {
  const m = hex.replace("#", "");
  const bigint = parseInt(
    m.length === 3 ? m.split("").map((c) => c + c).join("") : m,
    16
  );
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/* -------- Page -------- */
export default function LinaPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m1",
      role: "assistant",
      content: "Hi, ich bin LINA. Wie kann ich dir heute helfen? 😊",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Quick-Suggestions Verhalten
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  // Dynamischer Bottom-Padding, damit auf Mobile nichts verdeckt wird
  const [bottomPad, setBottomPad] = useState(120); // Fallback

  // Mobile-Erkennung (nur fürs Layout; Design bleibt gleich)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // VisualViewport: Footer oberhalb Tastatur halten (iOS fix)
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) {
      // Fallback: nutze Footer-Höhe + Safe-Area
      const update = () => {
        const h = footerRef.current?.offsetHeight ?? 100;
        setBottomPad(h + 24);
      };
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const onVVChange = () => {
      const footerH = footerRef.current?.offsetHeight ?? 100;
      // Platz = Footer + 24 + Safe-Area unten
      const safe = Number(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--safe-bottom")
          .replace("px", "")
      );
      setBottomPad(footerH + 24 + (safe || 0));
    };
    onVVChange();
    vv.addEventListener("resize", onVVChange);
    vv.addEventListener("scroll", onVVChange);
    window.addEventListener("resize", onVVChange);
    return () => {
      vv.removeEventListener("resize", onVVChange);
      vv.removeEventListener("scroll", onVVChange);
      window.removeEventListener("resize", onVVChange);
    };
  }, []);

  // Auto-scroll bis ganz nach unten
  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      setTimeout(() => (el.scrollTop = el.scrollHeight), 60);
    });
  };
  useEffect(scrollToBottom, [messages, loading, suggestionsDismissed]);

  // Auto-resize textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "0px";
    taRef.current.style.height =
      Math.min(160, taRef.current.scrollHeight) + "px";
  }, [input]);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );
  const toApiHistory = (ms: Msg[]) =>
    ms.map((m) => ({ role: m.role, content: m.content }));

  async function sendMessage() {
    if (!canSend) return;

    const userMsg: Msg = {
      id: "u" + Date.now(),
      role: "user",
      content: input.trim(),
    };
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

      const reply: Msg = {
        id: "a" + Date.now(),
        role: "assistant",
        content: replyText,
      };
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

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestionTexts = [
    "Welche Social-Media-Pakete passen zu einem lokalen Handwerksbetrieb?",
    "Kannst du mir 3 Reels-Ideen für diese Woche vorschlagen?",
    "Wie läuft eine Website-Erstellung bei euch ab?",
    "Ich habe ca. 500–800€ Budget/Monat – was empfiehlt ihr kurz?",
  ];

  const handleSuggestionClick = (text: string, idx: number) => {
    setSelectedSuggestion(idx);
    setSuggestionsDismissed(true); // alle anderen weg
    setInput(text); // Text in Composer übernehmen
    // Scroll nach unten, damit Composer sichtbar bleibt
    scrollToBottom();
  };

  return (
    <div style={styles.page}>
      <WavesBackground thinking={loading} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.brandLeft}>
          <div style={styles.avatarRing}>
            <img src="/lina-avatar.png" alt="LINA" style={styles.avatarImg} />
          </div>
        </div>
        <div style={styles.online}>
          <span style={styles.dot} />
          online
        </div>
      </header>

      {/* Chat */}
      <main style={{ ...styles.main, paddingBottom: bottomPad }}>
        <div ref={listRef} style={styles.list}>
          {/* einmalig: ausgewählter Chip als „ausgewählt“-Badge */}
          {selectedSuggestion !== null && (
            <div style={{ margin: "6px 0 2px 0" }}>
              <button
                disabled
                style={{
                  ...styles.suggestionBtn,
                  opacity: 0.7,
                  cursor: "default",
                }}
              >
                {suggestionTexts[selectedSuggestion]}
              </button>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                justifyContent:
                  m.role === "assistant" ? "flex-start" : "flex-end",
              }}
            >
              {m.role === "assistant" && (
                <div
                  style={{
                    ...styles.avatarRing,
                    width: 30,
                    height: 30,
                    boxShadow: `0 0 16px ${ACCENT}55`,
                  }}
                >
                  <img src="/lina-avatar.png" alt="LINA" style={styles.avatarImg} />
                </div>
              )}
              <div
                style={{
                  ...styles.bubbleBase,
                  ...(m.role === "assistant"
                    ? styles.bubbleLina
                    : styles.bubbleUser),
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, padding: "6px 0" }}>
              <span style={{ ...styles.typingDot, animationDelay: "0s" }} />
              <span style={{ ...styles.typingDot, animationDelay: ".18s" }} />
              <span style={{ ...styles.typingDot, animationDelay: ".36s" }} />
            </div>
          )}
        </div>
      </main>

      {/* Composer (Desktop: sticky; Mobile: fixed über Tastatur) */}
      <footer
        ref={footerRef}
        style={{
          ...styles.footer,
          ...(isMobile
            ? {
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: "calc(18px + var(--safe-bottom, 0px))",
                zIndex: 3,
              }
            : {}),
        }}
      >
        {!suggestionsDismissed && (
          <div style={styles.suggestions}>
            {suggestionTexts.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionClick(s, i)}
                style={styles.suggestionBtn}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={styles.composer}>
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (e.target.value.length > 0 && !suggestionsDismissed) {
                setSuggestionsDismissed(true); // Tippen -> alle weg
              }
            }}
            onKeyDown={onKeyDown}
            placeholder="Schreib mir einfach… (Enter: senden · Shift+Enter: Zeile)"
            rows={1}
            style={styles.textarea}
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

        <div
          style={{
            textAlign: "center",
            marginTop: 10,
            fontSize: 13,
            opacity: 0.75,
            color: "#334155",
          }}
        >
          Tipp: <b>Enter</b> zum Senden · <b>Shift+Enter</b> für neue Zeile
        </div>
      </footer>

      {/* CSS-Variablen für Safe-Area & 100dvh */}
      <style>{`
        :root { font-size: ${BASE_FS}px; --safe-bottom: env(safe-area-inset-bottom); }
        @keyframes dotBounce{0%,80%,100%{transform:translateY(0);opacity:.6}40%{transform:translateY(-4px);opacity:1}}
        html, body { height: 100%; }
        body { min-height: 100dvh; }
      `}</style>
    </div>
  );
}

/* ---------- Styles ---------- */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    color: "#0f172a",
  },
  header: {
    position: "sticky" as const,
    top: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 22px",
    backdropFilter: "blur(6px)",
    zIndex: 2,
  },
  brandLeft: { display: "flex", alignItems: "center", gap: 12 },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    overflow: "hidden",
    border: `1px solid ${ACCENT}66`,
    boxShadow: `0 0 18px ${ACCENT}44`,
    background: "#fff",
  },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover" },
  online: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: 0.8 },
  dot: { width: 9, height: 9, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` },

  main: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    padding: "0 18px",
    position: "relative",
    zIndex: 1,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    flex: 1,
    overflowY: "auto",
    padding: "16px 0",
    maxWidth: 960,
    margin: "0 auto",
  },
  bubbleBase: {
    maxWidth: "80%",
    borderRadius: 18,
    padding: "16px 18px",
    whiteSpace: "pre-wrap",
    lineHeight: 1.65,
    fontSize: BIG_FS,
  },
  bubbleLina: {
    background: "rgba(239,246,255,0.98)",
    border: `1px solid ${ACCENT}88`,
    color: "#0f172a",
  },
  bubbleUser: { background: "#fff", border: `1px solid ${ACCENT}66`, color: "#0f172a" },
  typingDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: ACCENT,
    animation: "dotBounce 1.4s infinite ease-in-out",
  },

  // Desktop: sticky; Mobile wird per Inline-Style zu fixed gemacht
  footer: {
    position: "sticky" as const,
    bottom: 0,
    padding: 18,
    backdropFilter: "blur(6px)",
    zIndex: 2,
    background: "transparent",
  },

  suggestions: {
    maxWidth: 960,
    margin: "0 auto 12px",
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionBtn: {
    fontSize: CHIP_FS,
    padding: "10px 12px",
    borderRadius: 999,
    background: "#fff",
    border: `1px solid ${ACCENT}44`,
    cursor: "pointer",
  },

  composer: {
    maxWidth: 960,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    borderRadius: 14,
    border: `1px solid ${ACCENT}44`,
    background: "#fff",
    padding: 10,
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
  },
  textarea: {
    flex: 1,
    resize: "none" as const,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#0f172a",
    fontSize: BIG_FS,
  },
  sendBtn: {
    height: 60,
    padding: "0 20px",
    borderRadius: 14,
    border: `1px solid ${ACCENT}88`,
    background: `linear-gradient(135deg, ${ACCENT}, #6ea0b4)`,
  },
};
