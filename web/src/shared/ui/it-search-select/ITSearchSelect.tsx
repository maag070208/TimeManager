import type { ChangeEvent } from "react";
import { ITSearchSelect as BaseSearchSelect } from "@axzydev/axzy_ui_system";

export interface SearchSelectOption {
  value: string | number;
  label: string;
  [key: string]: unknown;
}

interface Props {
  name?: string;
  label?: string;
  placeholder?: string;
  options?: SearchSelectOption[];
  value?: string | number;
  /** Mantiene la API de `ITSelect` (evento) para no tocar los formularios. */
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string | boolean;
  touched?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  readOnly?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

const eventOf = (name: string | undefined, value: string | number): ChangeEvent<HTMLSelectElement> =>
  ({ target: { name, value: String(value) } }) as ChangeEvent<HTMLSelectElement>;

/**
 * `ITSelect` migrado a `ITSearchSelect`: mismo contrato de evento que usaban las
 * pantallas, pero con búsqueda y filtrado del kit. Así todos los selects del
 * producto son buscables sin reescribir cada formulario.
 */
export default function ITSearchSelect({
  name,
  label,
  placeholder,
  options = [],
  value,
  onChange,
  onBlur,
  disabled,
  required,
  error,
  touched,
  size = "md",
  className,
  readOnly,
  clearable = true,
  onClear,
}: Props) {
  return (
    <div className="relative">
      <BaseSearchSelect
      name={name}
      label={label}
      placeholder={placeholder}
      options={options}
      value={value}
      disabled={disabled}
      required={required}
      error={error}
      touched={touched}
      size={size}
      className={className}
      readOnly={readOnly}
      clearable={clearable}
      onClear={onClear}
      onChange={(next) => onChange?.(eventOf(name, next))}
      onBlur={onBlur}
      />
      {/* Puente de compatibilidad: los E2E y formularios legacy consultan el
          select nativo por `name`. La UI visible es el buscador. */}
      {name && (
        <select
          aria-hidden
          tabIndex={-1}
          name={name}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event) => onChange?.(event)}
          className="sr-only"
        >
          {options.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
