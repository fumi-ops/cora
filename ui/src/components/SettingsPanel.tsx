import { useEffect, useMemo, useState } from "react";
import { Cancel01Icon, Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { SettingsField } from "../types";
import { cx, formatTagLabel } from "../lib/utils";
import { Badge, Button, Card, Input } from "./basecoat";

interface SettingsPanelProps {
  open: boolean;
  fields: SettingsField[];
  version: string;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onClose: () => void;
  onSaveCredential: (key: string, value: string) => Promise<void>;
}

export function SettingsPanel({
  open,
  fields,
  version,
  theme,
  onThemeChange,
  onClose,
  onSaveCredential,
}: SettingsPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const groupedFields = useMemo(() => {
    const grouped = new Map<string, SettingsField[]>();

    for (const field of fields) {
      const existing = grouped.get(field.sourceId) ?? [];
      existing.push(field);
      grouped.set(field.sourceId, existing);
    }

    return Array.from(grouped.entries());
  }, [fields]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <Card className="relative flex max-h-[85vh] w-full max-w-3xl flex-col p-0 shadow-2xl">
        <div className="flex items-start justify-between border-b border-(--cora-border) p-6 sm:p-8">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-(--cora-text-muted)">Preferences</p>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-(--cora-text)">Settings</h2>
          </div>
          <Button variant="secondary" onClick={onClose} className="size-10 !p-0">
            <HugeiconsIcon icon={Cancel01Icon} size={20} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-(--cora-text-muted)">Appearance</h3>
                <Badge variant="neutral">
                  {formatTagLabel(theme)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={cx(
                    "flex items-center gap-3 border p-4 text-sm font-medium transition-all",
                    theme === "light"
                      ? "border-(--cora-accent) bg-(--cora-accent)/5 text-(--cora-text)"
                      : "border-(--cora-border) text-(--cora-text-muted) hover:border-(--cora-text-muted) hover:text-(--cora-text)",
                  )}
                  aria-pressed={theme === "light"}
                  onClick={() => onThemeChange("light")}
                >
                  <HugeiconsIcon icon={Sun01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
                  Light
                </button>
                <button
                  type="button"
                  className={cx(
                    "flex items-center gap-3 border p-4 text-sm font-medium transition-all",
                    theme === "dark"
                      ? "border-(--cora-accent) bg-(--cora-accent)/5 text-(--cora-text)"
                      : "border-(--cora-border) text-(--cora-text-muted) hover:border-(--cora-text-muted) hover:text-(--cora-text)",
                  )}
                  aria-pressed={theme === "dark"}
                  onClick={() => onThemeChange("dark")}
                >
                  <HugeiconsIcon icon={Moon01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
                  Dark
                </button>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-(--cora-text-muted)">
                Credentials
              </h3>

              {groupedFields.length === 0 ? (
                <p className="text-sm text-(--cora-text-muted)">No credential placeholders found in config.</p>
              ) : null}

              {groupedFields.map(([sourceId, sourceFields]) => (
                <div key={sourceId} className="space-y-4 border border-(--cora-border) bg-(--cora-bg)/50 p-6">
                  <div className="flex items-center justify-between gap-2 border-b border-(--cora-border) pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--cora-text-muted)">Source</p>
                    <Badge variant="neutral">
                      {formatTagLabel(sourceId)}
                    </Badge>
                  </div>

                  <div className="space-y-8 pt-2">
                    {sourceFields.map((field) => (
                      <div key={field.key} className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-(--cora-text)">{field.key}</p>
                          <Badge variant={field.exists ? "success" : "warning"}>
                            {field.exists ? "Stored" : "Missing"}
                          </Badge>
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            type="password"
                            value={values[field.key] ?? ""}
                            placeholder={field.exists ? "Enter new value" : "Enter credential"}
                            onChange={(event) => {
                              const value = event.target.value;
                              setValues((prev) => ({
                                ...prev,
                                [field.key]: value,
                              }));
                            }}
                          />
                          <Button
                            className="shrink-0 sm:min-w-24"
                            disabled={savingKey === field.key || !(values[field.key] ?? "")}
                            isLoading={savingKey === field.key}
                            loadingText="Saving"
                            onClick={async () => {
                              const value = values[field.key] ?? "";
                              if (!value) {
                                return;
                              }

                              setSavingKey(field.key);
                              try {
                                await onSaveCredential(field.key, value);
                                setValues((prev) => ({ ...prev, [field.key]: "" }));
                              } finally {
                                setSavingKey(null);
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-(--cora-border) bg-(--cora-panel) p-4 px-6 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--cora-text-muted)">Cora {version}</p>
          <p className="text-[10px] font-medium text-(--cora-text-muted)">System Ready</p>
        </div>
      </Card>
    </div>
  );
}
