import { Card } from "./Card";
import { Button } from "./Button";
import { Field, Input, Select } from "./Input";

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold text-brand-dark">
      Planned
    </span>
  );
}

export function ProvisionPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="mb-6 border-dashed p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <ComingSoonBadge />
      </div>
      <div className="pointer-events-none select-none opacity-60">{children}</div>
    </Card>
  );
}

export function DisabledField({
  label,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Input disabled placeholder={placeholder} type={type} />
    </Field>
  );
}

export function DisabledSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <Field label={label}>
      <Select disabled defaultValue={options[0]}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </Select>
    </Field>
  );
}

export function DisabledAction({ label }: { label: string }) {
  return (
    <Button type="button" disabled>
      {label}
    </Button>
  );
}
