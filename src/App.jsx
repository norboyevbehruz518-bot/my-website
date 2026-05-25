import { useState, useRef, useEffect } from "react";
import { processInput } from "./mathEngine";
import "./App.css";

const SUGGESTIONS = [
  "6 * 7 + 42",
  "(100 - 37) * 2.5",
  "pifagor formulasi",
  "doira yuzi",
  "kvadrat tenglama",
  "15 % 4",
];

function Message({ msg }) {
  if (msg.role === "user") {
    return (
      <div className="msg-row user-row">
        <div className="bubble user-bubble">{msg.text}</div>
      </div>
    );
  }

  const { data } = msg;

  if (!data) {
    return (
      <div className="msg-row ai-row">
        <div className="ai-avatar">∑</div>
        <div className="bubble ai-bubble error-bubble">
          Savolingizni tushunmadim. Masalan: <code>6*7+42</code> yoki{" "}
          <code>pifagor formulasi</code>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-row ai-row">
      <div className="ai-avatar">∑</div>
      <div className="bubble ai-bubble">
        {data.type === "math" && (
          <>
            <div className="result-label">Natija</div>
            <div className="result-expr">{data.expression}</div>
            <div className="result-value">= {data.result}</div>
          </>
        )}
        {data.type === "formula" && (
          <>
            <div className="result-label">Formula</div>
            <div className="formula-box">{data.formula}</div>
            <div className="formula-desc">{data.desc}</div>
          </>
        )}
        {data.type === "unknown" && (
          <span className="error-text">
            Tushunmadim. Matematik ifoda yoki formula nomi kiriting.
          </span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function handleSend(text) {
    const val = (text !== undefined ? text : input).trim();
    if (!val) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: val }]);
    setThinking(true);
    setTimeout(() => {
      const data = processInput(val);
      setMessages((prev) => [...prev, { role: "ai", data }]);
      setThinking(false);
    }, 600);
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
      </header>

      <main className="main">
        {isEmpty && (
          <div className="welcome">
            <div className="welcome-glow" />
            <div className="welcome-avatar">∑</div>
            <h1 className="welcome-title">MathAI ga xush kelibsiz</h1>
            <p className="welcome-sub">
              Matematik ifodalar va formulalarni bir zumda yechaman
            </p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isEmpty && (
          <div className="messages">
            {messages.map((m, i) => (
              <Message key={i} msg={m} />
            ))}
            {thinking && (
              <div className="msg-row ai-row">
                <div className="ai-avatar">∑</div>
                <div className="bubble ai-bubble thinking-bubble">
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

      <div className="input-area">
        <div className="input-wrap">
          <input
            ref={inputRef}
            className="chat-input"
            placeholder="Masalan: 6*7+42 yoki pifagor formulasi..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
          />
          <button
            className="send-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || thinking}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="disclaimer">MathAI · Matematik hisob-kitoblar uchun</p>
      </div>
    </div>
  );
}
