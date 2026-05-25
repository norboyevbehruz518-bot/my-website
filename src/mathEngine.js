const FORMULAS = {
  // Geometry
  "doira yuzi": { formula: "A = π × r²", desc: "Doira yuzi: radius kvadratini π ga ko'paytiring" },
  "doira uzunligi": { formula: "C = 2 × π × r", desc: "Doira uzunligi (perimetri)" },
  "to'g'ri to'rtburchak yuzi": { formula: "A = a × b", desc: "Uzunlik × Kenglik" },
  "uchburchak yuzi": { formula: "A = (a × h) / 2", desc: "Asos × Balandlik / 2" },
  "pifagor": { formula: "a² + b² = c²", desc: "Pifagor teoremasi: to'g'ri burchakli uchburchak uchun" },
  "shar hajmi": { formula: "V = (4/3) × π × r³", desc: "Shar hajmi" },
  "silindr hajmi": { formula: "V = π × r² × h", desc: "Silindr hajmi" },
  "kvadrat yuzi": { formula: "A = a²", desc: "Kvadrat yuzi: tomonning kvadrati" },

  // Algebra
  "kvadrat tenglama": { formula: "x = (-b ± √(b²-4ac)) / 2a", desc: "ax² + bx + c = 0 uchun kvadrat tenglama formulasi" },
  "diskriminant": { formula: "D = b² - 4ac", desc: "Kvadrat tenglama diskriminanti" },
  "arifmetik progressiya": { formula: "aₙ = a₁ + (n-1)×d", desc: "n-chi hadni topish formulasi" },
  "geometrik progressiya": { formula: "aₙ = a₁ × rⁿ⁻¹", desc: "Geometrik progressiya n-chi hadi" },

  // Physics / Math
  "tezlik": { formula: "v = s / t", desc: "Tezlik: yo'l / vaqt" },
  "foiz": { formula: "% = (qism / butun) × 100", desc: "Foizni hisoblash" },
  "o'rtacha": { formula: "x̄ = Σx / n", desc: "Arifmetik o'rtacha" },
};

function findFormula(input) {
  const lower = input.toLowerCase();
  for (const [key, val] of Object.entries(FORMULAS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function safeEval(expr) {
  const cleaned = expr
    .replace(/[^0-9+\-*/().%\s^]/g, "")
    .replace(/\^/g, "**");
  if (!cleaned.trim()) return null;
  try {
    const result = Function('"use strict"; return (' + cleaned + ')')();
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function extractExpression(input) {
  const match = input.match(/[\d+\-*/().%\s^]+/g);
  if (!match) return null;
  const expr = match.join("").trim();
  if (!/\d/.test(expr)) return null;
  return expr;
}

export function processInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Formula search
  const formula = findFormula(trimmed);
  if (formula) {
    return {
      type: "formula",
      formula: formula.formula,
      desc: formula.desc,
    };
  }

  // Math expression
  const expr = extractExpression(trimmed);
  if (expr) {
    const result = safeEval(expr);
    if (result !== null) {
      return {
        type: "math",
        expression: expr.trim(),
        result: parseFloat(result.toFixed(10)),
      };
    }
  }

  return { type: "unknown" };
}
