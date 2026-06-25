import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, ChevronDown, AlertCircle, X, Upload, Check, Loader2, ScrollText, Camera, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ──────────────────── types ────────────────────────────── */
interface Question {
  id: string;
  type: "text"|"email"|"tel"|"textarea"|"select"|"date"|"file"|"checkbox";
  title: string; subtitle?: string; required: boolean;
  options?: string[]; placeholder?: string; multiple?: boolean; maxFiles?: number;
  accept?: string;
  groups?: { label: string; icon: string; options: string[] }[];
}
interface Props {
  question: Question; questionNumber: number; totalQuestions: number;
  value: any; onChange: (v: any) => void;
  onNext: () => void; onPrevious: () => void;
  canGoNext: boolean; isFirst: boolean; isLast: boolean;
  allAnswers: Record<string, any>; direction: "left" | "right";
  isSubmitting?: boolean;
}

/* ──────────────── section config ───────────────────────── */
const SECTIONS = [
  { label: "Personal", icon: "👤", from: 1, to: 10 },
  { label: "Address", icon: "📍", from: 11, to: 14 },
  { label: "Documents", icon: "📎", from: 15, to: 16 },
  { label: "Course", icon: "📚", from: 17, to: 21 },
  { label: "Finalise", icon: "💳", from: 22, to: 23 },
];
const getSection = (n: number) => SECTIONS.find(s => n >= s.from && n <= s.to);

/* ── Render plain text with [text](url) links as real anchors ── */
function renderWithLinks(text: string) {
  // Matches [label](url) — url must not contain unencoded ")"
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    parts.push(
      <a key={i++} href={m[2]} target="_blank" rel="noopener noreferrer"
        className="text-primary font-bold underline underline-offset-2 hover:opacity-75 transition-opacity"
        onClick={(e) => e.stopPropagation()}>
        {m[1]}
      </a>
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/* ── Grouped checkbox (courses) ─────────────────────────────── */
interface CourseGroup { label: string; icon: string; options: string[] }
function GroupedCheckbox({ groups, selected, onToggle }: {
  groups: CourseGroup[]; selected: string[]; onToggle: (opt: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map(g => [g.label, true]))
  );
  return (
    <div className="flex flex-col gap-2">
      {groups.map(group => {
        const isOpen = open[group.label];
        const cnt = group.options.filter(o => selected.includes(o)).length;
        return (
          <div key={group.label} className="rounded-xl border-2 border-slate-200 overflow-hidden">
            <button type="button"
              onClick={() => setOpen(p => ({ ...p, [group.label]: !p[group.label] }))}
              className="w-full flex items-center gap-2.5 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left touch-manipulation">
              <span className="text-sm">{group.icon}</span>
              <span className="flex-1 text-sm font-extrabold text-slate-700">{group.label}</span>
              {cnt > 0 && (
                <span className="text-[10px] font-black bg-primary text-white rounded-full px-2 py-0.5 shrink-0">
                  {cnt} ✓
                </span>
              )}
              <ChevronRight className={cn(
                "w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0",
                isOpen && "rotate-90"
              )} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div key="body"
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden">
                  <div className="flex flex-col gap-1 p-2 overflow-y-auto scrollbar-thin" style={{ maxHeight: "38dvh" }}>
                    {group.options.map(opt => {
                      const checked = selected.includes(opt);
                      return (
                        <motion.button key={opt} type="button" whileTap={{ scale: 0.985 }}
                          onClick={() => onToggle(opt)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-sm font-semibold text-left transition-all",
                            checked ? "bg-primary border-primary text-white"
                                    : "bg-white border-slate-100 text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                          )}>
                          <span className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                            checked ? "bg-white/25 border-white/60" : "border-slate-300"
                          )}>
                            {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════ HEADER ═════════════════════════════════ */
function TopHeader({ qn, total }: { qn: number; total: number }) {
  const pct = Math.round(((qn - 1) / total) * 100);
  const section = getSection(qn);

  return (
    <header className="relative z-30 shrink-0">
      <div className="bg-white/12 backdrop-blur-xl border-b border-white/15">
        <div className="max-w-2xl mx-auto px-4 sm:px-5 py-2.5 flex items-center gap-3">

          {/* Logo */}
          <img src="/logo.webp" alt="Delta"
            className="h-7 sm:h-8 w-auto object-contain shrink-0 drop-shadow" />

          {/* Desktop section pills */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {SECTIONS.map((s, i) => {
              const done = qn > s.to;
              const active = qn >= s.from && qn <= s.to;
              return (
                <div key={s.label} className="flex items-center gap-1">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-300",
                    done ? "bg-white text-primary"
                      : active ? "bg-white/25 text-white ring-1 ring-white/40"
                        : "bg-white/8 text-white/35",
                  )}>
                    <span>{done ? "✓" : s.icon}</span>
                    <span className="hidden lg:inline">{s.label}</span>
                  </div>
                  {i < SECTIONS.length - 1 && (
                    <div className={cn("w-3 h-px", done ? "bg-white/50" : "bg-white/18")} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: current section + dots */}
          <div className="flex md:hidden flex-1 items-center justify-center gap-2">
            <span className="text-xs font-bold text-white/90 shrink-0">
              {section?.icon} {section?.label}
            </span>
            <div className="flex items-center gap-1">
              {SECTIONS.map(s => {
                const done = qn > s.to;
                const active = qn >= s.from && qn <= s.to;
                return (
                  <div key={s.label} className={cn(
                    "rounded-full transition-all duration-300",
                    done ? "w-2 h-2 bg-white"
                      : active ? "w-2.5 h-2.5 bg-white ring-2 ring-white/30"
                        : "w-1.5 h-1.5 bg-white/25",
                  )} />
                );
              })}
            </div>
          </div>

          {/* Counter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-white/55 hidden sm:inline">
              {qn}<span className="text-white/30">/{total}</span>
            </span>
            <div className="w-7 h-7 rounded-full bg-white text-primary text-[11px] font-black
                            flex items-center justify-center shadow-sm">
              {qn}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-white/15">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>
    </header>
  );
}

/* ══════════════════ MAIN COMPONENT ═════════════════════════ */
export function FormQuestionWithValidation({
  question, questionNumber, totalQuestions, value, onChange,
  onNext, onPrevious, canGoNext, isFirst, isLast, allAnswers, direction, isSubmitting,
}: Props) {
  const [isFocused,         setIsFocused]         = useState(false);
  const [selectedFiles,     setSelectedFiles]     = useState<File[]>([]);
  const [showError,         setShowError]         = useState(false);
  const [hasScrolledTerms,  setHasScrolledTerms]  = useState(false);
  const [showScrollWarning, setShowScrollWarning] = useState(false);
  const termsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowError(false);
    setIsFocused(false);
    setHasScrolledTerms(false);
    setShowScrollWarning(false);
  }, [question.id]);

  /* Auto-mark read if T&C content fits without scrolling */
  useEffect(() => {
    if (question.type !== "checkbox") return;
    const t = setTimeout(() => {
      const el = termsScrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 5) setHasScrolledTerms(true);
    }, 200);
    return () => clearTimeout(t);
  }, [question.id, question.type]);

  useEffect(() => {
    if (question.type !== "file") return;
    if (Array.isArray(value)) setSelectedFiles(value as File[]);
    else if ((value as any) instanceof File) setSelectedFiles([value as any]);
    else setSelectedFiles([]);
  }, [question.id]);

  /* ── validation ── */
  const validate = (): string | null => {
    if (!question.required) return null;
    if (question.type === "file") {
      const ok = Array.isArray(value) ? value.length > 0 : value instanceof File;
      return ok ? null : "Please upload the required file.";
    }
    if (!value || (typeof value === "string" && !value.trim())) return "This field is required.";
    if (question.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email.";
    if (question.type === "tel" && !/^[\+]?[\d\s\-\(\)]{7,20}$/.test(value)) return "Please enter a valid phone number.";
    return null;
  };
  const inlineError = showError ? validate() : null;

  const handleNext = () => {
    setShowError(true);
    if (!validate()) { setShowError(false); onNext(); }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleNext(); }
  };

  /* ── files ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxF = question.maxFiles || 5;
    if (files.length > maxF) { toast.error(`Max ${maxF} file(s).`); return; }
    const next = question.multiple ? [...selectedFiles, ...files].slice(0, maxF) : [files[0]];
    setSelectedFiles(next);
    onChange(question.multiple ? next : next[0]);
    e.target.value = "";
  };
  const removeFile = (i: number) => {
    const next = selectedFiles.filter((_, j) => j !== i);
    setSelectedFiles(next);
    onChange(question.multiple ? next : null);
  };
  /* T&C scroll-to-bottom gate */
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 24) {
      setHasScrolledTerms(true);
      setShowScrollWarning(false);
    }
  };

  const fmtSize = (b: number) => {
    if (!b) return "0 B";
    const k = 1024, u = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(1) + " " + u[i];
  };

  /* ────────────────────────────────────────────────────────────────
   *  ANIMATION — identical pattern to assignment-form:
   *  - AnimatePresence lives in Index.tsx, wraps this whole component
   *    with key={currentQuestionIndex}
   *  - This motion.div is the single animated element (NO inner AP)
   *  - direction="left"  → next  → enter from RIGHT (+x), exit to LEFT  (-x)
   *  - direction="right" → prev  → enter from LEFT  (-x), exit to RIGHT (+x)
   * ──────────────────────────────────────────────────────────────── */
  const slideVariants = {
    enter: (d: string) => ({ x: d === "left" ? 320 : -320, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: string) => ({ x: d === "left" ? -320 : 320, opacity: 0 }),
  };

  /* ── input renderer ── */
  const renderInput = () => {
    // hooks inside renderInput are safe because renderInput is always called in the same order
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ref = useRef<any>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const t = setTimeout(() => ref.current?.focus(), 150);
      return () => clearTimeout(t);
    }, [question.id]);

    const inputCls = cn("form-input-base", inlineError ? "error" : "");

    switch (question.type) {
      case "text": case "email": case "tel":
        return <>
          <input ref={ref} type={question.type} value={value ?? ""}
            onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
            placeholder={question.placeholder || "Type your answer…"}
            className={inputCls} />
          <ErrMsg msg={inlineError} />
        </>;

      case "textarea":
        return <>
          <textarea ref={ref} value={value ?? ""} rows={4}
            onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
            placeholder={question.placeholder || "Type your answer…"}
            className={cn(inputCls, "!h-auto py-3 resize-none")} />
          <ErrMsg msg={inlineError} />
        </>;

      case "date":
        return <>
          <input ref={ref} type="date" value={value ?? ""}
            onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
            className={inputCls} />
          <ErrMsg msg={inlineError} />
        </>;

      case "select":
        return <>
          <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin pr-0.5"
            style={{ maxHeight: "50dvh" }}>
            {question.options?.map((opt, i) => {
              const sel = value === opt;
              return (
                <motion.button key={opt} type="button" whileTap={{ scale: 0.985 }}
                  onClick={() => onChange(opt)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-sm font-semibold text-left transition-all duration-150 cursor-pointer",
                    sel ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                      : "bg-white border-slate-200 text-slate-700 hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
                  )}>
                  <span className={cn(
                    "w-6 h-6 rounded-md text-[10px] font-black flex items-center justify-center shrink-0",
                    sel ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
                  )}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {sel && <Check className="w-4 h-4 shrink-0" strokeWidth={3} />}
                </motion.button>
              );
            })}
          </div>
          <ErrMsg msg={inlineError} />
        </>;

      case "file": {
        const maxF = question.maxFiles || 5;
        const canAdd = selectedFiles.length < maxF;
        const isPhoto = question.accept === "image/*";
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cameraRef = useRef<HTMLInputElement>(null);
        return <>
          {/* Standard file input (gallery / file system) */}
          <input ref={ref} type="file"
            accept={question.accept || ".pdf,image/*,.doc,.docx"}
            multiple={question.multiple} className="hidden" onChange={handleFileChange} />

          {/* Camera-only input (for photo questions) */}
          {isPhoto && (
            <input ref={cameraRef} type="file" accept="image/*" capture="user"
              className="hidden" onChange={handleFileChange} />
          )}

          {/* ── Photo question: two-button picker (Camera + Files) ── */}
          {isPhoto ? (
            <div className="flex flex-col gap-3">
              {/* Camera + Upload row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Take Photo */}
                <button type="button" disabled={!canAdd}
                  onClick={() => canAdd && cameraRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center gap-2 w-full px-3 py-4 rounded-xl border-2 border-dashed transition-all text-center",
                    canAdd
                      ? "bg-white hover:bg-primary/5 hover:border-primary cursor-pointer"
                      : "opacity-50 cursor-not-allowed",
                    inlineError ? "border-red-400" : "border-slate-200",
                  )}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Take Photo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use Camera</p>
                  </div>
                </button>

                {/* Upload from Files */}
                <button type="button" disabled={!canAdd}
                  onClick={() => canAdd && ref.current?.click()}
                  className={cn(
                    "flex flex-col items-center gap-2 w-full px-3 py-4 rounded-xl border-2 border-dashed transition-all text-center",
                    canAdd
                      ? "bg-white hover:bg-primary/5 hover:border-primary cursor-pointer"
                      : "opacity-50 cursor-not-allowed",
                    inlineError ? "border-red-400" : "border-slate-200",
                  )}>
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10">
                    <FolderOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Upload File</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Gallery / Files</p>
                  </div>
                </button>
              </div>

              {/* Optional badge */}
              {!question.required && selectedFiles.length === 0 && (
                <p className="text-center text-[11px] text-slate-400 font-medium">
                  Optional — you can skip this step
                </p>
              )}
            </div>
          ) : (
            /* ── Regular file upload (passport, documents) ── */
            <button type="button" onClick={() => canAdd && ref.current?.click()} disabled={!canAdd}
              className={cn(
                "w-full rounded-xl border-2 border-dashed p-5 bg-white transition-all text-left",
                canAdd ? "hover:bg-primary/5 hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed",
                inlineError ? "border-red-400" : "border-slate-200",
              )}>
              <div className="flex items-center gap-4">
                <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">
                    {selectedFiles.length
                      ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                      : "Click to upload"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {question.multiple ? `PDF, Image, Doc · Max ${maxF} files` : "PDF, JPG or PNG · Max 5 MB"}
                  </p>
                </div>
              </div>
            </button>
          )}
          <AnimatePresence>
            {selectedFiles.map((file, idx) => {
              const isImg = file.type.startsWith("image/");
              const previewUrl = isImg ? URL.createObjectURL(file) : null;
              return (
                <motion.div key={idx}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  className="flex items-center justify-between p-3 mt-2 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {previewUrl
                      ? <img src={previewUrl} alt="preview"
                          className="h-9 w-9 rounded-lg object-cover shrink-0 border border-primary/20"
                          onLoad={() => URL.revokeObjectURL(previewUrl!)} />
                      : <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary/10 text-base shrink-0">📄</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{fmtSize(file.size)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile(idx)}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 text-slate-400 transition-colors shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <ErrMsg msg={inlineError} />
        </>;
      }

      case "checkbox": {
        // "|" separator — option texts may contain commas (T&C, course names)
        const selected = value ? String(value).split("|").filter(Boolean) : [];
        const isTerms = (question.subtitle?.length ?? 0) > 200;
        const handleToggle = (opt: string) => {
          /* Gate: must scroll to bottom of T&C before agreeing */
          if (isTerms && !hasScrolledTerms) {
            setShowScrollWarning(true);
            // Shake the scroll box to draw attention
            termsScrollRef.current?.scrollBy({ top: 60, behavior: "smooth" });
            return;
          }
          const checked = selected.includes(opt);
          const next = checked ? selected.filter(v => v !== opt) : [...selected, opt];
          onChange(next.join("|"));
        };
        return <>
          {/* ── T&C scroll box with bottom-fade indicator ── */}
          {isTerms && (
            <div className="relative mb-3">
              <div
                ref={termsScrollRef}
                onScroll={handleTermsScroll}
                className={cn(
                  "terms-scroll-box bg-slate-50 rounded-xl p-4 text-xs text-slate-500 leading-relaxed overflow-y-auto scrollbar-thin transition-colors duration-300",
                  hasScrolledTerms ? "border-2 border-emerald-300" : "border-2 border-slate-200"
                )}
                style={{
                  maxHeight: "clamp(180px, calc(100dvh - 390px), 45dvh)",
                }}
              >
                <p className="font-extrabold text-primary text-[10px] uppercase tracking-widest mb-2">
                  Terms &amp; Conditions — Delta Institutions
                </p>
                <div className="whitespace-pre-line">
                  {question.subtitle ? renderWithLinks(question.subtitle) : null}
                </div>
                {/* Bottom spacer so last line isn't hidden under gradient */}
                <div className="h-6" />
              </div>

              {/* Scroll-down indicator — fades out once fully scrolled */}
              <AnimatePresence>
                {!hasScrolledTerms && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute bottom-0 left-0 right-0 h-14 rounded-b-xl pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, transparent, #f8fafc)" }}
                  >
                    <div className="absolute bottom-1.5 inset-x-0 flex flex-col items-center gap-0">
                      <motion.div
                        animate={{ y: [0, 4, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        className="flex items-center gap-1 text-[10px] font-extrabold text-primary/70 uppercase tracking-widest"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                        Scroll to read all
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* "Read" badge once scrolled */}
              <AnimatePresence>
                {hasScrolledTerms && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm"
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} /> Read
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Scroll warning ── */}
          <AnimatePresence>
            {showScrollWarning && (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden mb-3"
              >
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-800 text-xs font-semibold">
                  <ScrollText className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Please <strong>scroll through all the Terms &amp; Conditions</strong> before you can agree. Scroll down in the policy box above.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Checkbox options ── */}
          {question.groups ? (
            <GroupedCheckbox groups={question.groups} selected={selected} onToggle={handleToggle} />
          ) : (
            <div className="flex flex-col gap-2">
              {question.options?.map(opt => {
                const checked = selected.includes(opt);
                const locked = isTerms && !hasScrolledTerms;
                return (
                  <motion.button key={opt} type="button"
                    whileTap={locked ? {} : { scale: 0.97 }}
                    onClick={() => handleToggle(opt)}
                    className={cn(
                      "flex items-start gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold text-left transition-all duration-150 w-full",
                      checked
                        ? "bg-primary border-primary text-white shadow-md"
                        : locked
                          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                    )}>
                    <span className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                      checked ? "bg-white/25 border-white/60" : "border-slate-300",
                    )}>
                      {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {locked && <ScrollText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" />}
                  </motion.button>
                );
              })}
            </div>
          )}
          <ErrMsg msg={inlineError} />
        </>;
      }

      default: return null;
    }
  };

  /* ══════════════════════ RENDER ═════════════════════════════════
   *  Layout:
   *   - .form-grid-bg  (full dvh, flex col, grid CSS on ::before)
   *     ├── <TopHeader>   (sticky glass bar, does NOT slide)
   *     └── scrollable area (flex-1 overflow-y-auto)
   *           └── centering wrapper (min-h-full flex items-center)
   *                 └── motion.div  ← THE SINGLE animated element
   *                       └── .question-card
   * ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="form-grid-bg">

      {/* Static glass header */}
      <TopHeader qn={questionNumber} total={totalQuestions} />

      {/* Scrollable + centred */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="min-h-full flex items-center justify-center px-4 sm:px-6 py-6">

          {/* ── THE animated card — same pattern as assignment-form ── */}
          <motion.div
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="question-card w-full max-w-xl p-5 sm:p-7"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary
                            text-[10px] font-extrabold px-3 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px]
                               flex items-center justify-center font-black shrink-0">
                {questionNumber}
              </span>
              Question {questionNumber} of {totalQuestions}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900
                           leading-tight mb-1 tracking-tight">
              {question.title.replace(/^\d+\.\s*/, "")}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </h1>

            {/* Short subtitle */}
            {question.subtitle && question.subtitle.length <= 200 && (
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{question.subtitle}</p>
            )}
            <div className={question.subtitle && question.subtitle.length <= 200 ? "" : "mb-4"} />

            {/* Input */}
            <div className="mb-4">{renderInput()}</div>

            {/* Enter hint */}
            <AnimatePresence>
              {isFocused && !["select", "file", "checkbox"].includes(question.type) && !inlineError && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  className="mb-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400
                                   bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 select-none">
                    press
                    <kbd className="px-2 py-0.5 bg-white border border-slate-200 rounded
                                    text-[10px] font-mono shadow-sm">Enter ↵</kbd>
                    to continue
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button onClick={onPrevious} disabled={isFirst}
                className="flex items-center gap-1 text-sm font-semibold text-slate-400
                           hover:text-slate-700 disabled:opacity-0 transition-colors py-2 px-1">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              <motion.button onClick={handleNext} disabled={!canGoNext || !!isSubmitting}
                whileTap={canGoNext && !isSubmitting ? { scale: 0.96 } : {}}
                className={cn(
                  "form-button flex items-center gap-2 px-6 sm:px-8 py-2.5 text-sm uppercase tracking-wide rounded-full shadow-md",
                  (!canGoNext || isSubmitting) && "opacity-40 cursor-not-allowed",
                )}>
                {isLast && isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
                  : <>{isLast ? "Submit Enrollment" : "Next"}<ChevronRight className="w-4 h-4" /></>
                }
              </motion.button>
            </div>

          </motion.div>
          {/* ── end animated card ── */}

        </div>
      </div>
    </div>
  );
}

/* ── Error message ── */
function ErrMsg({ msg }: { msg?: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.16 }}
          className="flex items-center gap-1.5 mt-2 text-red-500 text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{msg}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
