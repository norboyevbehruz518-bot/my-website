import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

// Read session token — supports both standard API key and Claude Code session token (Bearer)
function getCredentials() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { apiKey: process.env.ANTHROPIC_API_KEY, authType: 'apikey' };
  }
  const file = process.env.CLAUDE_SESSION_INGRESS_TOKEN_FILE;
  if (file) {
    try {
      const token = readFileSync(file, 'utf-8').trim();
      if (token) return { token, authType: 'bearer' };
    } catch {}
  }
  return null;
}

const CREDS = getCredentials();
if (!CREDS) {
  console.error('Auth topilmadi. ANTHROPIC_API_KEY env o\'zgaruvchisini o\'rnating.');
  process.exit(1);
}

// For Bearer token auth we use fetch directly; for API key we use SDK
let client = null;
if (CREDS.authType === 'apikey') {
  client = new Anthropic({
    apiKey: CREDS.apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  });
}
const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

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
      "formula": "Formula or expression used — null if none",
      "work": "What is being done in this step and WHY — full explanation in detected language",
      "result": "Intermediate result of this step"
    }
  ],
  "answer": "Final answer — exact number or expression",
  "tip": "Useful tip or key insight to remember — null if none (in detected language)",
  "follow_ups": ["question1", "question2", "question3", "question4", "question5"]
}

For follow_ups: generate 4-5 SHORT, context-specific, action-oriented questions/suggestions based on what was just solved. Mix of:
- A question about a specific step that might be confusing
- "Give me 5 practice problems on this topic"
- "Is there another method to solve this?"
- A question about a related topic or extension
- A question about common mistakes in this type of problem
Write them in the SAME language as the user's input. Make them natural and inviting.`;

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
  "follow_ups": ["question1", "question2", "question3", "question4"]
}

For follow_ups: 4 short, simple, encouraging questions/suggestions in the user's language. Examples:
- "Explain it one more time differently"
- "Give me an easy example of this"
- "When do we use this formula in real life?"
- "Give me 3 similar problems to practice"
Write them naturally in the user's language.`;

// ─── Helpers ─────────────────────────────────────────────────────────
function extractJSON(text) {
  const cb = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) { try { return JSON.parse(cb[1].trim()); } catch {} }
  const raw = text.match(/\{[\s\S]*\}/);
  if (raw) { try { return JSON.parse(raw[0]); } catch {} }
  return null;
}

async function callClaude(question, mode = 'normal', imageData = null) {
  const system = mode === 'simple' ? SIMPLE_SYSTEM : NORMAL_SYSTEM;

  const content = [];
  if (imageData) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageData.mimeType, data: imageData.base64 },
    });
  }
  content.push({
    type: 'text',
    text: question?.trim() || 'Bu masalani yeching. Barcha qadamlarni ko\'rsating.',
  });

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  };

  let text;

  if (client) {
    // Standard API key path
    const response = await client.messages.create(body);
    text = response.content[0]?.text || '';
  } else {
    // Bearer token path (Claude Code session token)
    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CREDS.token}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `API error ${res.status}`);
    text = json.content?.[0]?.text || '';
  }

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
    const data = await callClaude(question, mode);
    res.json({ ok: true, data });
  } catch (e) {
    console.error('solve error:', e.message);
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
    const data = await callClaude(question, mode, imageData);
    res.json({ ok: true, data });
  } catch (e) {
    console.error('solve-image error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = 3001;
app.listen(PORT, () => console.log(`MathAI backend: http://localhost:${PORT}`));
