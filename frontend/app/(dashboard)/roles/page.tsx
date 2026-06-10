"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, Pencil, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleDialog } from "@/components/roles/RoleDialog";
import { PermissionMatrix } from "@/components/roles/PermissionMatrix";
import { useRoles } from "@/hooks/useRoles";
import type { Role } from "@/types/role";
import { cn } from "@/lib/utils";

export default function RolesPage() {
  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [dialogOpen, setDialog]     = useState(false);
  const [editRole, setEditRole]     = useState<Role | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useRoles({ search, page, limit: 15 });
  const roles = data?.roles ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  function openEdit(role: Role) { setEditRole(role); setDialog(true); }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" /> Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} system role{total !== 1 ? "s" : ""} · Click a role to view its permissions · Edit to customise access
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search roles…"
          className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="size-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent"
          />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShieldCheck className="size-10 mb-3 opacity-30" />
          <p className="text-sm">No roles found</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {roles.flatMap((role, i) => {
                  const rows = [
                    <motion.tr
                      key={role.id}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="border-b hover:bg-muted/20 transition-colors cursor-pointer group"
                      onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}
                    >
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className={cn("size-4", role.is_system_role ? "text-primary" : "text-muted-foreground")} />
                          {role.role_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                        {role.description || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {role.is_system_role ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">System</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Custom</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {role.created_at ? new Date(role.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {role.role_name === "Super Admin" ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground px-1.5">
                              <Lock className="size-3" /> Locked
                            </span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(role); }}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit permissions"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>,
                  ];

                  if (expandedId === role.id) {
                    rows.push(
                      <motion.tr
                        key={`${role.id}-expand`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <td colSpan={5} className="px-4 pb-4 pt-0 bg-muted/10">
                          <div className="mt-2">
                            <PermissionMatrix permissions={role.permissions as any} readOnly />
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }

                  return rows;
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}

      {/* Dialogs */}
      <RoleDialog open={dialogOpen} onClose={() => setDialog(false)} role={editRole} />
    </div>
  );
}
