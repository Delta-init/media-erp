# Frontend Design System

> Documents all design decisions — colors, typography, spacing, component patterns.
> Read this before introducing any new visual element.

---

## Typography

| Token | Value | Usage |
|-------|-------|-------|
| Font | DM Sans (`--font-dm-sans`) | All body text |
| Mono | System monospace stack | Code, IDs |

---

## Theming

- **Mode:** `class`-based dark mode via `next-themes`
- **Default:** `system` (follows OS preference)
- **CSS vars:** shadcn/ui oklch color tokens in `globals.css`
- **Dark toggle:** `ThemeToggle` component (feature 1.12)

### Key color tokens (from globals.css)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | oklch(1 0 0) | oklch(0.145 0 0) | Page background |
| `--foreground` | oklch(0.145 0 0) | oklch(0.985 0 0) | Body text |
| `--primary` | oklch(0.205 0 0) | oklch(0.922 0 0) | CTA buttons |
| `--muted` | oklch(0.97 0 0) | oklch(0.269 0 0) | Subtle backgrounds |
| `--destructive` | oklch(0.577 0.245 27.3) | oklch(0.704 0.191 22.2) | Error / delete |

---

## Animation Conventions

All animations use variants from `lib/animations.ts`:

| Variant | When to use |
|---------|-------------|
| `pageVariants` | Top-level page `<motion.div>` |
| `listVariants` + `listItemVariants` | Staggered card/row lists |
| `modalVariants` + `modalBackdropVariants` | Dialogs, sheets |
| `slideVariants` | Side panels, drawers |
| `fadeVariants` | Tooltips, popovers |
| `cardHoverVariants` | Interactive cards (whileHover) |

---

## Layout Conventions

- Max content width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Dashboard sidebar: 240px fixed (collapsed: 64px icon-only)
- Mobile breakpoint: `375px` (test at exactly 375 in browser)
- Desktop breakpoint: `1280px`

---

## Toasts (Sonner)

```ts
import { toast } from "sonner";

toast.success("Connector added");          // green
toast.error("Failed to sync");             // red
toast.loading("Syncing data…");            // spinner
toast.dismiss();                           // clear all
```

Position: `top-right`. Always `richColors`.

---
