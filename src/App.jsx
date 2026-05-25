import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { processInput } from "./mathEngine";
import MathGraph from "./MathGraph";
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

// ─── Voice input hook ─────────────────────────────────────────────────
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
      for (const r of e.results) text += r[0].transcript;
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
    recog.onerror = () => { setRecording(false); setLiveText(""); finalRef.current = ""; };
    recog.start();
    recogRef.current = recog;
    setRecording(true);
  }, []);

  const stop = useCallback(() => { recogRef.current?.stop(); recogRef.current = null; }, []);
  const toggle = useCallback(() => { if (recording) stop(); else start(); }, [recording, start, stop]);

  return { recording, liveText, toggle, isSupported };
}

// ─── Video Solution ───────────────────────────────────────────────────
function buildSlides(data) {
  const slides = [];
  if (data.topic || data.problem)
    slides.push({ type: "intro", topic: data.topic, problem: data.problem });
  for (const s of data.steps || []) slides.push({ type: "step", ...s });
  if (data.answer) slides.push({ type: "answer", answer: data.answer });
  if (data.tip || data.remember)
    slides.push({ type: "tip", text: data.tip || data.remember });
  return slides;
}

function getNarration(slide) {
  if (slide.type === "intro")
    return `${slide.topic ? slide.topic + ". " : ""}${slide.problem || "Let's get started."}`;
  if (slide.type === "step") {
    const parts = [`Step ${slide.n}: ${slide.title}.`];
    if (slide.work) parts.push(slide.work);
    if (slide.result) parts.push(`Result: ${slide.result}.`);
    if (slide.why) parts.push(slide.why);
    return parts.join(" ");
  }
  if (slide.type === "answer") return `The final answer is: ${slide.answer}.`;
  if (slide.type === "tip") return slide.text;
  return "";
}

function SlideContent({ slide }) {
  if (slide.type === "intro") return (
    <div className="vs-intro">
      {slide.topic && <div className="vs-topic-tag">{slide.topic}</div>}
      <div className="vs-intro-problem">{slide.problem}</div>
    </div>
  );

  if (slide.type === "step") return (
    <div className="vs-step-slide">
      <div className="vs-step-head">
        <span className="vs-step-num-badge">{slide.n}</span>
        <span className="vs-step-title">{slide.title}</span>
      </div>
      {slide.formula && <div className="vs-step-formula">{slide.formula}</div>}
      <div className="vs-step-work">{slide.work}</div>
      {slide.result && (
        <div className="vs-step-result">
          <span className="vs-arrow">→</span>
          <span className="vs-result-val">{slide.result}</span>
        </div>
      )}
      {slide.why && <div className="vs-step-why">💡 {slide.why}</div>}
    </div>
  );

  if (slide.type === "answer") return (
    <div className="vs-answer-slide">
      <div className="vs-confetti">✦ ✦ ✦</div>
      <div className="vs-ans-eyebrow">Final Answer</div>
      <div className="vs-ans-value">{slide.answer}</div>
    </div>
  );

  if (slide.type === "tip") return (
    <div className="vs-tip-slide">
      <div className="vs-tip-emoji">📌</div>
      <div className="vs-tip-content">{slide.text}</div>
    </div>
  );

  return null;
}

function VideoSolution({ data }) {
  const slides = useMemo(() => buildSlides(data), [data]);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(false);
  const cancelRef = useRef(false);
  const timerRef = useRef(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const stopAll = useCallback(() => {
    cancelRef.current = true;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    clearTimeout(timerRef.current);
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  const speak = useCallback((text, onEnd) => {
    window.speechSynthesis.cancel();
    if (mutedRef.current) {
      const ms = Math.max(1800, text.split(/\s+/).length * 360);
      timerRef.current = setTimeout(onEnd, ms);
      return;
    }
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.87;
    utt.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const lang = navigator.language || "en";
    const voice =
      voices.find((v) => v.lang.startsWith(lang.split("-")[0]) && !v.localService) ||
      voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
    if (voice) utt.voice = voice;
    utt.onend = onEnd;
    utt.onerror = onEnd;
    window.speechSynthesis.speak(utt);
  }, []);

  const startFrom = useCallback(
    (startIdx) => {
      cancelRef.current = false;
      setPlaying(true);
      setDone(false);

      function next(i) {
        if (cancelRef.current) return;
        if (i >= slides.length) {
          setPlaying(false);
          setDone(true);
          return;
        }
        setIdx(i);
        speak(getNarration(slides[i]), () => {
          if (cancelRef.current) return;
          timerRef.current = setTimeout(() => next(i + 1), 500);
        });
      }
      next(startIdx);
    },
    [slides, speak]
  );

  function handlePlayPause() {
    if (playing) {
      stopAll();
      setPlaying(false);
    } else {
      startFrom(done ? 0 : idx);
    }
  }

  function handleRestart() {
    stopAll();
    setPlaying(false);
    setDone(false);
    setIdx(0);
  }

  function jump(newIdx) {
    stopAll();
    setPlaying(false);
    setDone(false);
    setIdx(newIdx);
  }

  const slide = slides[idx] || slides[0];
  const progress = slides.length > 1 ? (idx / (slides.length - 1)) * 100 : 0;

  return (
    <div className="vs-player">
      {/* Header */}
      <div className="vs-header">
        <div className="vs-header-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <polygon points="2,1 9,5 2,9" />
          </svg>
        </div>
        <span className="vs-header-label">Video Solution</span>
        <span className="vs-header-count">{slides.length} slides</span>
      </div>

      {/* Screen */}
      <div className="vs-screen">
        <div className="vs-grid" />
        <div className="vs-glow vs-glow-1" />
        <div className="vs-glow vs-glow-2" />
        {slide && (
          <div key={idx} className="vs-slide">
            <SlideContent slide={slide} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="vs-controls">
        <div className="vs-bar-track">
          <div className="vs-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="vs-dots">
          {slides.map((s, i) => (
            <button
              key={i}
              className={`vs-dot${i === idx ? " active" : ""}`}
              onClick={() => jump(i)}
              title={s.type === "step" ? `Step ${s.n}` : s.type}
            />
          ))}
        </div>
        <div className="vs-btns">
          <button className="vs-btn" onClick={handleRestart} title="Restart">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button className="vs-btn" onClick={() => jump(Math.max(0, idx - 1))} disabled={idx === 0}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="vs-play-btn" onClick={handlePlayPause}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="4" height="18" rx="1" />
                <rect x="15" y="3" width="4" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
          <button
            className="vs-btn"
            onClick={() => jump(Math.min(slides.length - 1, idx + 1))}
            disabled={idx === slides.length - 1}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <span className="vs-counter">{idx + 1} / {slides.length}</span>
          <button
            className={`vs-btn vs-mute-btn${muted ? " muted" : ""}`}
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Unmute narration" : "Mute narration"}
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RE_EXPLAIN trigger ───────────────────────────────────────────────
const RE_EXPLAIN_TRIGGERS =
  /\b(tushunmadim|tushunmadi|boshqatan|soddaroq|explain\s*(simpler|again|more\s*simply)?|simpler|simple|qayta|yana\s*bir|aniqroq|soddalar?oq|don'?t\s+understand|one\s+more\s+time|again)\b/i;

// ─── API layer ────────────────────────────────────────────────────────
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

function tryLocal(text) {
  if (!/^[0-9+\-*/^%().\s]+$/.test(text.trim())) return null;
  const res = processInput(text);
  if (!res || res.type !== "math") return null;
  return res;
}

// ─── Text result renderer ─────────────────────────────────────────────
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
        <div className="step-result"><span className="arrow">→</span> {step.result}</div>
      )}
      {simple && step.why && (
        <div className="step-why"><span className="why-icon">💡</span> {step.why}</div>
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
          <button className="reexplain-btn" onClick={onReExplain}>🔄 Explain Simpler</button>
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
            <span className="steps-title-text">{isSimple ? "Simple Steps" : "Solution Steps"}</span>
            <span className="steps-count">{data.steps.length} steps</span>
          </div>
          {data.steps.map((s) => <StepCard key={s.n} step={s} simple={isSimple} />)}
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
                <button key={i} className="fu-chip" onClick={() => onFollowUp(f)}>{f}</button>
              ))}
          </div>
        </div>
      )}

      <div className="action-row">
        {!isSimple && (
          <button className="reexplain-btn" onClick={onReExplain}>🔄 Explain Simpler</button>
        )}
        {isSimple && <div className="simple-badge">✓ Simplified mode</div>}
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
      <button className="explain-btn" onClick={onDetailedExplain}>✨ Explain in detail with AI</button>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────────────────
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
      <div className="ai-response-wrap">
        {msg.type === "claude" && !msg.data?.raw && (
          <>
            <div className="bubble ai-bubble">
              <ClaudeResult
                data={msg.data}
                mode={msg.mode}
                onReExplain={() => onReExplain(msg)}
                onFollowUp={onFollowUp}
              />
            </div>
            {msg.data?.graph?.functions?.length > 0 && (
              <MathGraph graphData={msg.data.graph} />
            )}
            {msg.data?.steps?.length > 0 && <VideoSolution data={msg.data} />}
          </>
        )}
        {msg.type === "claude" && msg.data?.raw && (
          <div className="bubble ai-bubble">
            <ClaudeResult
              data={msg.data}
              mode={msg.mode}
              onReExplain={() => onReExplain(msg)}
              onFollowUp={onFollowUp}
            />
          </div>
        )}
        {msg.type === "local" && (
          <div className="bubble ai-bubble">
            <LocalResult data={msg.data} onDetailedExplain={() => onDetailedExplain(msg)} />
          </div>
        )}
        {msg.type === "error" && (
          <div className="bubble ai-bubble">
            <span className="err-text">⚠️ {msg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────
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

  const callAPI = useCallback(async (question, mode, imageFile = null) => {
    setThinking(true);
    setThinkingText(imageFile ? "Analyzing image" : "Solving");
    try {
      const data = imageFile
        ? await apiSolveImage(imageFile, question, mode)
        : await apiSolve(question, mode);
      setMessages((prev) => [
        ...prev,
        { role: "ai", type: "claude", data, mode, srcQuestion: question, srcFile: imageFile },
      ]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", type: "error", text: e.message }]);
    } finally {
      setThinking(false);
    }
  }, []);

  async function handleSend(text, isVoice = false) {
    const val = (text !== undefined ? text : input).trim();
    if (!val && !pendingImg) return;
    const imgSnapshot = pendingImg;
    setInput("");
    setPendingImg(null);

    if (!imgSnapshot && RE_EXPLAIN_TRIGGERS.test(val)) {
      const last = [...messages].reverse().find((m) => m.role === "ai" && m.type === "claude");
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

    if (imgSnapshot) { await callAPI(val, "normal", imgSnapshot.file); return; }

    const local = tryLocal(val);
    if (local) {
      setMessages((prev) => [...prev, { role: "ai", type: "local", data: local, srcQuestion: val }]);
      return;
    }

    await callAPI(val, "normal");
  }

  const { recording, liveText, toggle: toggleVoice, isSupported: voiceSupported } =
    useVoice(handleSend);

  function handleFollowUp(text) { handleSend(text); }

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
                  <span className="dot" /><span className="dot" /><span className="dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <div className="input-area">
        {pendingImg && (
          <div className="img-preview-wrap">
            <img src={pendingImg.preview} alt="preview" className="img-preview" />
            <button className="img-remove" onClick={() => setPendingImg(null)} title="Remove image">×</button>
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
          <button className="img-btn" onClick={() => fileRef.current?.click()} title="Upload image" disabled={recording}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />

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
