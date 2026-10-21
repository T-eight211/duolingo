"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Combobox, ComboboxItem } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface CreatableItem {
  __creatable: true;
  value: string;
}

export function isCreatableItem(item: unknown): item is CreatableItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "__creatable" in item &&
    (item as CreatableItem).__creatable === true
  );
}

export function ComboboxItemCreatable({
  value,
  className,
  ...props
}: {
  value: CreatableItem;
  className?: string;
} & Omit<React.ComponentProps<typeof ComboboxItem>, "value">) {
  return (
    <ComboboxItem
      value={value}
      className={cn(
        "cursor-pointer font-bold text-sky-600 data-highlighted:bg-sky-50 data-highlighted:text-sky-700",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-1.5">
        <Plus className="size-3.5 stroke-[2.5]" aria-hidden="true" />
        <span>Create &ldquo;{value.value}&rdquo;</span>
      </span>
    </ComboboxItem>
  );
}

interface CreatableComboboxProps<T = string> {
  items: T[];
  value?: string | null;
  defaultValue?: string | null;
  disabled?: boolean;
  itemToStringLabel?: (item: unknown) => string;
  onValueChange?: (value: string | null) => void;
  onCreateValue?: (value: string) => void;
  children: React.ReactNode;
}

export function CreatableCombobox<T = string>({
  items,
  value,
  defaultValue,
  disabled = false,
  itemToStringLabel,
  onValueChange,
  onCreateValue,
  children,
}: CreatableComboboxProps<T>) {
  const [inputValue, setInputValue] = React.useState("");

  const trimmed = inputValue.trim();
  const hasExactMatch =
    trimmed.length === 0 ||
    items.some((item) => {
      const str =
        typeof item === "string"
          ? item
          : itemToStringLabel
            ? itemToStringLabel(item)
            : String(item);
      return str.toLowerCase() === trimmed.toLowerCase();
    });

  const combinedItems: (T | CreatableItem)[] = React.useMemo(() => {
    if (!hasExactMatch && trimmed.length > 0) {
      return [...items, { __creatable: true, value: trimmed } as CreatableItem];
    }
    return items;
  }, [items, hasExactMatch, trimmed]);

  const resolvedItemToStringLabel = React.useCallback(
    (item: unknown): string => {
      if (isCreatableItem(item)) {
        return item.value;
      }
      if (itemToStringLabel) {
        return itemToStringLabel(item);
      }
      return typeof item === "string" ? item : String(item ?? "");
    },
    [itemToStringLabel],
  );

  const resolvedItemToStringValue = React.useCallback(
    (item: unknown): string => {
      if (isCreatableItem(item)) {
        return item.value;
      }
      return typeof item === "string" ? item : String(item ?? "");
    },
    [],
  );

  const isItemEqualToValue = React.useCallback(
    (item: unknown, val: unknown): boolean => {
      if (isCreatableItem(item)) {
        return item.value === val;
      }
      return item === val;
    },
    [],
  );

  return (
    <Combobox
      items={combinedItems}
      value={(value as unknown as (T | CreatableItem)) ?? null}
      defaultValue={(defaultValue as unknown as (T | CreatableItem)) ?? null}
      disabled={disabled}
      itemToStringLabel={resolvedItemToStringLabel}
      itemToStringValue={resolvedItemToStringValue}
      isItemEqualToValue={isItemEqualToValue}
      onInputValueChange={(nextInput) => {
        setInputValue(nextInput);
      }}
      filter={(item, query) => {
        if (isCreatableItem(item)) return true;
        const label = resolvedItemToStringLabel(item);
        return label.toLowerCase().includes(query.toLowerCase());
      }}
      onValueChange={(selected) => {
        if (isCreatableItem(selected)) {
          onCreateValue?.(selected.value);
          onValueChange?.(selected.value);
        } else if (typeof selected === "string") {
          onValueChange?.(selected);
        } else if (selected === null || selected === undefined) {
          onValueChange?.(null);
        } else {
          onValueChange?.(resolvedItemToStringLabel(selected));
        }
      }}
    >
      {children}
    </Combobox>
  );
}
