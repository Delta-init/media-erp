import Link from "next/link";
import { BarChart2 } from "lucide-react";
import GridBackground from "@/components/auth/GridBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ background: "oklch(0.082 0.006 280)" }}
    >
      {/* Living grid background: staggered floating columns, pulse shimmer, vignette */}
      <GridBackground />

      {/* Top-left logo */}
      <header className="relative flex items-center gap-2.5 px-8 pt-8" style={{ zIndex: 10 }}>
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: "rgba(245,193,55,1)" }}
          >
            <BarChart2 style={{ color: "#3d2a07", width: 16, height: 16 }} />
          </div>
          <span
            style={{
              color: "rgba(255,255,255,0.78)",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.055em",
            }}
          >
            mediaERP
          </span>
        </Link>
      </header>

      {/* Centered auth content */}
      <main
        className="relative flex flex-1 items-center justify-center p-6"
        style={{ zIndex: 10 }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer className="relative pb-7 text-center" style={{ zIndex: 10 }}>
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.16)",
            letterSpacing: "0.08em",
          }}
        >
          © 2026 Delta Institutions &middot; mediaERP
        </p>
      </footer>
    </div>
  );
}
