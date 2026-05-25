import * as math from 'mathjs';

// ─── Number helpers ────────────────────────────────────────────────
function fmt(val) {
  if (typeof val !== 'number' || !isFinite(val)) return String(val);
  const r = parseFloat(val.toFixed(8));
  if (Math.abs(r) >= 1e12 || (Math.abs(r) < 1e-6 && r !== 0)) {
    return r.toExponential(4);
  }
  return r.toLocaleString('en-US', { maximumFractionDigits: 8 }).replace(/,/g, ' ');
}

function factorial(n) {
  n = Math.round(n);
  if (n < 0 || n > 170) return null;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function gcd(a, b) {
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function lcm(a, b) {
  return Math.abs(Math.round(a) * Math.round(b)) / gcd(a, b);
}

function isPrime(n) {
  n = Math.round(n);
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
  return true;
}

function primeFactors(n) {
  n = Math.round(n);
  const factors = [];
  let d = 2;
  while (n > 1) {
    let e = 0;
    while (n % d === 0) { n /= d; e++; }
    if (e > 0) factors.push({ p: d, e });
    d++;
    if (d * d > n && n > 1) { factors.push({ p: n, e: 1 }); break; }
  }
  return factors;
}

function combo(n, r, type = 'C') {
  n = Math.round(n); r = Math.round(r);
  if (r < 0 || r > n) return null;
  const fn = factorial(n), fr = factorial(r), fnr = factorial(n - r);
  if (fn === null || fr === null || fnr === null) return null;
  return type === 'C' ? fn / (fr * fnr) : fn / fnr;
}

function solveQuadratic(a, b, c) {
  const D = b * b - 4 * a * c;
  if (D < 0) return { D: parseFloat(D.toFixed(6)), roots: [] };
  if (D === 0) return { D: 0, roots: [parseFloat((-b / (2 * a)).toFixed(8))] };
  const sq = Math.sqrt(D);
  return {
    D: parseFloat(D.toFixed(6)),
    roots: [parseFloat(((-b + sq) / (2 * a)).toFixed(8)), parseFloat(((-b - sq) / (2 * a)).toFixed(8))],
  };
}

// ─── Preprocessor ──────────────────────────────────────────────────
function preprocess(raw) {
  return raw
    .replace(/[×]/g, '*').replace(/÷/g, '/')
    .replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)')
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/(\d+(?:\.\d+)?)\s*!/g, 'factorial($1)')
    .replace(/\bln\s*\(/gi, 'log(')
    .replace(/\bpi\b/gi, 'pi')
    .replace(/\btau\b/gi, '(2*pi)');
}

// wrap trig calls to use degrees
function withDeg(expr) {
  return expr.replace(
    /\b(sin|cos|tan|asin|acos|atan)(?!h)\s*\(([^()]+)\)/gi,
    (_, fn, arg) => /^a/i.test(fn)
      ? `(${fn}(${arg}) * 180 / pi)`
      : `${fn}((${arg}) * pi / 180)`
  );
}

const SCOPE = {
  factorial: (n) => { const r = factorial(n); if (r === null) throw Error('overflow'); return r; },
  gcd: (a, b) => gcd(a, b),
  lcm: (a, b) => lcm(a, b),
  C: (n, r) => combo(n, r, 'C'),
  P: (n, r) => combo(n, r, 'P'),
  nCr: (n, r) => combo(n, r, 'C'),
  nPr: (n, r) => combo(n, r, 'P'),
};

function safeEval(expr) {
  const p = preprocess(expr);
  for (const variant of [withDeg(p), p]) {
    try {
      const res = math.evaluate(variant, SCOPE);
      const num = typeof res === 'number' ? res
        : res?.toNumber?.() ?? null;
      if (num !== null && isFinite(num)) return parseFloat(num.toFixed(10));
    } catch { /* try next */ }
  }
  return null;
}

// ─── Complexity ────────────────────────────────────────────────────
function complexity(expr) {
  const hasFunc = /\b(sin|cos|tan|log|sqrt|factorial|abs|exp|sinh|cosh|tanh|asin|acos|atan|gcd|lcm|C|P)\b/i.test(expr);
  const ops = (expr.match(/[+\-*/^%]/g) || []).length;
  let depth = 0, maxD = 0;
  for (const c of expr) {
    if (c === '(') depth++; else if (c === ')') depth--;
    maxD = Math.max(maxD, depth);
  }
  if (hasFunc || maxD > 1 || ops >= 4) return 'complex';
  if (ops >= 2 || maxD >= 1) return 'medium';
  return 'simple';
}

// ─── Step generator ────────────────────────────────────────────────
const OP_LABELS = {
  '+': "Qo'shish", '-': 'Ayirish', '*': "Ko'paytirish", '/': "Bo'lish",
  '^': 'Daraja', '%': 'Qoldiq (mod)',
};
const FN_LABELS = {
  sin: 'sin (daraja)', cos: 'cos (daraja)', tan: 'tan (daraja)',
  asin: 'arcsin → °', acos: 'arccos → °', atan: 'arctan → °',
  sqrt: 'Kvadrat ildiz', log: 'Tabiiy log (ln)', log10: 'Log₁₀', log2: 'Log₂',
  factorial: 'Faktorial', abs: 'Mutlaq qiymat', exp: 'eˣ',
  sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
  gcd: 'EKUB', lcm: 'EKUK', C: 'Kombinatsiya', P: 'Permutatsiya',
};

function stepLabel(node) {
  if (node.type === 'OperatorNode') return OP_LABELS[node.op] || node.op;
  if (node.type === 'FunctionNode') return FN_LABELS[node.name] || node.name;
  return null;
}

function walkSteps(node, steps) {
  if (!node) return;
  const t = node.type;
  if (t === 'ConstantNode' || t === 'SymbolNode') return;

  if (t === 'ParenthesisNode') { walkSteps(node.content, steps); return; }

  for (const child of node.args || []) walkSteps(child, steps);

  const exprStr = node.toString({ parenthesis: 'auto' });
  const val = safeEval(exprStr);
  if (val === null) return;

  const last = steps[steps.length - 1];
  if (!last || last.expr !== exprStr) {
    steps.push({ expr: exprStr, result: fmt(val), label: stepLabel(node) });
  }
}

function generateSteps(expr) {
  try {
    const node = math.parse(preprocess(expr));
    const steps = [];
    walkSteps(node, steps);
    // Remove last step — it duplicates the final result display
    return steps.length >= 2 ? steps.slice(0, -1) : [];
  } catch { return []; }
}

// ─── Formula database ──────────────────────────────────────────────
const FORMULAS = {
  // Algebra
  "kvadrat tenglama": {
    formula: "x = (-b ± √(b²−4ac)) / 2a",
    desc: "ax²+bx+c=0 uchun yechim. Avval D=b²−4ac diskriminantni hisobla. D>0 ikkita ildiz, D=0 bitta, D<0 haqiqiy ildiz yo'q.",
  },
  "diskriminant": {
    formula: "D = b² − 4ac",
    desc: "D > 0 → 2 ta haqiqiy ildiz  |  D = 0 → 1 ta  |  D < 0 → haqiqiy ildiz yo'q",
  },
  "vieta formulasi": {
    formula: "x₁ + x₂ = −b/a,   x₁ · x₂ = c/a",
    desc: "Vieta teoremasi: kvadrat tenglamaning ildizlari yig'indisi va ko'paytmasi",
  },
  "arifmetik progressiya": {
    formula: "aₙ = a₁ + (n−1)·d\nSₙ = n(a₁ + aₙ)/2",
    desc: "n-chi had va birinchi n hadlar yig'indisi. d — qadam.",
  },
  "geometrik progressiya": {
    formula: "aₙ = a₁·qⁿ⁻¹\nSₙ = a₁·(qⁿ−1)/(q−1)",
    desc: "n-chi had va yig'indisi (q≠1). q — ko'paytuvchi.",
  },
  "logarifm": {
    formula: "logₐ(b) = ln(b)/ln(a)",
    desc: "Asosni almashtirish formulasi. log(xy)=log(x)+log(y)  |  log(xⁿ)=n·log(x)",
  },
  "daraja qoidalari": {
    formula: "aᵐ·aⁿ = aᵐ⁺ⁿ\naᵐ/aⁿ = aᵐ⁻ⁿ\n(aᵐ)ⁿ = aᵐⁿ\na⁰ = 1",
    desc: "Darajalar bilan ishlash asosiy qoidalari",
  },
  "binomial teorema": {
    formula: "(a+b)ⁿ = Σ C(n,k)·aⁿ⁻ᵏ·bᵏ",
    desc: "Newton binomi — (a+b)² = a²+2ab+b²,  (a+b)³ = a³+3a²b+3ab²+b³",
  },

  // Geometry
  "pifagor": {
    formula: "a² + b² = c²",
    desc: "To'g'ri burchakli uchburchak: katetlar kvadratlari = gipotenuza kvadrati",
  },
  "doira yuzi": { formula: "A = π·r²", desc: "Radius bo'yicha doira yuzi" },
  "doira uzunligi": { formula: "C = 2·π·r = π·d", desc: "Doira perimetri (aylanasi)" },
  "shar hajmi": { formula: "V = (4/3)·π·r³", desc: "Shar hajmi" },
  "shar yuzasi": { formula: "A = 4·π·r²", desc: "Shar to'liq sirt yuzi" },
  "silindr hajmi": { formula: "V = π·r²·h", desc: "Silindr hajmi" },
  "silindr yuzasi": { formula: "A = 2πr(r + h)", desc: "Silindr to'liq sirt yuzi" },
  "konus hajmi": { formula: "V = (1/3)·π·r²·h", desc: "Konus hajmi" },
  "piramida hajmi": { formula: "V = (1/3)·Aₐₛₒₛ·h", desc: "Piramida hajmi" },
  "uchburchak yuzi": { formula: "A = (a·h) / 2", desc: "Asos × Balandlik / 2" },
  "geron formulasi": {
    formula: "A = √(s(s−a)(s−b)(s−c))\ns = (a+b+c)/2",
    desc: "Tomonlari orqali uchburchak yuzi (Geron formulasi)",
  },
  "trapetsiya yuzi": { formula: "A = (a+b)/2 · h", desc: "Parallel tomonlar yig'indisi / 2 × balandlik" },
  "romb yuzi": { formula: "A = (d₁·d₂) / 2", desc: "Diagonallar ko'paytmasi / 2" },
  "to'g'ri to'rtburchak yuzi": { formula: "A = a·b,   P = 2(a+b)", desc: "Yuzi va perimetri" },
  "kvadrat yuzi": { formula: "A = a²,   P = 4a", desc: "Tomonining kvadrati" },

  // Trigonometry
  "sinus teoremasi": {
    formula: "a/sin A = b/sin B = c/sin C = 2R",
    desc: "Uchburchak tomonlari va qarama-qarshi burchaklar nisbati. R — o'rnatilgan doira radiusi.",
  },
  "kosinus teoremasi": {
    formula: "c² = a² + b² − 2ab·cos C",
    desc: "Ixtiyoriy uchburchak uchun: burchak va qarama-qarshi tomoni",
  },
  "trigonometrik aynanliklar": {
    formula: "sin²x + cos²x = 1\ntan x = sin x / cos x\n1 + tan²x = 1/cos²x",
    desc: "Asosiy trigonometrik tengliklar",
  },
  "ikki burchak formulalari": {
    formula: "sin 2x = 2 sin x cos x\ncos 2x = cos²x − sin²x\ntan 2x = 2tan x/(1−tan²x)",
    desc: "Ikkilangan burchak formulalari",
  },
  "qo'shish formulalari": {
    formula: "sin(a±b) = sin a·cos b ± cos a·sin b\ncos(a±b) = cos a·cos b ∓ sin a·sin b",
    desc: "Burchaklar yig'indisi/ayirmasi uchun trig formulalar",
  },
  "euler formulasi": {
    formula: "eⁱˣ = cos x + i·sin x\neⁱᵖ + 1 = 0",
    desc: "Euler identifikatsiyasi — matematikaning eng chiroyli formulasi",
  },

  // Calculus
  "hosila": {
    formula: "f′(x) = lim[h→0] (f(x+h)−f(x)) / h",
    desc: "Hosilaning ta'rifi — funksiyaning o'zgarish tezligi (qiyalik)",
  },
  "hosila qoidalari": {
    formula: "(xⁿ)′ = nxⁿ⁻¹\n(sin x)′ = cos x\n(cos x)′ = −sin x\n(eˣ)′ = eˣ\n(ln x)′ = 1/x",
    desc: "Asosiy hosilalar jadvali",
  },
  "zanjir qoidasi": {
    formula: "[f(g(x))]′ = f′(g(x)) · g′(x)",
    desc: "Murakkab funksiya hosildasi (chain rule)",
  },
  "ko'paytma hosila": {
    formula: "(u·v)′ = u′v + uv′",
    desc: "Ikkita funksiya ko'paytmasining hosildasi",
  },
  "bo'linma hosila": {
    formula: "(u/v)′ = (u′v − uv′) / v²",
    desc: "Ikki funksiya bo'linmasining hosildasi",
  },
  "integral": {
    formula: "∫xⁿ dx = xⁿ⁺¹/(n+1) + C",
    desc: "Kuchning noaniq integrali (n ≠ −1)",
  },
  "integral qoidalari": {
    formula: "∫sin x dx = −cos x + C\n∫eˣ dx = eˣ + C\n∫(1/x) dx = ln|x| + C",
    desc: "Asosiy integrallar jadvali",
  },
  "nyuton-leybnits": {
    formula: "∫[a,b] f(x)dx = F(b) − F(a)",
    desc: "Aniq integral — egri chiziq ostidagi maydonni hisoblash",
  },
  "lopital qoidasi": {
    formula: "lim f(x)/g(x) = lim f′(x)/g′(x)",
    desc: "0/0 yoki ∞/∞ noaniqliklarini hal qilish",
  },
  "taylor qatori": {
    formula: "f(x) = Σ f⁽ⁿ⁾(a)/n! · (x−a)ⁿ",
    desc: "Funksiyani daraja qatori ko'rinishida yoyish",
  },

  // Statistics
  "o'rtacha": {
    formula: "x̄ = (x₁+x₂+…+xₙ) / n",
    desc: "Arifmetik o'rtacha — barcha qiymatlar yig'indisi / soni",
  },
  "dispersiya": {
    formula: "σ² = Σ(xᵢ − x̄)² / n",
    desc: "Qiymatlarning o'rtachadan kvadratik og'ishi (tarqoqlik o'lchovi)",
  },
  "standart og'ish": {
    formula: "σ = √(Σ(xᵢ − x̄)² / n)",
    desc: "Ma'lumotlarning tarqoqligi o'lchovi. σ kichik → qiymatlar bir-biriga yaqin.",
  },
  "kombinatsiya": {
    formula: "C(n,r) = n! / (r!(n−r)!)",
    desc: "n ta elementdan r tasini tartibsiz tanlash usullari soni",
  },
  "permutatsiya": {
    formula: "P(n,r) = n! / (n−r)!",
    desc: "n ta elementdan r tasini tartibli tanlash usullari soni",
  },
  "ehtimollik": {
    formula: "P(A) = n(A) / n(Ω)",
    desc: "Hodisa ehtimolligi = qulay natijalar / barcha natijalar soni",
  },
  "bayes teoremasi": {
    formula: "P(A|B) = P(B|A)·P(A) / P(B)",
    desc: "Shartli ehtimollik — bir hodisa ikkinchisiga bog'liq bo'lganda",
  },

  // Number theory
  "euclid algoritmi": {
    formula: "gcd(a,b) = gcd(b, a mod b)",
    desc: "EKUB (eng katta umumiy bo'luvchi) — Evklid algoritmi. Masalan: gcd(48,18)=6",
  },
  "faktorial": {
    formula: "n! = 1×2×3×…×n,   0! = 1",
    desc: "Faktorial: 5! = 120,  10! = 3628800",
  },

  // Physics
  "energiya": { formula: "E = mc²", desc: "Massa-energiya ekvivalentligi — Eynshteyn formulasi" },
  "nyuton ikkinchi qonun": { formula: "F = m·a", desc: "Kuch = massa × tezlanish" },
  "kinetik energiya": { formula: "Eₖ = mv²/2", desc: "Harakat energiyasi" },
  "potensial energiya": { formula: "Eₚ = mgh", desc: "Balandlik energiyasi (g ≈ 9.8 m/s²)" },
  "ohm qonuni": { formula: "V = I·R", desc: "Kuchlanish = Tok × Qarshilik" },
  "quvvat": { formula: "P = I·V = V²/R = I²R", desc: "Elektr quvvati formulalari" },
  "tezlik": { formula: "v = s/t,   a = Δv/Δt", desc: "Tezlik va tezlanish" },
  "impuls": { formula: "p = m·v,   F·Δt = Δp", desc: "Impuls va impuls teoremasi" },
};

// ─── Formula search ────────────────────────────────────────────────
function findFormula(input) {
  const low = input.toLowerCase();
  for (const [key, val] of Object.entries(FORMULAS)) {
    if (low.includes(key)) return val;
  }
  return null;
}

// ─── Special input handlers ────────────────────────────────────────
function handleSpecial(raw) {
  const s = raw.trim();
  const low = s.toLowerCase();

  // GCD / EKUB
  let m = low.match(/(?:gcd|ekub)\s*[\(\s]+(-?\d+)[,\s]+(-?\d+)[\)\s]*/);
  if (m) {
    const a = parseInt(m[1]), b = parseInt(m[2]);
    const r = gcd(a, b);
    return {
      type: 'special', title: `EKUB — gcd(${a}, ${b})`,
      steps: [
        { label: 'Evklid algoritmi', expr: `gcd(${a}, ${b})`, result: fmt(r) },
      ],
      result: fmt(r),
    };
  }

  // LCM / EKUK
  m = low.match(/(?:lcm|ekuk)\s*[\(\s]+(-?\d+)[,\s]+(-?\d+)[\)\s]*/);
  if (m) {
    const a = parseInt(m[1]), b = parseInt(m[2]);
    const g = gcd(a, b), r = (Math.abs(a) * Math.abs(b)) / g;
    return {
      type: 'special', title: `EKUK — lcm(${a}, ${b})`,
      steps: [
        { label: 'Avval EKUB', expr: `gcd(${a}, ${b})`, result: fmt(g) },
        { label: 'lcm = |a×b| / gcd', expr: `|${a}×${b}| / ${g}`, result: fmt(r) },
      ],
      result: fmt(r),
    };
  }

  // Prime check: "17 tub" / "17 prime"
  m = low.match(/(\d+)\s*(?:tub|prime|oddmi|juftmi)/);
  if (m) {
    const n = parseInt(m[1]);
    const prime = isPrime(n);
    const factors = primeFactors(n);
    const fStr = factors.map(f => f.e > 1 ? `${f.p}^${f.e}` : `${f.p}`).join(' × ');
    return { type: 'prime', n, isPrime: prime, factorStr: fStr || String(n) };
  }

  // Factorization: "factor 360" or "360 bo'luvchilari"
  m = low.match(/(?:factor|bo.luvchi|decompose)\s+(\d+)|(\d+)\s+(?:factor|bo.luvchi)/);
  if (m) {
    const n = parseInt(m[1] || m[2]);
    const factors = primeFactors(n);
    const fStr = factors.map(f => f.e > 1 ? `${f.p}^${f.e}` : `${f.p}`).join(' × ');
    return { type: 'factorization', n, factorStr: fStr };
  }

  // Quadratic: "1 -5 6" (coefficients a b c)
  m = s.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const [, a, b, c] = m.map(Number);
    if (a !== 0) return { type: 'quadratic', a, b, c, ...solveQuadratic(a, b, c) };
  }

  // Combinatorics: C(10,3) or P(5,2)
  m = s.match(/^([CP])\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  if (m) {
    const tp = m[1].toUpperCase(), n = parseInt(m[2]), r = parseInt(m[3]);
    const res = combo(n, r, tp);
    if (res !== null) {
      return {
        type: 'combinatorics', comboType: tp, n, r, result: fmt(res),
        formula: tp === 'C'
          ? `C(${n},${r}) = ${n}! / (${r}! × ${n - r}!) = ${fmt(res)}`
          : `P(${n},${r}) = ${n}! / ${n - r}! = ${fmt(res)}`,
      };
    }
  }

  return null;
}

// ─── Main export ───────────────────────────────────────────────────
export function processInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Formula lookup
  const formula = findFormula(trimmed);
  if (formula) return { type: 'formula', ...formula };

  // 2. Special handlers
  const special = handleSpecial(trimmed);
  if (special) return special;

  // 3. Math expression evaluation
  const val = safeEval(trimmed);
  if (val !== null) {
    const cx = complexity(trimmed);
    const steps = cx !== 'simple' ? generateSteps(trimmed) : [];
    return {
      type: 'math',
      expression: trimmed,
      result: fmt(val),
      complexity: cx,
      steps,
    };
  }

  return { type: 'unknown' };
}
