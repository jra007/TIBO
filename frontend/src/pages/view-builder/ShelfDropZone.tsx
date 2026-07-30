import { useDroppable } from '@dnd-kit/core';
import type { Field, ShelfId } from './shelves';

export function ShelfDropZone({
  id,
  label,
  fields,
  onRemove,
}: {
  id: ShelfId;
  label: string;
  fields: Field[];
  onRemove: (fieldId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="shelf-drop-zone" data-over={isOver} role="group" aria-label={`Zone ${label}`}>
      <h3>{label}</h3>
      <ul>
        {fields.map((field) => (
          <li key={field.id}>
            {field.tableName}.{field.columnName}
            <button type="button" aria-label={`Retirer ${field.tableName}.${field.columnName} de ${label}`} onClick={() => onRemove(field.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
