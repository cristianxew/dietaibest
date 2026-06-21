"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { SELECTABLE_UNITS } from "@/lib/unit-registry";

interface UnitComboboxProps {
  value: string | undefined;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
}

/**
 * Unit field for recipe ingredients: a combobox seeded with the canonical units
 * from the unit registry (the dropdown) while still allowing free text. This
 * steers users toward units the nutrition pipeline understands — cutting typos
 * like "cda" or "tbs." — without locking out anything unusual (free text is
 * still normalized by the registry server-side).
 *
 * Implemented with a native `<input list>` + `<datalist>` so it integrates with
 * react-hook-form like a plain input and needs no popover/portal machinery.
 */
export function UnitCombobox({
  value,
  onChange,
  className,
  placeholder = "unit",
  id,
}: UnitComboboxProps) {
  const listId = useId();
  return (
    <>
      <Input
        id={id}
        list={listId}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {SELECTABLE_UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </>
  );
}
