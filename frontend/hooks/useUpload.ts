"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/axios";
import type { Attachment } from "@/types/project";

/**
 * Upload one or more files (any type) to the backend, which stores them in
 * Cloudflare R2 (or local disk fallback) and returns public URLs.
 */
export function useUploadAttachments() {
  return useMutation({
    mutationFn: async (files: File[]): Promise<Attachment[]> => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const { data } = await api.post<{ success: boolean; data: Attachment[] }>(
        "/media/upload-attachments",
        form,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 }
      );
      return data.data;
    },
    onError(err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.message ||
        "Failed to upload files";
      toast.error(msg);
    },
  });
}
