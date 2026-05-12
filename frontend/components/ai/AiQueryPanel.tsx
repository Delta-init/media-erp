"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Lightbulb, RefreshCw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listItemVariants, listVariants } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { AiHistoryItem } from "@/types/ai";

// ── Suggested questions ───────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Which platform had the highest ROAS?",
  "Show total spend grouped by platform",
  "Top 5 campaigns by spend",
  "What is the total clicks by country?",
  "Show daily spend for the last 30 days",
  "Which campaigns have the best conversion rate?",
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface AiQueryPanelProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
  retryAfter: number;
  history: AiHistoryItem[];
  historyLoading: boolean;
  selectedId?: string;
  onHistorySelect: (item: AiHistoryItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AiQueryPanel({
  onSubmit,
  isLoading,
  retryAfter,
  history,
  historyLoading,
  selectedId,
  onHistorySelect,
}: AiQueryPanelProps) {
  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const q = question.trim();
    if (!q || isLoading || retryAfter > 0) return;
    onSubmit(q);
    setQuestion("");
  }

  function handleSuggestion(s: string) {
    setQuestion(s);
    textareaRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const fmt = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Input card */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          Ask a question
        </div>

        <textarea
          ref={textareaRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. Which platform had the highest ROAS last month?"
          rows={4}
          className={cn(
            "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm",
            "text-foreground placeholder:text-muted-foreground outline-none",
            "focus:border-ring focus:ring-2 focus:ring-ring/30 transition",
          )}
        />

        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            Ctrl+Enter to submit
          </p>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!question.trim() || isLoading || retryAfter > 0}
          >
            {isLoading ? (
              <RefreshCw className="mr-1.5 size-3 animate-spin" />
            ) : retryAfter > 0 ? (
              <Clock className="mr-1.5 size-3" />
            ) : (
              <Send className="mr-1.5 size-3" />
            )}
            {isLoading
              ? "Thinking…"
              : retryAfter > 0
              ? `Retry in ${retryAfter}s`
              : "Ask Llama"}
          </Button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Lightbulb className="size-3" />
          Try asking
        </p>
        <div className="flex flex-col gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSuggestion(s)}
              className="rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="size-3" />
          Recent queries
        </p>

        {historyLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!historyLoading && !history.length && (
          <p className="text-xs text-muted-foreground italic">
            No queries yet — ask something above!
          </p>
        )}

        {!historyLoading && history.length > 0 && (
          <motion.div
            variants={listVariants}
            initial="initial"
            animate="animate"
            className="space-y-1.5 overflow-y-auto max-h-64 pr-1"
          >
            <AnimatePresence>
              {history.map((item) => (
                <motion.button
                  key={item.id}
                  variants={listItemVariants}
                  type="button"
                  onClick={() => onHistorySelect(item)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-all",
                    selectedId === item.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-transparent bg-muted/30 hover:bg-muted/60",
                  )}
                >
                  <p className="truncate text-xs font-medium text-foreground">
                    {item.question}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                    {item.explanation}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {item.result_count} rows · {fmt.format(new Date(item.created_at))}
                  </p>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
