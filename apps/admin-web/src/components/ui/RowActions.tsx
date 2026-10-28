import { Button } from "./Button";

export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {onEdit && (
        <Button variant="ghost" className="px-2 py-1 text-xs" type="button" onClick={onEdit}>
          Edit
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs text-red-700"
          type="button"
          onClick={() => {
            if (window.confirm("Delete this record? This cannot be undone.")) onDelete();
          }}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

export function FormModeLabel({ editing }: { editing: boolean }) {
  return (
    <span className="text-xs font-medium text-text-muted">
      {editing ? "Editing existing record" : "Creating new record"}
    </span>
  );
}
