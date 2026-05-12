"use client";

import { cn } from "@/lib/utils";
import { MODULES, ACTIONS, MODULE_LABELS, type ModulePermissions } from "@/types/role";

interface Props {
  permissions: Record<string, ModulePermissions>;
  onChange?: (permissions: Record<string, ModulePermissions>) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({ permissions, onChange, readOnly = false }: Props) {
  function toggle(module: string, action: string, value: boolean) {
    if (readOnly || !onChange) return;
    onChange({
      ...permissions,
      [module]: {
        ...permissions[module],
        [action]: value,
      },
    });
  }

  function toggleRow(module: string, allOn: boolean) {
    if (readOnly || !onChange) return;
    const all = ACTIONS.reduce((acc, a) => ({ ...acc, [a]: !allOn }), {} as ModulePermissions);
    onChange({ ...permissions, [module]: all });
  }

  function toggleCol(action: string, allOn: boolean) {
    if (readOnly || !onChange) return;
    const updated = { ...permissions };
    MODULES.forEach((m) => {
      updated[m] = { ...updated[m], [action]: !allOn };
    });
    onChange(updated);
  }

  function Checkbox({
    checked,
    onChange: onCh,
    title,
  }: {
    checked: boolean;
    onChange?: (v: boolean) => void;
    title?: string;
  }) {
    return (
      <button
        type="button"
        title={title}
        onClick={() => onCh?.(!checked)}
        disabled={readOnly || !onCh}
        className={cn(
          "flex size-5 items-center justify-center rounded border transition-colors",
          checked
            ? "bg-primary border-primary text-primary-foreground"
            : "border-border bg-background hover:border-primary/50",
          readOnly && "cursor-default opacity-60"
        )}
      >
        {checked && (
          <svg className="size-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">
              Module
            </th>
            {ACTIONS.map((action) => {
              const allOn = MODULES.every((m) => permissions[m]?.[action as keyof ModulePermissions]);
              return (
                <th
                  key={action}
                  className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{action}</span>
                    {!readOnly && (
                      <Checkbox
                        checked={allOn}
                        onChange={() => toggleCol(action, allOn)}
                        title={`Toggle all ${action}`}
                      />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((module, i) => {
            const perms = permissions[module] ?? { view: false, create: false, edit: false, delete: false, export: false };
            const rowAllOn = ACTIONS.every((a) => perms[a as keyof ModulePermissions]);
            return (
              <tr
                key={module}
                className={cn("border-b last:border-0 hover:bg-muted/20 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {!readOnly && (
                      <Checkbox
                        checked={rowAllOn}
                        onChange={() => toggleRow(module, rowAllOn)}
                        title={`Toggle all for ${MODULE_LABELS[module as keyof typeof MODULE_LABELS]}`}
                      />
                    )}
                    <span className="font-medium text-foreground">
                      {MODULE_LABELS[module as keyof typeof MODULE_LABELS] ?? module}
                    </span>
                  </div>
                </td>
                {ACTIONS.map((action) => (
                  <td key={action} className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={perms[action as keyof ModulePermissions]}
                        onChange={(v) => toggle(module, action, v)}
                        title={`${action} ${module}`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
