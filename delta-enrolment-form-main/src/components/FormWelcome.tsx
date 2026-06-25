interface FormWelcomeProps { onStart: () => void; }

export function FormWelcome({ onStart }: FormWelcomeProps) {
  return (
    <div className="form-grid-bg form-grid-bg--scroll flex flex-col items-center justify-center px-4 py-12 sm:py-16 relative">

      {/* Bottom-left glow */}
      <div className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,180,216,0.16) 0%, transparent 70%)" }} />

      <div className="form-welcome relative z-10 text-center w-full max-w-md mx-auto">

        {/* Logo */}
        <div className="form-logo mb-8 flex justify-center">
          <img src="/logo.webp" alt="Delta Institutions"
            className="h-16 sm:h-20 w-auto object-contain drop-shadow-xl" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/15 border border-white/30
                        text-white text-[10px] font-extrabold uppercase tracking-[3px]
                        px-4 py-1.5 rounded-full mb-5 form-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse shrink-0" />
          Dubai · UAE · KHDA Approved
        </div>
        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase leading-[1.05] tracking-tight text-white mb-3">
          Enroll at{" "}
          <span className="text-sky-300">Delta</span>
          <br />Institutions
        </h1>
        <p className="text-white/65 text-sm sm:text-base mb-8 leading-relaxed">
          UAE's leading trading academy — complete the form to begin your journey.
        </p>

        {/* Stats */}
        <div className="flex justify-center gap-8 sm:gap-12 mb-9 form-fade-in">
          {[["7K+", "Members"], ["8+", "Years"], ["20+", "Trainers"]].map(([n, l]) => (
            <div key={l} className="text-center">
              <div className="text-2xl sm:text-3xl font-black text-sky-300 leading-none">{n}</div>
              <div className="text-[9px] text-white/45 uppercase tracking-[2px] mt-1 font-bold">{l}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStart}
            className="px-12 sm:px-16 py-4 sm:py-5 text-base sm:text-lg font-black uppercase
                       tracking-widest rounded-full shadow-2xl transition-all duration-300
                       hover:-translate-y-1 hover:shadow-sky-400/30 border-0"
            style={{ background: "#fff", color: "#0057b8", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Start Enrollment →
          </button>
          <div className="flex items-center gap-2 text-xs text-white/35 form-fade-in">
            press <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-[10px] font-mono">Enter ↵</kbd> to begin
          </div>
        </div>

        {/* Info strip */}
        <div className="mt-9 flex flex-wrap justify-center gap-5 text-xs text-white/40 form-fade-in">
          {[
            ["⏱", "~5 minutes"],
            ["📋", "21 questions"],
            ["🔒", "Secure & private"],
          ].map(([icon, label]) => (
            <span key={label} className="flex items-center gap-1.5">{icon} {label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
