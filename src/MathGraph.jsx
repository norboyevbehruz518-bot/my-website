import { useEffect, useRef } from 'react';
import { compile } from 'mathjs';

// ── Color palette ─────────────────────────────────────────────────────
const C = {
  main:       '#7c6bff',
  derivative: '#34d399',
  integral:   '#a78bfa',
  c:          '#f87171',
  d:          '#fbbf24',
  e:          '#38bdf8',
};
const CLIST = Object.values(C);

function ease(t) { return 1 - Math.pow(1 - t, 2.8); }

function gridStep(range) {
  if (range <= 1)   return 0.25;
  if (range <= 3)   return 0.5;
  if (range <= 8)   return 1;
  if (range <= 20)  return 2;
  if (range <= 60)  return 5;
  return 10;
}

// ── Evaluate function expression into {x,y} points ───────────────────
function evalPoints(expr, xMin, xMax, N = 1000) {
  let fn;
  try { fn = compile(expr); } catch { return []; }

  const pts = [];
  let prevY = null;

  for (let i = 0; i <= N; i++) {
    const x = xMin + (i / N) * (xMax - xMin);
    let y;
    try { y = fn.evaluate({ x, pi: Math.PI, e: Math.E }); }
    catch { pts.push(null); prevY = null; continue; }

    if (!isFinite(y) || isNaN(y) || Math.abs(y) > 1e9) {
      pts.push(null); prevY = null; continue;
    }
    // Detect asymptote / discontinuity
    if (prevY !== null && Math.abs(y - prevY) > 60) {
      pts.push(null);
    }
    pts.push({ x, y });
    prevY = y;
  }
  return pts;
}

// ── Auto-detect yRange from computed points ───────────────────────────
function autoYRange(allMathPts, padding = 0.18) {
  const ys = allMathPts.flat().filter(Boolean).map(p => p.y);
  if (!ys.length) return [-8, 8];
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (Math.abs(hi - lo) < 0.001) { lo -= 2; hi += 2; }
  const r = hi - lo;
  return [lo - r * padding, hi + r * padding];
}

// ── Main component ────────────────────────────────────────────────────
export default function MathGraph({ graphData }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData?.functions?.length) return;

    cancelAnimationFrame(rafRef.current);

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 560;
    const H   = 310;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const xMin = graphData.xRange?.[0] ?? -8;
    const xMax = graphData.xRange?.[1] ??  8;

    // Pre-compute math-space points for every function
    const allMathPts = graphData.functions.map(fn =>
      evalPoints(fn.expr, xMin, xMax)
    );

    // Resolve y range
    let yMin = graphData.yRange?.[0];
    let yMax = graphData.yRange?.[1];
    if (yMin == null || yMax == null) [yMin, yMax] = autoYRange(allMathPts);

    // Coord transforms
    const tx = x => ((x - xMin) / (xMax - xMin)) * W;
    const ty = y => H - ((y - yMin) / (yMax - yMin)) * H;

    // Pixel-space points for each function
    const allPxPts = allMathPts.map(pts =>
      pts.map(p => p ? { px: tx(p.x), py: ty(p.y) } : null)
    );

    // Shade-region compiled fn
    let shadeFn = null;
    if (graphData.shadeRegion && graphData.functions[0]) {
      try { shadeFn = compile(graphData.functions[0].expr); } catch {}
    }

    // ── Static elements (BG, grid, axes) ───────────────────────
    function drawStatic() {
      // Background
      ctx.fillStyle = '#07070e';
      ctx.fillRect(0, 0, W, H);

      // Subtle dot grid
      ctx.fillStyle = 'rgba(255,255,255,.028)';
      const gs = 26;
      for (let gx = gs/2; gx < W; gx += gs)
        for (let gy = gs/2; gy < H; gy += gs) {
          ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI*2); ctx.fill();
        }

      // Grid lines
      const xstep = gridStep(xMax - xMin);
      const ystep = gridStep(yMax - yMin);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      for (let x = Math.ceil(xMin/xstep)*xstep; x <= xMax + xstep*.01; x += xstep) {
        ctx.beginPath(); ctx.moveTo(tx(x), 0); ctx.lineTo(tx(x), H); ctx.stroke();
      }
      for (let y = Math.ceil(yMin/ystep)*ystep; y <= yMax + ystep*.01; y += ystep) {
        ctx.beginPath(); ctx.moveTo(0, ty(y)); ctx.lineTo(W, ty(y)); ctx.stroke();
      }

      // Axes
      const ay = Math.max(0, Math.min(H, ty(0)));
      const ax = Math.max(0, Math.min(W, tx(0)));
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(W - 10, ay); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax, H); ctx.lineTo(ax, 10); ctx.stroke();

      // Arrow heads
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.moveTo(W-10, ay-4); ctx.lineTo(W, ay); ctx.lineTo(W-10, ay+4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(ax-4, 10); ctx.lineTo(ax, 0); ctx.lineTo(ax+4, 10); ctx.fill();

      // Axis labels
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.font = 'italic 12px -apple-system,sans-serif';
      ctx.textAlign = 'left';  ctx.fillText('x', W - 7, ay - 7);
      ctx.textAlign = 'center'; ctx.fillText('y', ax + 9, 12);

      // Tick numbers
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.font = '10px -apple-system,sans-serif';
      ctx.textAlign = 'center';
      for (let x = Math.ceil(xMin/xstep)*xstep; x <= xMax; x += xstep) {
        if (Math.abs(x) < xstep * 0.01) continue;
        const label = Math.abs(x) < 100 ? +x.toFixed(2) : x.toFixed(0);
        const labelY = Math.min(Math.max(ay + 13, 13), H - 4);
        ctx.fillText(label, tx(x), labelY);
      }
      ctx.textAlign = 'right';
      for (let y = Math.ceil(yMin/ystep)*ystep; y <= yMax; y += ystep) {
        if (Math.abs(y) < ystep * 0.01) continue;
        const py = ty(y);
        if (py < 6 || py > H - 6) continue;
        const label = Math.abs(y) < 100 ? +y.toFixed(2) : y.toFixed(0);
        const labelX = Math.max(ax - 6, 32);
        ctx.fillText(label, labelX, py + 3.5);
      }
    }

    // ── Draw one function path up to `prog` (0–1) ───────────────
    function drawFn(pxPts, color, prog) {
      const upTo = Math.floor(pxPts.length * prog);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;

      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < upTo; i++) {
        if (!pxPts[i]) { moved = false; continue; }
        if (!moved) { ctx.moveTo(pxPts[i].px, pxPts[i].py); moved = true; }
        else ctx.lineTo(pxPts[i].px, pxPts[i].py);
      }
      ctx.stroke();

      // Glow layer
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur  = 12;
      ctx.globalAlpha = 0.28;
      ctx.stroke();
      ctx.restore();

      // Live drawing dot at tip
      if (upTo > 0 && prog < 0.99) {
        let tip = null;
        for (let i = upTo - 1; i >= 0; i--) {
          if (pxPts[i]) { tip = pxPts[i]; break; }
        }
        if (tip) {
          ctx.save();
          ctx.fillStyle  = color;
          ctx.shadowColor = color;
          ctx.shadowBlur  = 20;
          ctx.beginPath(); ctx.arc(tip.px, tip.py, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }

    // ── Shade region ────────────────────────────────────────────
    function drawShade(alpha) {
      if (!shadeFn || !graphData.shadeRegion) return;
      const { from, to } = graphData.shadeRegion;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(tx(from), ty(0));
      const N = 400;
      for (let i = 0; i <= N; i++) {
        const x = from + (i / N) * (to - from);
        let y;
        try { y = shadeFn.evaluate({ x, pi: Math.PI, e: Math.E }); } catch { continue; }
        if (!isFinite(y)) continue;
        ctx.lineTo(tx(x), ty(y));
      }
      ctx.lineTo(tx(to), ty(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(124,107,255,0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(124,107,255,0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Shade label
      if (graphData.shadeRegion.label) {
        const midX = tx((from + to) / 2);
        let midY = ty(0) - 20;
        try {
          const mv = shadeFn.evaluate({ x: (from+to)/2, pi: Math.PI, e: Math.E });
          if (isFinite(mv)) midY = ty(mv / 2);
        } catch {}
        ctx.fillStyle = 'rgba(167,139,250,0.9)';
        ctx.font = '11px -apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(graphData.shadeRegion.label, midX, midY);
      }
      ctx.restore();
    }

    // ── Key points ──────────────────────────────────────────────
    function drawPoints(alpha) {
      if (!graphData.points?.length) return;
      ctx.save();
      graphData.points.forEach(pt => {
        const px = tx(pt.x);
        const py = ty(pt.y);
        if (px < -10 || px > W + 10 || py < -10 || py > H + 10) return;

        // Pulse ring
        ctx.strokeStyle = C.main;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = alpha * 0.45;
        ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.stroke();

        // Solid dot
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = C.main; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        if (pt.label) {
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.font = '11.5px -apple-system,sans-serif';
          ctx.textAlign = 'left';
          ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 5;
          ctx.fillText(pt.label, px + 13, py - 2);
          ctx.shadowBlur = 0;
        }
      });
      ctx.restore();
    }

    // ── Animation ───────────────────────────────────────────────
    const DURATION = 1300;
    const t0 = performance.now();

    function frame(now) {
      const raw  = Math.min((now - t0) / DURATION, 1);
      const prog = ease(raw);

      drawStatic();

      // Shade at 35%+
      if (prog > 0.35) drawShade(Math.min((prog - 0.35) / 0.28, 1));

      // Functions: staggered start (each 0.18 apart)
      allPxPts.forEach((pts, i) => {
        const start  = i * 0.18;
        const fnProg = Math.max(0, Math.min((prog - start) / (1 - start + 0.02), 1));
        const color  = C[graphData.functions[i].color] || CLIST[i % CLIST.length];
        if (fnProg > 0) drawFn(pts, color, fnProg);
      });

      // Points at 80%+
      if (prog > 0.8) drawPoints(Math.min((prog - 0.8) / 0.2, 1));

      if (raw < 1) rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graphData]);

  if (!graphData?.functions?.length) return null;

  return (
    <div className="mg-wrap">
      <div className="mg-header">
        <div className="mg-badge">
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="2,16 7,8 12,12 18,4" />
          </svg>
        </div>
        <span className="mg-title">Graph</span>
        <div className="mg-legend">
          {graphData.functions.map((fn, i) => (
            <span key={i} className="mg-legend-item">
              <span
                className="mg-legend-line"
                style={{ background: C[fn.color] || CLIST[i % CLIST.length] }}
              />
              {fn.label || fn.expr}
            </span>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="mg-canvas" />

      {graphData.annotations?.length > 0 && (
        <div className="mg-annots">
          {graphData.annotations.map((a, i) => (
            <span key={i} className="mg-annot">📐 {a}</span>
          ))}
        </div>
      )}
    </div>
  );
}
