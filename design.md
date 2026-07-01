# Delta Design System — mediaERP

> Unified design language inherited from **delta-enrolment-form** and applied across mediaERP.
> Source of truth for colors, typography, spacing, components, and animations.

---

## Brand Colors

| Token | Value | Usage |
|---|---|---|
| **Primary** | `#0057b8` / `hsl(213 100% 36%)` | CTAs, active states, links, focus rings |
| **Primary Dark** | `#003d80` / `hsl(213 100% 24%)` | Gradient end, hover darken |
| **Primary Hover** | `#002d80` / `hsl(213 100% 28%)` | Button hover |
| **Background** | `hsl(214 37% 97%)` | Light mode page background |
| **Foreground** | `hsl(222 47% 11%)` | Dark text, headings |
| **Card** | `#ffffff` | Card backgrounds |
| **Border** | `hsl(210 32% 88%)` | Subtle borders, dividers |
| **Muted** | `hsl(213 35% 93%)` | Disabled, placeholder |
| **Muted FG** | `hsl(215 16% 47%)` | Secondary text |
| **Error** | `#f87171` / `hsl(0 72% 51%)` | Validation errors |
| **Success** | `#10b981` | Success states |
| **Sky Accent** | `#00b4d8` | Live dots, teal glow |

### Auth / Hero Gradient
```css
background: linear-gradient(135deg, #0057b8 0%, #003d80 100%);
```

### Dark Mode
| Token | Value |
|---|---|
| Background | `oklch(0.141 0.005 285.823)` |
| Card | `oklch(0.21 0.006 285.885)` |
| Primary | `oklch(0.62 0.19 254)` (lightened) |

---

## Typography

**Font Family:** `Plus Jakarta Sans` — already loaded in `app/layout.tsx`

```css
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
-webkit-font-smoothing: antialiased;
```

| Style | Weight | Size | Usage |
|---|---|---|---|
| Display | 900 (Black) | 4xl–6xl | Hero headings, welcome screens |
| Heading | 800 (ExtraBold) | 2xl–3xl | Card titles, section headers |
| Subheading | 700 (Bold) | xl | Sub-sections |
| Body | 500 (Medium) | base (16px) | Form inputs, body text |
| Caption | 600 (SemiBold) | xs–sm | Labels, badges, meta |
| Micro | 800 (ExtraBold) uppercase | 10px | Badges, status chips |

**Letter spacing:**
- Headings: `tracking-tight` (`-0.025em`)
- Uppercase labels: `tracking-widest` (`0.1em`)
- CTA buttons: `0.4px`
- Logo mark: `0.08em`

---

## Border Radius

Base: `--radius: 0.625rem` (10px)

| Name | Value | Usage |
|---|---|---|
| `rounded-sm` | 4px | Inline badges, chips |
| `rounded-md` | 8px | Buttons, inputs |
| `rounded-lg` | 10px | Standard cards |
| `rounded-xl` | 14px | Elevated cards, modals |
| `rounded-2xl` | 18px | Feature cards |
| `rounded-3xl` | 22px | Large containers |
| `rounded-full` | 9999px | Pill buttons, avatars |

---

## Shadows

| Name | Value | Usage |
|---|---|---|
| Card (Delta) | `0 16px 56px rgba(0,45,110,0.22), 0 2px 8px rgba(0,0,0,0.06)` | `.delta-card` |
| Button glow | `0 8px 24px rgba(0,87,184,0.35)` | `.delta-btn:hover` |
| Focus ring | `0 0 0 3px rgba(0,87,184,0.12)` | Input focus |
| Error ring | `0 0 0 3px rgba(248,113,113,0.12)` | Input error |

---

## CSS Utility Classes

All defined in `app/globals.css`:

### `.delta-card`
White card with deep blue shadow. Use on any elevated content card.
```css
background: rgba(255,255,255,0.98);
border: 1.5px solid rgba(255,255,255,0.7);
border-radius: 20px;
box-shadow: 0 16px 56px rgba(0,45,110,0.22), 0 2px 8px rgba(0,0,0,0.06);
```

### `.delta-glass`
Frosted glass panel. Use on header bars, overlays, modals over the blue gradient.
```css
background: rgba(255,255,255,0.12);
backdrop-filter: blur(10px);
border: 1px solid rgba(255,255,255,0.18);
```

### `.delta-grid-bg`
Scrolling white 40px grid. Use as overlay over blue gradient backgrounds.
```css
background-image: 
  linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px);
background-size: 40px 40px;
animation: gridScroll 6s linear infinite;
```

### `.delta-btn`
Pill-shaped button with lift-on-hover. Use on primary CTAs.
```css
border-radius: 50px;
font-weight: 800;
transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
/* hover: translateY(-2px) + blue glow */
```

### Animation Utilities
| Class | Animation | Duration |
|---|---|---|
| `.delta-slide-up` | Fade + slide from 22px below | 0.65s |
| `.delta-float` | Vertical float loop | 4s |
| `.delta-pulse-dot` | Pulsing blue ring | 1.8s |

---

## Keyframe Animations

| Name | Description |
|---|---|
| `gridScroll` | Horizontal scroll of 40px background grid |
| `slideInUp` | Opacity 0→1 + translateY(22px→0) |
| `floatY` | Vertical float: 0 → -9px → 0 loop |
| `pulseDot` | Blue ring pulse radiating outward |
| `floatUp` | Auth card column up float (18–24s) |
| `floatDown` | Auth card column down float (16–22s) |
| `cardShimmer` | Opacity pulse on auth background cards |
| `driftX` | Slow X-axis drift (±18px, 32s) |
| `skeletonSweep` | Diagonal shimmer sweep on cards |

---

## Component Patterns

### Auth Page Layout
- **Background:** `linear-gradient(135deg, #0057b8 0%, #003d80 100%)`
- **Grid overlay:** `.delta-grid-bg` fixed overlay (z-0)
- **Top-right glow:** `radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)` — 420×420px
- **Bottom-left glow:** `radial-gradient(circle, rgba(0,180,216,0.16) 0%, transparent 70%)` — 320×320px
- **Cards:** `.delta-card` for login/register forms
- **Logo header:** `.delta-glass` icon badge + uppercase `font-extrabold` brand name

### Input Fields
```css
height: 48px;
border-radius: 14px;
border: 2px solid hsl(var(--border));
font-size: 16px; /* prevents iOS zoom */
font-weight: 500;
/* focus: border-color #0057b8 + 0 0 0 3px rgba(0,87,184,0.12) */
/* error:  border-color #f87171 + 0 0 0 3px rgba(248,113,113,0.12) */
```

### Buttons
- **Primary:** `bg-primary text-white` + `.delta-btn` for pill pill shape on auth CTAs
- **Default:** `rounded-md` (dashboard standard Shadcn)
- **Ghost:** Transparent with hover accent

### Badges / Status Chips
```css
font-size: 10px;
font-weight: 800;
text-transform: uppercase;
letter-spacing: 0.1em;
border-radius: 9999px;
padding: 2px 12px;
```

---

## Glassmorphism Usage

Use `.delta-glass` when placing UI elements directly over the blue gradient background:
- Auth page logo icon
- Popover panels over hero sections
- Floating action panels

Avoid using glassmorphism in the main dashboard (light/dark mode contexts) — use standard Shadcn cards there.

---

## Scrollbar

```css
scrollbar-width: thin;
scrollbar-color: #cbd5e1 transparent;
/* thumb: 4px, #cbd5e1, hover: #94a3b8 */
```

Hide scrollbar: `.no-scrollbar` utility class (defined in globals.css)

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|---|---|---|
| `sm` | 640px | Mobile landscape, small tablets |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Desktop (sidebar appears) |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1400px | Container max-width |

Mobile touch rules:
```css
touch-action: manipulation;  /* disable double-tap zoom */
font-size: 16px;             /* prevent iOS auto-zoom on inputs */
```

---

## Chart Colors

| Token | Value | Purpose |
|---|---|---|
| `--chart-1` | `oklch(0.58 0.19 254)` | Primary series (blue) |
| `--chart-2` | `oklch(0.70 0.15 228)` | Secondary series (sky) |
| `--chart-3` | `oklch(0.49 0.22 268)` | Tertiary series (violet) |
| `--chart-4` | `oklch(0.38 0.16 250)` | Dark blue series |
| `--chart-5` | `oklch(0.64 0.18 240)` | Mid-blue series |

---

## Files Reference

| File | Role |
|---|---|
| `frontend/app/globals.css` | CSS variables, Delta utilities, animations |
| `frontend/app/layout.tsx` | Root layout — font loading (Plus Jakarta Sans) |
| `frontend/app/(auth)/layout.tsx` | Auth page layout — blue gradient + grid overlay |
| `frontend/components/auth/GridBackground.tsx` | Animated card columns for auth background |
| `frontend/tailwind.config.ts` | Tailwind theme (uses CSS vars) |
| `delta-enrolment-form-main/` | Original design source |
