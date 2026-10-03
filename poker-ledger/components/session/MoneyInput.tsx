/** Campo de valor em euros (texto com teclado decimal; convertido para cêntimos sem floats). */
export function MoneyInput({
  label,
  name,
  defaultValue,
  className = "",
  hideLabel = false,
  ...rest
}: {
  label: string;
  name: string;
  defaultValue?: string;
  className?: string;
  hideLabel?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className={hideLabel ? "sr-only" : "mb-1.5 block text-sm text-ivory/80"}>{label}</span>
      <span className="relative block">
        <input
          name={name}
          defaultValue={defaultValue}
          inputMode="decimal"
          autoComplete="off"
          pattern="[0-9]+([,.][0-9]{1,2})?"
          className="money h-11 w-full rounded-xl border border-white/20 bg-ink/40 pr-8 pl-3"
          {...rest}
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ivory/70">
          €
        </span>
      </span>
    </label>
  );
}
