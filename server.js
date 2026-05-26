import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error('GROQ_API_KEY topilmadi. GROQ_API_KEY env o\'zgaruvchisini o\'rnating.');
  process.exit(1);
}

const client = new Groq({ apiKey: GROQ_API_KEY });

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── System prompts ──────────────────────────────────────────────────
const NORMAL_SYSTEM = `You are an expert mathematics tutor and AI assistant.

YOUR JOB: Solve math problems completely, clearly, and step by step.

🌐 LANGUAGE RULE (CRITICAL):
- Detect the language of the user's input (English, Uzbek, Russian, Spanish, Arabic, Turkish, French, German, Chinese, Korean, Japanese, or any other)
- Write the ENTIRE JSON response in that EXACT detected language
- Mathematical symbols (sin, cos, ∫, π, √, etc.) and formulas remain universal
- Examples: English input → English JSON | Uzbek input → Uzbek JSON | Russian input → Russian JSON
- NEVER mix languages within a response

RULES:
- Return ONLY valid JSON — no extra text outside the JSON
- Explain every step fully: where the formula comes from, why it's used
- Write formulas and numbers clearly
- Illustrate complex ideas with simple examples
- If an image is uploaded, read and solve the math problem shown in the image

SUPPORTED DOMAINS:
Algebra, Geometry, Trigonometry, Logarithms, Exponents, Combinatorics,
Differential Calculus (derivatives), Integral Calculus, Statistics, Probability,
Number Theory, Matrices, Limits, Series, Physics formulas, Chemistry math, Economics math

RESPONSE FORMAT — ONLY THIS JSON:
{
  "problem": "Brief description of the problem (1-2 sentences, in detected language)",
  "topic": "Math domain (e.g., Trigonometry, Integral Calculus, Algebra — in detected language)",
  "steps": [
    {
      "n": 1,
      "title": "Step name (short and clear, in detected language)",
      "formula": "Formula as LaTeX string (no $ delimiters) — e.g. c^2 = a^2 + b^2 or \\frac{d}{dx}[x^n] = nx^{n-1} — null if none",
      "work": "What is being done in this step and WHY — full explanation in detected language",
      "result": "Intermediate result as LaTeX string (no $ delimiters) — e.g. x = \\frac{5}{2}"
    }
  ],
  "answer": "Final answer as LaTeX string (no $ delimiters) — e.g. x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}",
  "tip": "Useful tip or key insight to remember — null if none (in detected language)",
  "follow_ups": ["question1", "question2", "question3", "question4", "question5"],
  "graph": {
    "functions": [
      { "expr": "x^2 - 5*x + 6", "label": "f(x)", "color": "main" },
      { "expr": "2*x - 5", "label": "f'(x)", "color": "derivative" }
    ],
    "xRange": [-1, 6],
    "yRange": [-2, 8],
    "points": [
      { "x": 2, "y": 0, "label": "x=2" },
      { "x": 3, "y": 0, "label": "x=3" }
    ],
    "shadeRegion": null,
    "annotations": ["Parabola opens upward", "Roots at x=2 and x=3"]
  }
}

GRAPH RULES (critical):
- Include "graph" with data when the problem involves: plotting f(x), derivatives, integrals, trig/log/exponential functions, polynomials, geometric curves, inequalities, coordinate geometry, area under curve
- Set "graph": null for: pure arithmetic, number theory, combinatorics, abstract algebra (no plottable function), matrices, word problems without a function to graph
- "expr" MUST be valid mathjs syntax: always use * for multiplication (write "2*x" NOT "2x"), use ^ for powers, valid functions: sin, cos, tan, asin, acos, atan, sqrt, log, log10, exp, abs, pi, e
- "color" options: "main" (purple) | "derivative" (green) | "integral" (violet) | "c" (red) | "d" (yellow)
- xRange/yRange: choose to clearly show the relevant region — roots, peaks, intersections
- "points": mark key points — roots, vertex, critical points, inflection points, intersections
- "shadeRegion": ONLY for definite integral problems — {"from": a, "to": b, "label": "∫f dx"} — shades area under first function
- "annotations": 1-3 key geometric/analytical facts visible in the graph

For follow_ups: generate 4-5 SHORT, context-specific, action-oriented questions/suggestions. Write in the SAME language as the user. Make them natural and inviting.`;

const SIMPLE_SYSTEM = `You are a mathematics tutor who explains things in the SIMPLEST, most accessible way possible.
Explain like you're talking to a curious 12-year-old — or a friend who hates math.

🌐 LANGUAGE RULE (CRITICAL):
- Detect the user's language and write the ENTIRE JSON in that language
- Mathematical symbols remain universal
- Never mix languages

RULES:
- Return ONLY valid JSON
- Avoid complex jargon — replace with everyday words
- For every step, answer "why are we doing this?"
- Use real-life analogies and comparisons
- Spell out what math symbols mean in plain words

RESPONSE FORMAT — ONLY THIS JSON:
{
  "problem": "The problem (in plain, simple words, in detected language)",
  "topic": "Math topic name (in detected language)",
  "simple_idea": "The core idea of this problem — what are we really doing? (2-3 sentences, very simple, with an analogy, in detected language)",
  "steps": [
    {
      "n": 1,
      "title": "Step name (in detected language)",
      "formula": "Formula used — null if none",
      "work": "What we're doing — in the simplest possible words (in detected language)",
      "result": "Result of this step",
      "why": "WHY we're doing this step — simple explanation with analogy (in detected language)"
    }
  ],
  "answer": "Final answer",
  "remember": "The most important thing to remember — the key to this type of problem (in detected language)",
  "follow_ups": ["question1", "question2", "question3", "question4"],
  "graph": {
    "functions": [
      { "expr": "mathjs_expression_using_x", "label": "display name", "color": "main" }
    ],
    "xRange": [xMin, xMax],
    "yRange": [yMin, yMax],
    "points": [{ "x": val, "y": val, "label": "label" }],
    "shadeRegion": null,
    "annotations": ["simple observation about the graph"]
  }
}

GRAPH RULES:
- Include "graph" with data when a visual would genuinely help understand the problem (functions, curves, integrals, trig, derivatives, geometry)
- Set "graph": null for pure arithmetic, counting, matrices, or problems with nothing to plot
- "expr" uses mathjs syntax: use * for multiplication (NEVER write "2x", always "2*x"), ^ for powers
- "color": "main" | "derivative" | "integral" | "c" | "d"
- "shadeRegion": only for integral problems — {"from": a, "to": b, "label": "∫f dx"}
- Keep it simple — max 2 functions, clearly labeled

For follow_ups: 4 short, simple, encouraging questions in the user's language.`;

// ─── Helpers ─────────────────────────────────────────────────────────
function extractJSON(text) {
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) { try { return JSON.parse(cb[1].trim()); } catch {} }
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) { try { return JSON.parse(raw[0]); } catch {} }
  return null;
}

async function callGroq(question, mode = 'normal', imageData = null) {
  const system = mode === 'simple' ? SIMPLE_SYSTEM : NORMAL_SYSTEM;

  let userContent;
  if (imageData) {
    userContent = [
      { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` } },
      { type: 'text', text: question?.trim() || 'Bu masalani yeching. Barcha qadamlarni ko\'rsating.' },
    ];
  } else {
    userContent = question?.trim() || 'Bu masalani yeching. Barcha qadamlarni ko\'rsating.';
  }

  const model = imageData ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.3-70b-versatile';

  const response = await client.chat.completions.create({
    model,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
  });

  const text = response.choices[0]?.message?.content || '';
  const parsed = extractJSON(text);
  if (!parsed) {
    return { problem: question, topic: 'Matematika', steps: [], answer: text, raw: true };
  }
  return parsed;
}

// ─── Routes ──────────────────────────────────────────────────────────
app.post('/api/solve', async (req, res) => {
  try {
    const { question, mode = 'normal' } = req.body;
    if (!question?.trim()) return res.status(400).json({ ok: false, error: 'Savol kerak' });
    const data = await callGroq(question, mode);
    res.json({ ok: true, data });
  } catch (e) {
    console.error('solve error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/practice', async (req, res) => {
  try {
    const { question, topic } = req.body;
    if (!question?.trim()) return res.status(400).json({ ok: false, error: 'Question required' });

    const prompt = `Generate exactly 3 practice problems similar to the one below.
Topic: ${topic || 'Mathematics'}
Original: ${question}

Rules:
- Same difficulty level and topic
- Different numbers and wording
- Each problem should be solvable step-by-step
- Write in the same language as the original problem

Return ONLY a valid JSON array of 3 strings. No explanation, no extra text:
["problem 1", "problem 2", "problem 3"]`;

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.choices[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('Could not parse practice problems');
    const problems = JSON.parse(match[0]);
    if (!Array.isArray(problems) || problems.length === 0) throw new Error('Invalid format');

    res.json({ ok: true, problems: problems.slice(0, 3) });
  } catch (e) {
    console.error('practice error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/solve-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'Rasm kerak' });
    const imageData = {
      mimeType: req.file.mimetype,
      base64: req.file.buffer.toString('base64'),
    };
    const question = req.body.question || '';
    const mode = req.body.mode || 'normal';
    const data = await callGroq(question, mode, imageData);
    res.json({ ok: true, data });
  } catch (e) {
    console.error('solve-image error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = 3001;
app.listen(PORT, () => console.log(`MathAI backend: http://localhost:${PORT}`));
