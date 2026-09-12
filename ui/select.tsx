'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHydrated } from './use-hydrated';
export function Choice({
  label,
  value,
  options,
  onChange,
  onOptionIntent,
  disabled = false,
  name,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  onOptionIntent?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}) {
  const ready = useHydrated();
  return (
    <label className="choice">
      <span>{label}</span>
      <Select
        disabled={!ready || disabled}
        name={name}
        value={value}
        onValueChange={(v) => {
          if (v !== null) onChange(v);
        }}
        items={options}
      >
        <SelectTrigger className="choice-trigger" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') onOptionIntent?.(o.value);
              }}
              onFocus={() => onOptionIntent?.(o.value)}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
