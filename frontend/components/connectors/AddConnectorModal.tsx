"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useCreateConnector, useStartOAuth } from "@/hooks/useConnectors";
import { PLATFORM_META, CONNECTABLE_PLATFORMS } from "@/lib/platformMeta";
import { cn } from "@/lib/utils";
import type { ConnectorPlatform, SyncFrequency } from "@/types/connector";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  platform: z.enum(
    CONNECTABLE_PLATFORMS as [ConnectorPlatform, ...ConnectorPlatform[]]
  ),
  sync_frequency: z.enum(["hourly", "daily", "manual"] as const),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddConnectorModal({ open, onOpenChange }: Props) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<ConnectorPlatform | null>(null);

  const createMut = useCreateConnector();
  const oauthMut = useStartOAuth();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sync_frequency: "daily" },
  });

  function handleClose(v: boolean) {
    if (!v) {
      reset();
      setSelectedPlatform(null);
    }
    onOpenChange(v);
  }

  async function onSubmit(data: FormData) {
    const connector = await createMut.mutateAsync(data);
    handleClose(false);
    oauthMut.mutate({ platform: connector.platform, connectorId: connector.id });
  }

  const isPending = createMut.isPending || oauthMut.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add connector</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {/* Platform picker */}
          <Field>
            <FieldLabel>Platform</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {CONNECTABLE_PLATFORMS.map((p) => {
                const meta = PLATFORM_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setSelectedPlatform(p);
                      setValue("platform", p, { shouldValidate: true });
                      if (!getValues("name")) {
                        setValue("name", `My ${meta.label}`, { shouldValidate: true });
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center text-xs transition-colors",
                      selectedPlatform === p
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md text-xs font-bold text-white",
                        meta.bgClass
                      )}
                    >
                      {meta.initials}
                    </span>
                    <span className="font-medium leading-tight">
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <FieldError errors={[errors.platform]} />
          </Field>

          <FieldGroup>
            {/* Name */}
            <Field>
              <FieldLabel htmlFor="conn-name">Connector name</FieldLabel>
              <Input
                id="conn-name"
                placeholder={
                  selectedPlatform
                    ? `My ${PLATFORM_META[selectedPlatform].label}`
                    : "e.g. My Google Ads"
                }
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            {/* Sync frequency */}
            <Field>
              <FieldLabel>Sync frequency</FieldLabel>
              <Select
                defaultValue="daily"
                onValueChange={(v) =>
                  setValue("sync_frequency", v as SyncFrequency, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Connecting…" : "Add & Connect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
