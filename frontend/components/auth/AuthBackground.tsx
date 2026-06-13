"use client";

import { useEffect, useRef } from "react";

interface Particle {
  hx: number; hy: number;           // home (slowly drifts)
  orbitRx: number; orbitRy: number; // elliptical orbit radius
  phaseX: number; phaseY: number;   // current orbit angle per axis
  speedX: number; speedY: number;   // orbit angular speed
  dvx: number; dvy: number;         // home drift velocity
  size: number;
  r: number; g: number; b: number;
  opBase: number; opAmp: number;
  opPhase: number; opSpeed: number;
}

const PALETTE: [number, number, number][] = [
  [245, 193, 55],   // amber  ×2 (dominant)
  [245, 193, 55],
  [129, 140, 248],  // indigo
  [255, 255, 255],  // white
];

const GLOWS = [
  { nx: 0.5,  ny: 0.52, r: 245, g: 193, b: 55,  phase: 0,              size: 0.46, peak: 0.09 },
  { nx: 0.15, ny: 0.20, r: 129, g: 140, b: 248, phase: Math.PI * 0.7,  size: 0.38, peak: 0.065 },
  { nx: 0.85, ny: 0.80, r: 245, g: 193, b: 55,  phase: Math.PI * 1.4,  size: 0.38, peak: 0.065 },
];

// 10-second breathing cycle at 60fps
const BREATHE = (2 * Math.PI) / 600;
const NUM_PARTICLES = 22;
const MAX_LINK_DIST = 210;

export default function AuthBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, raf = 0, tick = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialise particles
    const ps: Particle[] = Array.from({ length: NUM_PARTICLES }, () => {
      const [r, g, b] = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      return {
        hx: Math.random() * window.innerWidth,
        hy: Math.random() * window.innerHeight,
        orbitRx: 25 + Math.random() * 115,
        orbitRy: 25 + Math.random() * 115,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2 + 1.1,
        speedX: (4e-4 + Math.random() * 9e-4) * (Math.random() < 0.5 ? 1 : -1),
        speedY: (4e-4 + Math.random() * 9e-4) * (Math.random() < 0.5 ? 1 : -1),
        dvx: (Math.random() - 0.5) * 0.07,
        dvy: (Math.random() - 0.5) * 0.07,
        size: 1.2 + Math.random() * 2.6,
        r, g, b,
        opBase: 0.06,
        opAmp: 0.5 + Math.random() * 0.4,
        opPhase: Math.random() * Math.PI * 2,
        opSpeed: 0.0025 + Math.random() * 0.005,
      };
    });

    const xs  = new Float32Array(NUM_PARTICLES);
    const ys  = new Float32Array(NUM_PARTICLES);
    const ops = new Float32Array(NUM_PARTICLES);

    const frame = () => {
      tick++;
      ctx.clearRect(0, 0, W, H);

      const globalBreathe = 0.5 + 0.5 * Math.sin(tick * BREATHE);

      // ── 1. Ambient breathing glows ──────────────────────────────────
      for (const gl of GLOWS) {
        const br = 0.5 + 0.5 * Math.sin(tick * BREATHE + gl.phase);
        const rad = Math.min(W, H) * (gl.size + 0.06 * br);
        const cx = gl.nx * W, cy = gl.ny * H;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0,    `rgba(${gl.r},${gl.g},${gl.b},${(gl.peak * br).toFixed(3)})`);
        grd.addColorStop(0.42, `rgba(${gl.r},${gl.g},${gl.b},${(gl.peak * 0.35 * br).toFixed(3)})`);
        grd.addColorStop(1,    `rgba(${gl.r},${gl.g},${gl.b},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      }

      // ── 2. Shimmer grid (breathes with global cycle) ─────────────────
      const gridAlpha = 0.016 + 0.011 * globalBreathe;
      ctx.strokeStyle = `rgba(255,255,255,${gridAlpha.toFixed(3)})`;
      ctx.lineWidth = 0.4;
      const GS = 70;
      for (let x = 0; x <= W; x += GS) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += GS) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── 3. Update particle positions ─────────────────────────────────
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = ps[i];
        p.phaseX += p.speedX;
        p.phaseY += p.speedY;
        xs[i] = p.hx + Math.sin(p.phaseX) * p.orbitRx;
        ys[i] = p.hy + Math.cos(p.phaseY) * p.orbitRy;

        p.hx += p.dvx;
        p.hy += p.dvy;
        if (p.hx < -130) p.hx = W + 130;
        if (p.hx > W + 130) p.hx = -130;
        if (p.hy < -130) p.hy = H + 130;
        if (p.hy > H + 130) p.hy = -130;

        ops[i] = p.opBase + p.opAmp * (0.5 + 0.5 * Math.sin(tick * p.opSpeed + p.opPhase));
      }

      // ── 4. Constellation links ────────────────────────────────────────
      ctx.lineWidth = 0.5;
      for (let i = 0; i < NUM_PARTICLES; i++) {
        for (let j = i + 1; j < NUM_PARTICLES; j++) {
          const dx = xs[i] - xs[j];
          const dy = ys[i] - ys[j];
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_LINK_DIST) {
            const alpha = (1 - d / MAX_LINK_DIST) * 0.14 * Math.min(ops[i], ops[j]);
            ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(xs[i], ys[i]);
            ctx.lineTo(xs[j], ys[j]);
            ctx.stroke();
          }
        }
      }

      // ── 5. Particles (halo + core dot) ───────────────────────────────
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = ps[i];
        const op = ops[i];
        const x = xs[i], y = ys[i];

        // Soft halo
        const hr = p.size * 8;
        const halo = ctx.createRadialGradient(x, y, 0, x, y, hr);
        halo.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${(op * 0.22).toFixed(3)})`);
        halo.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, y, hr, 0, Math.PI * 2); ctx.fill();

        // Core
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${Math.min(op, 1).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    };

    frame();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        transform: "translateZ(0)", // GPU layer hint
      }}
    />
  );
}
