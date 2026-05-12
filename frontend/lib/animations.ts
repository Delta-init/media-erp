import type { Variants, Transition } from "framer-motion";

// ── Page transitions ──────────────────────────────────────────────────────────

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

export const pageTransition: Transition = {
  type: "tween",
  duration: 0.22,
  ease: "easeOut",
};

// ── Staggered list ────────────────────────────────────────────────────────────

export const listVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 1, 0.5, 1] } },
};

// ── Modal / dialog ────────────────────────────────────────────────────────────

export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15, ease: "easeIn" } },
};

// ── Slide in (sidebar / panel) ────────────────────────────────────────────────

export const slideVariants: Variants = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0,   transition: { duration: 0.25, ease: "easeOut" } },
  exit:    { opacity: 0, x: -24, transition: { duration: 0.2,  ease: "easeIn"  } },
};

// ── Mobile drawer (slides from left edge) ────────────────────────────────────

export const drawerVariants: Variants = {
  initial: { x: "-100%" },
  animate: { x: 0,       transition: { type: "spring", stiffness: 320, damping: 34 } },
  exit:    { x: "-100%", transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

// ── Backdrop (mobile sidebar overlay) ────────────────────────────────────────

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};

// ── Simple fade ───────────────────────────────────────────────────────────────

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

// ── Card hover (used with whileHover) ─────────────────────────────────────────

export const cardHoverVariants: Variants = {
  rest:  { scale: 1, y: 0,    boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)" },
  hover: { scale: 1.015, y: -2, boxShadow: "0 8px 25px -5px rgb(0 0 0 / 0.15)", transition: { duration: 0.18, ease: "easeOut" } },
};

export const cardHoverTransition: Transition = { duration: 0.15, ease: "easeOut" };

// ── Nav item (sidebar) ────────────────────────────────────────────────────────

export const navItemVariants: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

// ── Header slide-down ─────────────────────────────────────────────────────────

export const headerVariants: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.28, ease: "easeOut" } },
};

// ── KPI / stat card stagger ───────────────────────────────────────────────────

export const kpiContainerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

export const kpiCardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.3, ease: [0.25, 1, 0.5, 1] } },
};
