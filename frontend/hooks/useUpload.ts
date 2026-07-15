"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadFilesDirect } from "@/lib/directUpload";
import type { Attachment } from "@/types/project";

/**
 * Upload one or more files (any type) **directly to Cloudflare R2** via a
 * pre-signed URL. The bytes never pass through our backend, so files up to
 * 1 GB are supported. Returns Attachment metadata (incl. the public view URL).
 */
export function useUploadAttachments() {
  return useMutation({
    mutationFn: (files: File[]): Promise<Attachment[]> => uploadFilesDirect(files),
    onError(err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.detail ||
        (err as { response?: { data?: { detail?: string; message?: string } } })
          ?.response?.data?.message ||
        "Failed to upload files";
      toast.error(msg);
    },
  });
}
