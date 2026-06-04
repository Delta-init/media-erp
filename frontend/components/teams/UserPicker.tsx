"use client";

import { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";
import type { AssignableUser } from "@/hooks/useTeams";

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#22c55e","#14b8a6","#3b82f6"];

function Avatar({ name }: { name: string }) {
  const color = AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div
      className="size-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
      style={{ background: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface Props {
  users: AssignableUser[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Hide these users from the list (e.g. already chosen as leaders). */
  excludeIds?: string[];
  placeholder?: string;
  /** Max height of the scrollable list (Tailwind class). */
  maxHeightClass?: string;
  loading?: boolean;
}

export function UserPicker({
  users,
  selectedIds,
  onToggle,
  excludeIds = [],
  placeholder = "Search users...",
  maxHeightClass = "max-h-44",
  loading = false,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const ex = new Set(excludeIds);
    const q = search.trim().toLowerCase();
    return users
      .filter((u) => !ex.has(u.id))
      .filter((u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
  }, [users, excludeIds, search]);

  const selected = new Set(selectedIds);

  return (
    <div className="rounded-xl border bg-background/40 overflow-hidden">
      {/* Search */}
      <div className="relative border-b">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* List */}
      <div className={`${maxHeightClass} overflow-y-auto p-1.5 space-y-0.5`}>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {search ? "No users match" : "No users available"}
          </div>
        ) : (
          filtered.map((u) => {
            const isSel = selected.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onToggle(u.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  isSel ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <Avatar name={u.name || u.email || "?"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span
                  className={`flex size-5 items-center justify-center rounded-md border shrink-0 transition-colors ${
                    isSel ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
                  }`}
                >
                  {isSel && <Check className="size-3.5" />}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Selected count footer */}
      {selectedIds.length > 0 && (
        <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          {selectedIds.length} selected
        </div>
      )}
    </div>
  );
}
