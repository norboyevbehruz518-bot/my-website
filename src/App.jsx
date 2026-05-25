import { useState, useRef, useEffect, useCallback } from "react";
import { processInput } from "./mathEngine";
import "./App.css";

// ─── Rotating quotes ─────────────────────────────────────────────────
const QUOTES = [
  { text: "Every problem has\na hidden solution", author: null },
  { text: "Mathematics is the\nlanguage of the universe", author: "Galileo Galilei" },
  { text: "Differentiate forward,\nintegrate back", author: null },
  { text: "What lies beyond π?\nEverything.", author: null },
  { text: "Numbers never lie —\nthey only wait for answers", author: null },
  { text: "Euler, Newton, and you —\nunited by one question", author: null },
  { text: "Infinity is just\nanother name for beginning", author: null },
  { text: "eⁱᵖ + 1 = 0\nAll mathematical beauty in one line", author: "Euler's identity" },
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

// ─── Voice hook ──────────────────────────────────────────────────────
function useVoice(onResult) {
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const recogRef = useRef(null);
  const finalRef = useRef("");
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const isSupported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    finalRef.current = "";
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = navigator.language || "en-US";

    recog.onresult = (e) => {
      let text = "";
      for (const result of e.results) text += result[0].transcript;
      finalRef.current = text;
      setLiveText(text);
    };

    recog.onend = () => {
      setRecording(false);
      setLiveText("");
      const text = finalRef.current.trim();
      finalRef.current = "";
      if (text) onResultRef.current(text, true);
    };

    recog.onerror = () => {
      setRecording(false);
      setLiveText("");
      finalRef.current = "";
    };

    recog.start();
    recogRef.current = recog;
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    recogRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  return { recording, liveText, toggle, isSupported };
}

const RE_EXPLAIN_TRIGGERS =
  /\b(tushunmadim|tushunmadi|boshqatan|soddaroq|explain\s*(simpler|again|more\s*simply)?|simpler|simple|qayta|yana\s*bir|aniqroq|soddalar?oq|don'?t\s+understand|one\s+more\s+time|again)\b/i;

// ─── API layer ───────────────────────────────────────────────────────
async function apiSolve(question, mode = "normal") {
  const r = await fetch("/api/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }),
  });
  const json = await r.json();
  if (!json.ok) throw new Error(json.error || "Server error");
  return json.data;
}

async function apiSolveImage(file, question, mode = "normal") {
  const fd = new FormData();
  fd.append("image", file);
  fd.append("question", question || "");
  fd.append("mode", mode);
  const r = await fetch("/api/solve-image", { method: "POST", body: fd });
  const json = await r.json();
  if (!json.ok) throw new Error(json.error || "Server error");
  return json.data;
}

// ─── Local math (pure arithmetic only) ──────────────────────────────
function tryLocal(text) {
  if (!/^[0-9+\-*/^%().\s]+$/.test(text.trim())) return null;
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
      {step.formula && <div className="step-formula">{step.formula}</div>}
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

function ClaudeResult({ data, mode, onReExplain, onFollowUp }) {
  if (!data) return <span className="err-text">Failed to get response.</span>;

  if (data.raw) {
    return (
      <div className="raw-answer">
        <div className="res-tag">Answer</div>
        <p>{data.answer}</p>
        {onReExplain && mode !== "simple" && (
          <button className="reexplain-btn" onClick={onReExplain}>
            🔄 Explain Simpler
          </button>
        )}
      </div>
    );
  }

  const isSimple = mode === "simple";

  return (
    <div className="claude-result">
      {data.topic && <div className="topic-badge">{data.topic}</div>}
      {data.problem && <div className="problem-line">{data.problem}</div>}

      {isSimple && data.simple_idea && (
        <div className="simple-idea-box">
          <span className="idea-label">Core Idea</span>
          <p>{data.simple_idea}</p>
        </div>
      )}

      {data.steps?.length > 0 && (
        <div className="steps-section">
          <div className="steps-header">
            <span className="steps-title-text">
              {isSimple ? "Simple Steps" : "Solution Steps"}
            </span>
            <span className="steps-count">{data.steps.length} steps</span>
          </div>
          {data.steps.map((s) => (
            <StepCard key={s.n} step={s} simple={isSimple} />
          ))}
        </div>
      )}

      {data.answer && (
        <div className="final-answer-box">
          <span className="ans-label">Final Answer</span>
          <div className="ans-val">{data.answer}</div>
        </div>
      )}

      {(data.tip || data.remember) && (
        <div className="tip-box">
          <span className="tip-icon">📌</span>
          <span>{data.tip || data.remember}</span>
        </div>
      )}

      {data.follow_ups?.length > 0 && (
        <div className="follow-ups">
          <div className="fu-label">Explore More</div>
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
            🔄 Explain Simpler
          </button>
        )}
        {isSimple && (
          <div className="simple-badge">✓ Simplified mode</div>
        )}
      </div>
    </div>
  );
}

function LocalResult({ data, onDetailedExplain }) {
  return (
    <div className="local-result">
      <div className="res-tag">Quick Result</div>
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
        ✨ Explain in detail with AI
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
              <img src={msg.image} alt="uploaded" className="user-img" />
            </div>
          )}
          {msg.text && (
            <div className="bubble user-bubble">
              {msg.isVoice && <span className="voice-tag">🎙️ </span>}
              {msg.text}
            </div>
          )}
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
  const [pendingImg, setPendingImg] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("Solving");
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ── Core API caller ─────────────────────────────────────────────
  const callAPI = useCallback(async (question, mode, imageFile = null) => {
    setThinking(true);
    setThinkingText(imageFile ? "Analyzing image" : "Solving");
    try {
      let data;
      if (imageFile) {
        data = await apiSolveImage(imageFile, question, mode);
      } else {
        data = await apiSolve(question, mode);
      }
      setMessages((prev) => [
        ...prev,
        { role: "ai", type: "claude", data, mode, srcQuestion: question, srcFile: imageFile },
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
  async function handleSend(text, isVoice = false) {
    const val = (text !== undefined ? text : input).trim();
    if (!val && !pendingImg) return;

    const imgSnapshot = pendingImg;
    setInput("");
    setPendingImg(null);

    if (!imgSnapshot && RE_EXPLAIN_TRIGGERS.test(val)) {
      const last = [...messages]
        .reverse()
        .find((m) => m.role === "ai" && m.type === "claude");
      if (last) {
        setMessages((prev) => [...prev, { role: "user", text: val, isVoice }]);
        await callAPI(last.srcQuestion, "simple", last.srcFile);
        return;
      }
    }

    setMessages((prev) => [
      ...prev,
      { role: "user", text: val, image: imgSnapshot?.preview || null, isVoice },
    ]);

    if (imgSnapshot) {
      await callAPI(val, "normal", imgSnapshot.file);
      return;
    }

    const local = tryLocal(val);
    if (local) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", type: "local", data: local, srcQuestion: val },
      ]);
      return;
    }

    await callAPI(val, "normal");
  }

  const { recording, liveText, toggle: toggleVoice, isSupported: voiceSupported } =
    useVoice(handleSend);

  function handleFollowUp(text) {
    handleSend(text);
  }

  function handleReExplain(msg) {
    setMessages((prev) => [...prev, { role: "user", text: "Explain simpler" }]);
    callAPI(msg.srcQuestion, "simple", msg.srcFile);
  }

  function handleDetailedExplain(msg) {
    const q = msg.srcQuestion || msg.data?.expression;
    setMessages((prev) => [...prev, { role: "user", text: `${q} — explain in detail` }]);
    callAPI(q, "normal");
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImg({ file, preview: ev.target.result });
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
      <header className="header">
        <div className="logo">
          <span className="logo-icon">∑</span>
          <span className="logo-text">MathAI</span>
        </div>
        <span className="header-tag">Math AI Agent</span>
      </header>

      <main className="main">
        {isEmpty && (
          <div className="welcome">
            <div className="welcome-glow" />
            <div className="welcome-avatar">∑</div>
            <RotatingQuote />
            <div className="upload-hint">
              <span className="hint-icon">📷</span>
              Upload a math photo, speak, or type below
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
        {pendingImg && (
          <div className="img-preview-wrap">
            <img src={pendingImg.preview} alt="preview" className="img-preview" />
            <button
              className="img-remove"
              onClick={() => setPendingImg(null)}
              title="Remove image"
            >
              ×
            </button>
            <span className="img-preview-label">Image attached</span>
          </div>
        )}

        {recording && (
          <div className="recording-indicator">
            <div className="waveform">
              <span /><span /><span /><span /><span />
            </div>
            <span className="rec-label">Listening — speak your problem...</span>
          </div>
        )}

        <div className={`input-wrap${recording ? " input-wrap--recording" : ""}`}>
          <button
            className="img-btn"
            onClick={() => fileRef.current?.click()}
            title="Upload image"
            disabled={recording}
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
            placeholder={recording ? "" : "Ask anything in math..."}
            value={recording ? liveText : input}
            onChange={(e) => !recording && setInput(e.target.value)}
            onKeyDown={!recording ? handleKey : undefined}
            readOnly={recording}
            autoFocus
          />

          {voiceSupported && (
            <button
              className={`mic-btn${recording ? " recording" : ""}`}
              onClick={toggleVoice}
              title={recording ? "Stop recording" : "Voice input"}
              disabled={thinking}
            >
              {recording ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M5 10a7 7 0 0014 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}

          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={(!input.trim() && !pendingImg) || thinking || recording}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="disclaimer">
          MathAI · Upload a photo, speak, or type · Responds in your language
        </p>
      </div>
    </div>
  );
}
