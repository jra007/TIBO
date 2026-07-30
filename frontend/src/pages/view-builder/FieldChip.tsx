import { useDraggable } from '@dnd-kit/core';
import { SHELVES, type Field, type ShelfId } from './shelves';

export function FieldChip({ field, onAddToShelf }: { field: Field; onAddToShelf: (shelfId: ShelfId) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: field.id, data: { field } });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="field-chip"
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
    >
      <span>{field.tableName}.{field.columnName}</span>
      {/* Keyboard/screen-reader alternative to drag-and-drop, per WCAG 2.1 AA requirement */}
      <label>
        Ajouter à
        <select
          aria-label={`Ajouter ${field.tableName}.${field.columnName} à une zone`}
          value=""
          onChange={(e) => e.target.value && onAddToShelf(e.target.value as ShelfId)}
        >
          <option value="" disabled>
            Choisir une zone
          </option>
          {SHELVES.map((shelf) => (
            <option key={shelf.id} value={shelf.id}>
              {shelf.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
