import { Button } from "./Button";

export function RowActions({ onEdit }: { onEdit: () => void }) {
  return (
    <Button variant="ghost" className="px-2 py-1 text-xs" type="button" onClick={onEdit}>
      Edit
    </Button>
  );
}

export function FormModeLabel({ editing }: { editing: boolean }) {
  return (
    <span className="text-xs font-medium text-text-muted">
      {editing ? "Editing existing record" : "Creating new record"}
    </span>
  );
}
