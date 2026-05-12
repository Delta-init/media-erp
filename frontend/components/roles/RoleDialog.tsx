"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionMatrix } from "./PermissionMatrix";
import { useCreateRole, useUpdateRole } from "@/hooks/useRoles";
import { emptyPermissions, type ModulePermissions } from "@/types/role";
import type { Role } from "@/types/role";

interface Props {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
}

export function RoleDialog({ open, onClose, role }: Props) {
  const isEdit = !!role;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [name, setName]             = useState("");
  const [description, setDesc]      = useState("");
  const [permissions, setPerms]     = useState<Record<string, ModulePermissions>>(emptyPermissions());

  useEffect(() => {
    if (role) {
      setName(role.role_name);
      setDesc(role.description);
      setPerms(role.permissions as Record<string, ModulePermissions>);
    } else {
      setName("");
      setDesc("");
      setPerms(emptyPermissions());
    }
  }, [role, open]);

  function close() { onClose(); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      role_name: name.trim(),
      description,
      permissions,
    };

    try {
      if (isEdit) {
        await updateRole.mutateAsync({ id: role!.id, payload });
      } else {
        await createRole.mutateAsync(payload);
      }
      close();
    } catch {
      // toast handled in hook
    }
  }

  const isPending = createRole.isPending || updateRole.isPending;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-4 top-[5%] z-50 mx-auto max-w-3xl overflow-auto max-h-[90vh] rounded-2xl bg-background shadow-2xl border"
          >
            <form onSubmit={submit}>
              {/* Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <h2 className="text-base font-semibold">
                    {isEdit ? "Edit Role" : "Create Role"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Role Name <span className="text-destructive">*</span></label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Marketing Manager"
                    disabled={isEdit && role?.is_system_role}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                    required
                  />
                  {isEdit && role?.is_system_role && (
                    <p className="text-xs text-muted-foreground">System roles cannot be renamed.</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Brief description of this role..."
                    rows={2}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {/* Permission Matrix */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Permissions</label>
                  <PermissionMatrix
                    permissions={permissions}
                    onChange={setPerms}
                    readOnly={!!(isEdit && role?.is_system_role)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t px-6 py-4">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !name.trim()}>
                  {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Role"}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
