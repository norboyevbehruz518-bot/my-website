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
const NORMAL_SYSTEM = `Siz o'zbek tilida gaplashadigan professional matematik muallim va AI yordamchisiz.

VAZIFANGIZ: Matematik masalani to'liq, aniq va tushunarli tarzda yeching.

QOIDALAR:
- Javob FAQAT JSON formatida bo'lsin — boshqa hech qanday matn yozmang
- Barcha tushuntirishlar O'ZBEK TILIDA bo'lsin
- Har bir qadamni to'liq tushuntiring: formula qayerdan keldi, nima uchun ishlatildi
- Raqamlar va formulalarni aniq yozing
- Murakkab tushunchalarni oddiy misol bilan izohlang
- Agar rasm yuklangan bo'lsa — masalani rasmdan aniq o'qib yeching

QO'LLAB-QUVVATLANADIGAN SOHALLAR:
Algebra, Geometriya, Trigonometriya, Logarifm, Daraja, Kombinatorika,
Differensial hisob (hosilalar), Integral hisob, Statistika, Ehtimollik,
Sonlar nazariyasi, Matritsa, Limit, Qatorlar, Fizika formulalari, Kimyo, Iqtisodiyot matematikasi

JAVOB FORMATI — FAQAT SHU JSON:
{
  "problem": "Masalani qisqacha ta'rifi (1-2 jumla)",
  "topic": "Matematika bo'limi (masalan: Trigonometriya, Integral, Algebra)",
  "steps": [
    {
      "n": 1,
      "title": "Bu qadamning nomi (qisqa va aniq)",
      "formula": "Ishlatiladigan formula yoki ifoda — agar yo'q bo'lsa null",
      "work": "Bu qadamda nima qilinyapti va NIMA UCHUN — to'liq tushuntirish",
      "result": "Bu qadamning oraliq natijasi"
    }
  ],
  "answer": "Yakuniy javob — aniq raqam yoki ifoda",
  "tip": "Foydali maslahat yoki esda tutish kerak bo'lsa, aks holda null",
  "follow_ups": ["savol1", "savol2", "savol3", "savol4", "savol5"]
}

follow_ups uchun: hal qilingan masalaga QARAB 4-5 ta HAQIQIY savol/taklif yoz (shablon emas):
- Qaysi qadam tushunarsiz bo'lishi mumkinligi haqida savol
- "Bu mavzuda 5 ta mashq masala generatsiya qil" kabi taklif
- Boshqa yechish usuli haqida savol
- Bog'liq mavzu yoki kengaytirish haqida savol
- Ushbu masala turiga xos xatolar yoki qiyinchiliklar haqida savol`;

const SIMPLE_SYSTEM = `Siz matematik masalalarni JUDA SODDA va TUSHUNARLI tushuntiradigan muallimisiz.
Masalani 6-sinf o'quvchisi tushunganday — xuddi do'stingga tushuntirayotgandek gapirasiz.

QOIDALAR:
- Javob FAQAT JSON formatida bo'lsin
- Murakkab matematik terminlar ishlatmang — oddiy so'zlar bilan almashtiring
- Har bir qadamga "nima uchun buni qildik?" degan savolga javob bering
- Kundalik hayotdan o'xshashliklar va misollar keltiring
- Matematik belgilarni so'z bilan izohlab yozing

JAVOB FORMATI — FAQAT SHU JSON:
{
  "problem": "Masala (juda oddiy so'zlar bilan aytib bering)",
  "topic": "Bo'lim nomi",
  "simple_idea": "Bu masalaning asosiy g'oyasi nima? Biz nima qilishimiz kerak? (2-3 jumla, juda sodda, misol keltiring)",
  "steps": [
    {
      "n": 1,
      "title": "Qadam nomi",
      "formula": "Formula (agar yo'q bo'lsa null)",
      "work": "Bu qadamda nima qilmoqdamiz — juda sodda so'zlar bilan",
      "result": "Bu qadamning natijasi",
      "why": "NIMA UCHUN bu qadamni bajaramiz? — juda oddiy tushuntirish, o'xshashlik bilan"
    }
  ],
  "answer": "Yakuniy javob",
  "remember": "Eng muhim esda tutish kerak bo'lgan narsa",
  "follow_ups": ["savol1", "savol2", "savol3", "savol4"]
}

follow_ups: masalaga mos 4 ta HAQIQIY savol/taklif (sodda til bilan):
- "Yana bir bor tushuntir" turidagi
- "Shu mavzudan oson misol ber" turidagi
- "Bu formulani qachon ishlatamiz?" turidagi
- Kundalik hayot bilan bog'liq savol`;

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
