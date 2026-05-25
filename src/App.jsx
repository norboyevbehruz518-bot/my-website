import { useState, useRef, useEffect } from "react";
import { processInput } from "./mathEngine";
import "./App.css";

const SUGGESTIONS = [
  "sin(45) + cos(30)",
  "(3^4 − 2^5) / sqrt(16)",
  "log(1000) * 5!",
  "C(10, 3)",
  "gcd(48, 18)",
  "17 tub sonmi",
  "kosinus teoremasi",
  "hosila qoidalari",
];

// ─── Result renderers ───────────────────────────────────────────────
function Steps({ steps }) {
  if (!steps?.length) return null;
  return (
    <div className="steps-wrap">
      <div className="steps-title">Qadamlar</div>
      {steps.map((s, i) => (
        <div key={i} className="step-row">
          <span className="step-n">{i + 1}</span>
          <div className="step-body">
            {s.label && <span className="step-label">{s.label}</span>}
            <span className="step-expr">{s.expr}</span>
            <span className="step-eq">= {s.result}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultBlock({ data }) {
  if (data.type === "math") {
    return (
      <>
        <div className="res-tag">Natija</div>
        <Steps steps={data.steps} />
        <div className="res-expr">{data.expression}</div>
        <div className="res-val">= {data.result}</div>
        {data.complexity === "complex" && (
          <div className="badge">Murakkab ifoda</div>
        )}
      </>
    );
  }

  if (data.type === "formula") {
    return (
      <>
        <div className="res-tag">Formula</div>
        <div className="formula-box">{data.formula}</div>
        <div className="formula-desc">{data.desc}</div>
      </>
    );
  }

  if (data.type === "quadratic") {
    const eq = `${data.a}x² ${data.b >= 0 ? "+" : ""}${data.b}x ${data.c >= 0 ? "+" : ""}${data.c} = 0`;
    return (
      <>
        <div className="res-tag">Kvadrat Tenglama</div>
        <div className="formula-box">{eq}</div>
        <Steps steps={[
          { label: "Diskriminant", expr: `D = ${data.b}² − 4·${data.a}·${data.c}`, result: String(data.D) },
        ]} />
        {data.roots.length === 0 && (
          <div className="no-roots">D &lt; 0 — haqiqiy ildizlar yo'q</div>
        )}
        {data.roots.map((r, i) => (
          <div key={i} className="root-row">
            <span className="root-label">x{data.roots.length > 1 ? i + 1 : ""}</span>
            <span className="res-val">= {r}</span>
          </div>
        ))}
      </>
    );
  }

  if (data.type === "prime") {
    return (
      <>
        <div className="res-tag">{data.n} — Tub Son Tekshiruvi</div>
        <div className={`prime-badge ${data.isPrime ? "is-prime" : "not-prime"}`}>
          {data.isPrime ? "✓ TUB SON" : "✗ TUB EMAS"}
        </div>
        {!data.isPrime && (
          <div className="formula-desc">
            {data.n} = {data.factorStr}
          </div>
        )}
      </>
    );
  }

  if (data.type === "factorization") {
    return (
      <>
        <div className="res-tag">Tub Ko'paytuvchilarga Ajratish</div>
        <div className="res-expr">{data.n}</div>
        <div className="res-val">= {data.factorStr}</div>
      </>
    );
  }

  if (data.type === "combinatorics") {
    return (
      <>
        <div className="res-tag">{data.comboType === "C" ? "Kombinatsiya" : "Permutatsiya"}</div>
        <div className="formula-box">{data.formula}</div>
      </>
    );
  }

  if (data.type === "special") {
    return (
      <>
        <div className="res-tag">{data.title}</div>
        <Steps steps={data.steps} />
        <div className="res-val">= {data.result}</div>
      </>
    );
  }

  return (
    <span className="error-text">
      Tushunmadim. Matematik ifoda, formula nomi yoki maxsus buyruq kiriting.
    </span>
  );
}

// ─── Message ────────────────────────────────────────────────────────
function Message({ msg }) {
  if (msg.role === "user") {
    return (
      <div className="msg-row user-row">
        <div className="bubble user-bubble">{msg.text}</div>
      </div>
    );
  }

  return (
    <div className="msg-row ai-row">
      <div className="ai-avatar">∑</div>
      <div className="bubble ai-bubble">
        {msg.data ? <ResultBlock data={msg.data} /> : (
          <span className="error-text">
            Tushunmadim. Masalan: <code>sin(45)+cos(30)</code> yoki{" "}
            <code>gcd(48,18)</code>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef(null);

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
    }, 500);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">∑</span>
          <span className="logo-text">MathAI</span>
        </div>
        <span className="header-sub">Matematik AI Agent</span>
      </header>

      <main className="main">
        {isEmpty && (
          <div className="welcome">
            <div className="welcome-glow" />
            <div className="welcome-avatar">∑</div>
            <h1 className="welcome-title">MathAI</h1>
            <p className="welcome-sub">
              Oddiy arifmetikadan trigonometriya, integral, statistika va qadamba-qadam yechimlargacha
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
            {messages.map((m, i) => <Message key={i} msg={m} />)}
            {thinking && (
              <div className="msg-row ai-row">
                <div className="ai-avatar">∑</div>
                <div className="bubble ai-bubble thinking-bubble">
                  <span className="dot" /><span className="dot" /><span className="dot" />
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
            className="chat-input"
            placeholder="sin(45)+cos(30),  gcd(48,18),  kvadrat tenglama..."
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
        <p className="disclaimer">MathAI · Barcha hisob-kitoblar local bajariladi</p>
      </div>
    </div>
  );
}
