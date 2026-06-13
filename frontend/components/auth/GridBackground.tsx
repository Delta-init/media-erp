"use client";

import React from "react";

// ── Brand palette helpers ──────────────────────────────────────────────────────
const a = (o: number) => `rgba(245,193,55,${o})`;   // amber
const id = (o: number) => `rgba(129,140,248,${o})`;  // indigo
const w = (o: number) => `rgba(255,255,255,${o})`;   // white
const dk = (o: number) => `rgba(7,7,15,${o})`;       // dark

// ── Reusable decoration helpers ───────────────────────────────────────────────
function Dot({ size, color, style }: { size: number; color: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        ...style,
      }}
    />
  );
}

function Bar({ width, height, color, style }: { width: string | number; height: number; color: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: 3,
        background: color,
        ...style,
      }}
    />
  );
}

// ── Card component ─────────────────────────────────────────────────────────────
function GridCard({
  height,
  bg,
  border,
  shimmerDelay,
  children,
}: {
  height: number;
  bg: string;
  border?: string;
  shimmerDelay: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="grid-card"
      style={{
        height,
        background: bg,
        borderRadius: 14,
        border: border ?? `1px solid ${w(0.07)}`,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        willChange: "opacity",
        animationDelay: `${shimmerDelay}s`,
      }}
    >
      {/* Skeleton shimmer sweep */}
      <div
        className="skeleton-sweep"
        style={{ animationDelay: `${shimmerDelay * 0.8}s` }}
      />
      {children}
    </div>
  );
}

// ── Column configs ─────────────────────────────────────────────────────────────
// Each column: animation direction, duration, and negative delay to desync
const COL_ANIM = [
  { name: "floatUp",   dur: 18, del: 0   },
  { name: "floatDown", dur: 22, del: -7  },
  { name: "floatUp",   dur: 20, del: -4  },
  { name: "floatDown", dur: 16, del: -11 },
  { name: "floatUp",   dur: 24, del: -9  },
] as const;

// ── Card data for each of the 5 columns ───────────────────────────────────────
type CardDef = { h: number; bg: string; border?: string; sd: number; c?: React.ReactNode };

const COLS: CardDef[][] = [
  // ── Column 1 (amber-heavy) ─────────────────────────────────────────────────
  [
    {
      h: 200, bg: `linear-gradient(145deg, ${a(0.92)} 0%, rgba(180,120,15,0.82) 100%)`,
      sd: 0,
      c: <>
        <Dot size={90}  color={dk(0.28)} style={{ bottom: -25, right: -25 }} />
        <Dot size={35}  color={dk(0.18)} style={{ top: 22, left: 22 }} />
        <Bar width="60%" height={5} color={dk(0.14)} style={{ bottom: 44, left: 18 }} />
        <Bar width="40%" height={5} color={dk(0.10)} style={{ bottom: 58, left: 18 }} />
      </>,
    },
    {
      h: 140, bg: `linear-gradient(160deg, ${dk(1)} 0%, rgba(30,22,5,1) 100%)`,
      sd: 2.5,
      c: <>
        <Bar width="68%" height={4} color={a(0.55)} style={{ top: 28, left: 16 }} />
        <Bar width="44%" height={4} color={a(0.35)} style={{ top: 42, left: 16 }} />
        <Dot size={16}  color={a(0.5)} style={{ bottom: 22, right: 18 }} />
        <Dot size={8}   color={a(0.3)} style={{ bottom: 26, right: 42 }} />
      </>,
    },
    {
      h: 220, bg: `linear-gradient(135deg, ${id(0.82)} 0%, rgba(79,70,229,0.72) 100%)`,
      sd: 1.2,
      c: <>
        <Dot size={110} color={w(0.06)}  style={{ top: -30, right: -30 }} />
        <Dot size={45}  color={w(0.09)}  style={{ bottom: 35, left: 18 }} />
        <Bar width="62%" height={4} color={w(0.22)} style={{ bottom: 55, left: 18 }} />
        <Bar width="42%" height={4} color={w(0.14)} style={{ bottom: 68, left: 18 }} />
      </>,
    },
    {
      h: 155, bg: `linear-gradient(160deg, #0d0c1a 0%, #1e1840 100%)`,
      sd: 3.8,
      c: <>
        <Dot size={55}  color={id(0.18)} style={{ top: -14, right: 12 }} />
        <Bar width="78%" height={3} color={id(0.4)} style={{ top: 32, left: 16 }} />
        <Bar width="54%" height={3} color={id(0.28)} style={{ top: 44, left: 16 }} />
        <Bar width="66%" height={3} color={id(0.22)} style={{ top: 56, left: 16 }} />
      </>,
    },
    {
      h: 190, bg: `linear-gradient(135deg, ${a(0.88)} 0%, rgba(140,90,10,0.8) 100%)`,
      sd: 5.5,
      c: <>
        <Dot size={65}  color={dk(0.22)} style={{ top: 18, right: 18 }} />
        <Bar width="52%" height={6} color={dk(0.16)} style={{ bottom: 48, left: 18 }} />
        <Bar width="34%" height={6} color={dk(0.11)} style={{ bottom: 62, left: 18 }} />
      </>,
    },
  ],

  // ── Column 2 ───────────────────────────────────────────────────────────────
  [
    {
      h: 155, bg: `linear-gradient(135deg, ${id(0.72)} 0%, ${id(0.5)} 100%)`,
      sd: 1.5,
      c: <>
        <Dot size={85}  color={w(0.06)}  style={{ bottom: -28, left: -18 }} />
        <Bar width="70%" height={4} color={w(0.2)}  style={{ top: 28, left: 16 }} />
        <Bar width="48%" height={4} color={w(0.12)} style={{ top: 41, left: 16 }} />
      </>,
    },
    {
      h: 215, bg: `linear-gradient(160deg, #070a12 0%, #0f1420 100%)`,
      sd: 0.8,
      c: <>
        <Dot size={38}  color={a(0.55)} style={{ top: 20, right: 16 }} />
        <Dot size={18}  color={a(0.32)} style={{ top: 27, right: 62 }} />
        <Bar width="74%" height={3} color={w(0.07)} style={{ bottom: 52, left: 16 }} />
        <Bar width="54%" height={3} color={w(0.05)} style={{ bottom: 64, left: 16 }} />
        <Bar width="38%" height={3} color={w(0.04)} style={{ bottom: 76, left: 16 }} />
      </>,
    },
    {
      h: 148, bg: `linear-gradient(135deg, ${a(0.9)} 0%, rgba(180,118,14,0.82) 100%)`,
      sd: 4.2,
      c: <>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 90, background: dk(0.14), borderRadius: "0 0 14px 14px" }} />
        <Dot size={32}  color={dk(0.28)} style={{ top: 18, right: 18 }} />
        <Dot size={16}  color={dk(0.18)} style={{ top: 24, right: 56 }} />
      </>,
    },
    {
      h: 200, bg: `linear-gradient(135deg, rgba(79,70,229,0.78) 0%, ${id(0.62)} 100%)`,
      sd: 2.1,
      c: <>
        <Dot size={115} color={w(0.06)}  style={{ top: -42, right: -42 }} />
        <Bar width="62%" height={5} color={w(0.22)} style={{ bottom: 42, left: 16 }} />
        <Bar width="40%" height={5} color={w(0.14)} style={{ bottom: 56, left: 16 }} />
      </>,
    },
    {
      h: 168, bg: `linear-gradient(160deg, #0d0c1a 0%, #200f30 100%)`,
      sd: 6.0,
      c: <>
        <Dot size={48}  color={a(0.38)}  style={{ bottom: 18, right: 18 }} />
        <Dot size={22}  color={id(0.4)}  style={{ top: 20, left: 20 }} />
        <Bar width="62%" height={3} color={a(0.22)} style={{ top: 52, left: 16 }} />
        <Bar width="42%" height={3} color={a(0.14)} style={{ top: 64, left: 16 }} />
      </>,
    },
  ],

  // ── Column 3 (center) ──────────────────────────────────────────────────────
  [
    {
      h: 188, bg: `linear-gradient(160deg, #07070f 0%, #1a0f05 100%)`,
      sd: 2.8,
      c: <>
        <Bar width="78%" height={5} color={a(0.48)} style={{ top: 28, left: 16 }} />
        <Bar width="55%" height={5} color={a(0.32)} style={{ top: 42, left: 16 }} />
        <Bar width="68%" height={5} color={a(0.22)} style={{ top: 56, left: 16 }} />
        <Dot size={28}  color={a(0.58)} style={{ bottom: 24, right: 18 }} />
        <Dot size={14}  color={a(0.38)} style={{ bottom: 30, right: 52 }} />
      </>,
    },
    {
      h: 150, bg: `linear-gradient(135deg, ${a(0.86)} 25%, ${id(0.72)} 100%)`,
      sd: 0.4,
      c: <>
        <Dot size={55}  color={w(0.1)}  style={{ top: -14, left: -14 }} />
        <Bar width="64%" height={4} color={w(0.28)} style={{ bottom: 34, right: 16 }} />
        <Bar width="44%" height={4} color={w(0.18)} style={{ bottom: 47, right: 16 }} />
      </>,
    },
    {
      h: 235, bg: `linear-gradient(160deg, rgba(30,28,80,0.88) 0%, rgba(79,70,229,0.7) 100%)`,
      sd: 5.0,
      c: <>
        <Dot size={95}  color={w(0.06)}  style={{ top: -22, right: -22 }} />
        <Dot size={38}  color={a(0.42)}  style={{ bottom: 28, left: 18 }} />
        <Bar width="70%" height={4} color={w(0.18)} style={{ top: 50, left: 16 }} />
        <Bar width="48%" height={4} color={w(0.12)} style={{ top: 63, left: 16 }} />
      </>,
    },
    {
      h: 148, bg: `linear-gradient(135deg, #f5c137 0%, #c47a10 100%)`,
      sd: 3.3,
      c: <>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 52, background: dk(0.16), borderRadius: "14px 14px 0 0" }} />
        <Dot size={20}  color={a(0.55)} style={{ bottom: 22, left: 18 }} />
        <Bar width="58%" height={4} color={dk(0.15)} style={{ bottom: 40, right: 16 }} />
      </>,
    },
    {
      h: 200, bg: `linear-gradient(160deg, #07070f 0%, #0c0c1a 100%)`,
      sd: 7.0,
      c: <>
        <Dot size={95}  color={id(0.12)} style={{ bottom: -28, right: -28 }} />
        <Bar width="74%" height={3} color={id(0.3)}  style={{ top: 28, left: 16 }} />
        <Bar width="52%" height={3} color={id(0.22)} style={{ top: 40, left: 16 }} />
        <Bar width="38%" height={3} color={id(0.15)} style={{ top: 52, left: 16 }} />
      </>,
    },
  ],

  // ── Column 4 ───────────────────────────────────────────────────────────────
  [
    {
      h: 168, bg: `linear-gradient(135deg, ${id(0.78)} 0%, rgba(60,52,200,0.72) 100%)`,
      sd: 1.0,
      c: <>
        <Dot size={65}  color={a(0.2)}  style={{ top: -18, right: -10 }} />
        <Bar width="64%" height={5} color={w(0.2)}  style={{ bottom: 34, left: 16 }} />
        <Bar width="42%" height={5} color={w(0.12)} style={{ bottom: 48, left: 16 }} />
      </>,
    },
    {
      h: 202, bg: `linear-gradient(160deg, #100a00 0%, #2a1a02 100%)`,
      sd: 3.5,
      c: <>
        <Bar width="78%" height={5} color={a(0.52)} style={{ top: 24, left: 16 }} />
        <Bar width="58%" height={5} color={a(0.36)} style={{ top: 38, left: 16 }} />
        <Bar width="44%" height={5} color={a(0.24)} style={{ top: 52, left: 16 }} />
        <Dot size={38}  color={a(0.15)} style={{ bottom: 18, right: 16 }} />
      </>,
    },
    {
      h: 148, bg: `linear-gradient(135deg, ${a(0.9)} 0%, rgba(245,193,55,0.68) 100%)`,
      sd: 6.5,
      c: <>
        <Dot size={58}  color={dk(0.2)}  style={{ top: 14, right: 14 }} />
        <Bar width="70%" height={6} color={dk(0.14)} style={{ bottom: 34, left: 16 }} />
        <Bar width="50%" height={6} color={dk(0.09)} style={{ bottom: 48, left: 16 }} />
      </>,
    },
    {
      h: 188, bg: `linear-gradient(160deg, #0d1225 0%, #1a2040 100%)`,
      sd: 2.0,
      c: <>
        <Dot size={75}  color={id(0.18)} style={{ bottom: -14, right: -14 }} />
        <Dot size={32}  color={a(0.52)}  style={{ top: 18, left: 18 }} />
        <Bar width="60%" height={3} color={w(0.14)} style={{ top: 58, left: 16 }} />
        <Bar width="40%" height={3} color={w(0.09)} style={{ top: 70, left: 16 }} />
      </>,
    },
    {
      h: 172, bg: `linear-gradient(135deg, rgba(79,70,229,0.82) 0%, #818cf8 100%)`,
      sd: 4.8,
      c: <>
        <Dot size={105} color={w(0.05)}  style={{ top: -40, left: -40 }} />
        <Bar width="64%" height={5} color={w(0.24)} style={{ bottom: 34, right: 16 }} />
        <Bar width="44%" height={5} color={w(0.15)} style={{ bottom: 48, right: 16 }} />
        <Dot size={18}  color={a(0.5)}   style={{ top: 20, right: 18 }} />
      </>,
    },
  ],

  // ── Column 5 ───────────────────────────────────────────────────────────────
  [
    {
      h: 198, bg: `linear-gradient(160deg, #07070f 0%, #14100a 100%)`,
      sd: 1.8,
      c: <>
        <Dot size={28}  color={a(0.62)} style={{ top: 20, right: 20 }} />
        <Dot size={14}  color={a(0.42)} style={{ top: 26, right: 56 }} />
        <Dot size={8}   color={a(0.28)} style={{ top: 30, right: 78 }} />
        <Bar width="78%" height={3} color={w(0.07)} style={{ bottom: 48, left: 16 }} />
        <Bar width="58%" height={3} color={w(0.05)} style={{ bottom: 60, left: 16 }} />
      </>,
    },
    {
      h: 148, bg: `linear-gradient(135deg, ${a(0.84)} 0%, rgba(180,128,18,0.8) 100%)`,
      sd: 4.5,
      c: <>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 68, background: dk(0.15), borderRadius: "0 0 14px 14px" }} />
        <Dot size={24}  color={dk(0.32)} style={{ top: 18, right: 18 }} />
        <Dot size={12}  color={dk(0.22)} style={{ top: 22, right: 46 }} />
      </>,
    },
    {
      h: 215, bg: `linear-gradient(135deg, ${id(0.68)} 0%, rgba(40,35,150,0.78) 100%)`,
      sd: 0.6,
      c: <>
        <Dot size={95}  color={w(0.07)}  style={{ bottom: -28, left: -28 }} />
        <Bar width="74%" height={5} color={w(0.2)}  style={{ top: 28, left: 16 }} />
        <Bar width="50%" height={5} color={w(0.12)} style={{ top: 42, left: 16 }} />
        <Dot size={18}  color={a(0.52)}  style={{ top: 20, right: 18 }} />
      </>,
    },
    {
      h: 162, bg: `linear-gradient(160deg, #1a0805 0%, #2a1205 100%)`,
      sd: 5.8,
      c: <>
        <Bar width="70%" height={5} color={a(0.48)} style={{ top: 26, left: 16 }} />
        <Bar width="50%" height={5} color={a(0.32)} style={{ top: 40, left: 16 }} />
        <Bar width="35%" height={5} color={a(0.22)} style={{ top: 54, left: 16 }} />
        <Dot size={42}  color={a(0.18)} style={{ bottom: 14, right: 14 }} />
      </>,
    },
    {
      h: 182, bg: `linear-gradient(135deg, rgba(60,52,180,0.78) 0%, ${id(0.62)} 100%)`,
      sd: 3.0,
      c: <>
        <Dot size={78}  color={a(0.14)}  style={{ top: -20, right: -20 }} />
        <Bar width="64%" height={4} color={w(0.22)} style={{ bottom: 34, left: 16 }} />
        <Bar width="44%" height={4} color={w(0.14)} style={{ bottom: 47, left: 16 }} />
      </>,
    },
  ],
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function GridBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {/* ── X-axis drift wrapper (independent of Y column float) ── */}
      <div
        style={{
          width: "100%",
          height: "100%",
          animation: "driftX 32s ease-in-out infinite",
          willChange: "transform",
        }}
      >
      {/* ── Grid of columns (scaled up slightly to cover float overshoot) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          padding: 12,
          height: "100%",
          transform: "scale(1.1)",
          transformOrigin: "center center",
        }}
      >
        {COLS.map((cards, ci) => {
          const { name, dur, del } = COL_ANIM[ci];
          return (
            <div
              key={ci}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                willChange: "transform",
                animation: `${name} ${dur}s ease-in-out ${del}s infinite`,
              }}
            >
              {cards.map((card, ki) => (
                <GridCard
                  key={ki}
                  height={card.h}
                  bg={card.bg}
                  border={card.border}
                  shimmerDelay={card.sd}
                >
                  {card.c}
                </GridCard>
              ))}
            </div>
          );
        })}
      </div>
      </div>{/* end X-drift wrapper */}

      {/* ── Top + Bottom dark vignette ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, #090A0F 0%, transparent 22%, transparent 78%, #090A0F 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Left + Right edge fade ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, #090A0F 0%, transparent 12%, transparent 88%, #090A0F 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Center radial darkening (improves card legibility) ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 55% 55% at 50% 50%, transparent 0%, rgba(9,10,15,0.55) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </div>
  );
}
