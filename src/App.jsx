import { useState, useRef, useEffect, useCallback } from "react";
import { processInput } from "./mathEngine";
import "./App.css";

// ─── Rotating quotes ─────────────────────────────────────────────────
const QUOTES = [
  { text: "Har qanday muammo —\nyashirin yechimdir", author: null },
  { text: "Matematika — koinotning\nyashirin tili", author: "Galileo Galilei" },
  { text: "Hosilalab o'ling,\nintegrallab qayting", author: null },
  { text: "π dan keyin nima bor?\nHamma narsa.", author: null },
  { text: "Raqamlar yolg'on gapirmaydi —\nular faqat javob kutishadi", author: null },
  { text: "Euler, Newton va siz —\nbir savolda birlashadi", author: null },
  { text: "Cheksizlik —\nboshlanishning boshqacha nomi", author: null },
  { text: "eⁱᵖ + 1 = 0\nBarcha matematik go'zallik shunda", author: "Euler identiteti" },
];

function RotatingQuote() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 500);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const q = QUOTES[idx];
  return (
    <div className={`rotating-quote ${visible ? "rq-in" : "rq-out"}`}>
      <div className="rq-text">{q.text}</div>
      {q.author && <div className="rq-author">— {q.author}</div>}
    </div>
  );
}

const RE_EXPLAIN_TRIGGERS =
  /\b(tushunmadim|tushunmadi|boshqatan|soddaroq|explain|simpler|simple|qayta|yana\s*bir|aniqroq|soddalar?oq|t\.u\.s\.h\.u\.n\.m\.a\.d\.i\.m)\b/i;

// ─── API layer ───────────────────────────────────────────────────────
async function apiSolve(question, mode = "normal") {
  const r = await fetch("/api/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }),
  });
  const json = await r.json();
  if (!json.ok) throw new Error(json.error || "Server xatosi");
  return json.data;
}

async function apiSolveImage(file, question, mode = "normal") {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("question", question || "");
  fd.append("mode", mode);
  const r = await fetch("/api/solve-image", { method: "POST", body: fd });
  const json = await r.json();
  if (!json.ok) throw new Error(json.error || "Server xatosi");
  return json.data;
}

// ─── Local math (simple arithmetic only) ────────────────────────────
function tryLocal(text) {
  if (!/^[0-9+\-*/^%().\s]+$/.test(text.trim())) return null;
  const { processInput: pi } = { processInput };
  const res = processInput(text);
  if (!res || res.type !== "math") return null;
  return res;
}

// ─── Claude response renderer ────────────────────────────────────────
function StepCard({ step, simple }) {
  return (
    <div className="step-card">
      <div className="step-card-head">
        <span className="step-num">{step.n}</span>
        <span className="step-title">{step.title}</span>
      </div>
      {step.formula && (
        <div className="step-formula">{step.formula}</div>
      )}
      <div className="step-work">{step.work}</div>
      {step.result && (
        <div className="step-result">
          <span className="arrow">→</span> {step.result}
        </div>
      )}
      {simple && step.why && (
        <div className="step-why">
          <span className="why-icon">💡</span> {step.why}
        </div>
      )}
    </div>
  );
}

function ClaudeResult({ data, mode, onReExplain, onDetailedExplain, onFollowUp }) {
  if (!data) return <span className="err-text">Javob olishda xato yuz berdi.</span>;

  if (data.raw) {
    return (
      <div className="raw-answer">
        <div className="res-tag">Javob</div>
        <p>{data.answer}</p>
        {onReExplain && mode !== "simple" && (
          <button className="reexplain-btn" onClick={onReExplain}>
            🔄 Soddaroq tushuntir
          </button>
        )}
      </div>
    );
  }

  const isSimple = mode === "simple";

  return (
    <div className="claude-result">
      {data.topic && <div className="topic-badge">{data.topic}</div>}

      {data.problem && (
        <div className="problem-line">{data.problem}</div>
      )}

      {isSimple && data.simple_idea && (
        <div className="simple-idea-box">
          <span className="idea-label">Asosiy g'oya</span>
          <p>{data.simple_idea}</p>
        </div>
      )}

      {data.steps?.length > 0 && (
        <div className="steps-section">
          <div className="steps-header">
            <span className="steps-title-text">
              {isSimple ? "Sodda qadamlar" : "Yechim qadamlari"}
            </span>
            <span className="steps-count">{data.steps.length} qadam</span>
          </div>
          {data.steps.map((s) => (
            <StepCard key={s.n} step={s} simple={isSimple} />
          ))}
        </div>
      )}

      {data.answer && (
        <div className="final-answer-box">
          <span className="ans-label">Yakuniy Javob</span>
          <div className="ans-val">{data.answer}</div>
        </div>
      )}

      {(data.tip || data.remember) && (
        <div className="tip-box">
          <span className="tip-icon">📌</span>
          <span>{data.tip || data.remember}</span>
        </div>
      )}

      {/* Follow-up suggestions */}
      {data.follow_ups?.length > 0 && (
        <div className="follow-ups">
          <div className="fu-label">Keyingi qadam</div>
          <div className="fu-chips">
            {data.follow_ups
              .filter((f) => typeof f === "string" && f.length > 5)
              .map((f, i) => (
                <button key={i} className="fu-chip" onClick={() => onFollowUp(f)}>
                  {f}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="action-row">
        {!isSimple && (
          <button className="reexplain-btn" onClick={onReExplain}>
            🔄 Soddaroq tushuntir
          </button>
        )}
        {isSimple && (
          <div className="simple-badge">✓ Soddalashtirilgan rejim</div>
        )}
      </div>
    </div>
  );
}

function LocalResult({ data, onDetailedExplain }) {
  return (
    <div className="local-result">
      <div className="res-tag">Tez hisob</div>
      {data.steps?.length > 0 && (
        <div className="local-steps">
          {data.steps.map((s, i) => (
            <div key={i} className="local-step-row">
              <span className="ls-label">{s.label}</span>
              <span className="ls-expr">{s.expr}</span>
              <span className="ls-eq">= {s.result}</span>
            </div>
          ))}
        </div>
      )}
      <div className="local-answer">
        <span className="res-expr">{data.expression}</span>
        <span className="res-val">= {data.result}</span>
      </div>
      <button className="explain-btn" onClick={onDetailedExplain}>
        ✨ AI bilan batafsil tushuntir
      </button>
    </div>
  );
}

// ─── Message ─────────────────────────────────────────────────────────
function Message({ msg, onReExplain, onDetailedExplain, onFollowUp }) {
  if (msg.role === "user") {
    return (
      <div className="msg-row user-row">
        <div className="user-content">
          {msg.image && (
            <div className="user-img-wrap">
              <img src={msg.image} alt="yuklangan" className="user-img" />
            </div>
          )}
          {msg.text && <div className="bubble user-bubble">{msg.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-row ai-row">
      <div className="ai-avatar">∑</div>
      <div className="bubble ai-bubble">
        {msg.type === "claude" && (
          <ClaudeResult
            data={msg.data}
            mode={msg.mode}
            onReExplain={() => onReExplain(msg)}
            onDetailedExplain={() => onDetailedExplain(msg)}
            onFollowUp={onFollowUp}
          />
        )}
        {msg.type === "local" && (
          <LocalResult
            data={msg.data}
            onDetailedExplain={() => onDetailedExplain(msg)}
          />
        )}
        {msg.type === "error" && (
          <span className="err-text">⚠️ {msg.text}</span>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingImg, setPendingImg] = useState(null); // {file, preview}
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("Yechilmoqda");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Core API caller ─────────────────────────────────────────────
  const callAPI = useCallback(async (question, mode, imageFile = null) => {
    setThinking(true);
    setThinkingText(imageFile ? "Rasm o'rganilmoqda" : "Yechilmoqda");
    try {
      let data;
      if (imageFile) {
        data = await apiSolveImage(imageFile, question, mode);
      } else {
        data = await apiSolve(question, mode);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          type: "claude",
          data,
          mode,
          srcQuestion: question,
          srcFile: imageFile,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", type: "error", text: e.message },
      ]);
    } finally {
      setThinking(false);
    }
  }, []);

  // ── Send ────────────────────────────────────────────────────────
  async function handleSend(text) {
    const val = (text !== undefined ? text : input).trim();
    if (!val && !pendingImg) return;

    const imgSnapshot = pendingImg;
    setInput("");
    setPendingImg(null);

    // Detect "tushunmadim" → re-explain last Claude message
    if (!imgSnapshot && RE_EXPLAIN_TRIGGERS.test(val)) {
      const last = [...messages]
        .reverse()
        .find((m) => m.role === "ai" && m.type === "claude");
      if (last) {
        setMessages((prev) => [
          ...prev,
          { role: "user", text: val },
        ]);
        await callAPI(last.srcQuestion, "simple", last.srcFile);
        return;
      }
    }

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: val,
        image: imgSnapshot?.preview || null,
      },
    ]);

    if (imgSnapshot) {
      await callAPI(val, "normal", imgSnapshot.file);
      return;
    }

    // Try local first (pure arithmetic only)
    const local = tryLocal(val);
    if (local) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", type: "local", data: local, srcQuestion: val },
      ]);
      return;
    }

    // Everything else → Claude
    await callAPI(val, "normal");
  }

  // ── Follow-up chip click ────────────────────────────────────────
  function handleFollowUp(text) {
    handleSend(text);
  }

  // ── Re-explain (simple mode) ────────────────────────────────────
  function handleReExplain(msg) {
    setMessages((prev) => [
      ...prev,
      { role: "user", text: "Soddaroq tushuntir" },
    ]);
    callAPI(msg.srcQuestion, "simple", msg.srcFile);
  }

  // ── Detailed explain (from local result) ─────────────────────────
  function handleDetailedExplain(msg) {
    const q = msg.srcQuestion || msg.data?.expression;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `${q} — batafsil tushuntir` },
    ]);
    callAPI(q, "normal");
  }

  // ── Image select ────────────────────────────────────────────────
  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) =>
      setPendingImg({ file, preview: ev.target.result });
    reader.readAsDataURL(file);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">∑</span>
          <span className="logo-text">MathAI</span>
        </div>
        <span className="header-tag">Matematik AI Agent</span>
      </header>

      {/* Main */}
      <main className="main">
        {isEmpty && (
          <div className="welcome">
            <div className="welcome-glow" />
            <div className="welcome-avatar">∑</div>
            <RotatingQuote />
            <div className="upload-hint">
              <span className="hint-icon">📷</span>
              Masala rasmini yuklang yoki pastda yozing
            </div>
          </div>
        )}

        {!isEmpty && (
          <div className="messages">
            {messages.map((m, i) => (
              <Message
                key={i}
                msg={m}
                onReExplain={handleReExplain}
                onDetailedExplain={handleDetailedExplain}
                onFollowUp={handleFollowUp}
              />
            ))}
            {thinking && (
              <div className="msg-row ai-row">
                <div className="ai-avatar">∑</div>
                <div className="bubble ai-bubble thinking-bubble">
                  <span className="thinking-text">{thinkingText}</span>
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input area */}
      <div className="input-area">
        {/* Image preview */}
        {pendingImg && (
          <div className="img-preview-wrap">
            <img src={pendingImg.preview} alt="preview" className="img-preview" />
            <button
              className="img-remove"
              onClick={() => setPendingImg(null)}
              title="Rasmni olib tashlash"
            >
              ×
            </button>
            <span className="img-preview-label">Rasm yuklandi</span>
          </div>
        )}

        <div className="input-wrap">
          {/* Image upload button */}
          <button
            className="img-btn"
            onClick={() => fileRef.current?.click()}
            title="Rasm yuklash"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />

          <input
            className="chat-input"
            placeholder="Masalangizni yozing..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />

          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={(!input.trim() && !pendingImg) || thinking}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="disclaimer">
          MathAI · Rasm yuklang yoki "Tushunmadim" deb yozing
        </p>
      </div>
    </div>
  );
}
