"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeleteRole } from "@/hooks/useRoles";
import type { Role } from "@/types/role";

interface Props {
  open: boolean;
  onClose: () => void;
  role: Role | null;
}

export function DeleteRoleDialog({ open, onClose, role }: Props) {
  const deleteRole = useDeleteRole();

  async function confirm() {
    if (!role) return;
    try {
      await deleteRole.mutateAsync(role.id);
      onClose();
    } catch {
      // toast handled in hook
    }
  }

  return (
    <AnimatePresence>
      {open && role && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-x-4 top-1/3 z-50 mx-auto max-w-md rounded-2xl bg-background p-6 shadow-2xl border"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete Role</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Are you sure you want to delete <strong>{role.role_name}</strong>?
                  This action cannot be undone. Users assigned this role must be reassigned first.
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirm}
                disabled={deleteRole.isPending}
              >
                {deleteRole.isPending ? "Deleting…" : "Delete Role"}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
