import Link from "next/link";
import Image from "next/image";
import GridBackground from "@/components/auth/GridBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #0057b8 0%, #003d80 100%)" }}
    >
      {/* Enrollment-form style: scrolling white grid lines */}
      <div
        aria-hidden
        className="delta-grid-bg"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Top-right radial glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: -100,
          right: -100,
          width: 420,
          height: 420,
          background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 65%)",
          borderRadius: "50%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Bottom-left teal glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          bottom: -80,
          left: -80,
          width: 320,
          height: 320,
          background: "radial-gradient(circle, rgba(0,180,216,0.16) 0%, transparent 70%)",
          borderRadius: "50%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Living grid background: staggered floating columns, pulse shimmer, vignette */}
      <GridBackground />

      {/* Top-left logo — delta-logo.png (white wordmark) on blue gradient */}
      <header className="relative flex items-center px-8 pt-7" style={{ zIndex: 10 }}>
        <Link href="/" className="flex items-center group">
          <Image
            src="/delta-logo.png"
            alt="Delta"
            width={120}
            height={54}
            priority
            unoptimized
            style={{
              objectFit: "contain",
              objectPosition: "left center",
              filter: "brightness(0) invert(1)",
              transition: "opacity 0.2s ease",
            }}
            className="group-hover:opacity-80"
          />
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
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.08em",
          }}
        >
          © 2026 Delta Institutions &middot; mediaERP
        </p>
      </footer>
    </div>
  );
}
