import { useDraggable } from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { displayLabel, SHELVES, type Field, type ShelfId } from './shelves';

export function FieldChip({
  field,
  onAddToShelf,
  onRename,
}: {
  field: Field;
  onAddToShelf: (shelfId: ShelfId) => void;
  onRename: (field: Field, newLabel: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: field.id, data: { field } });
  const [renaming, setRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(displayLabel(field));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  function startRenaming() {
    setDraftLabel(displayLabel(field));
    setRenaming(true);
  }

  function confirmRename() {
    setRenaming(false);
    const trimmed = draftLabel.trim();
    if (trimmed && trimmed !== displayLabel(field)) onRename(field, trimmed);
  }

  return (
    <div
      ref={setNodeRef}
      {...(renaming ? {} : listeners)}
      {...attributes}
      className="field-chip"
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
    >
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmRename();
          }}
        >
          <label htmlFor={`rename-${field.id}`} className="visually-hidden">
            Renommer {field.tableName}.{field.columnName}
          </label>
          <input id={`rename-${field.id}`} ref={inputRef} value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} onBlur={confirmRename} />
        </form>
      ) : (
        <span>
          {displayLabel(field)}{' '}
          <button
            type="button"
            aria-label={`Renommer ${field.tableName}.${field.columnName}`}
            onClick={(e) => {
              e.stopPropagation();
              startRenaming();
            }}
          >
            ✎
          </button>
        </span>
      )}
      <small>
        {field.tableName}.{field.columnName}
      </small>
      {/* Keyboard/screen-reader alternative to drag-and-drop, per WCAG 2.1 AA requirement */}
      <label>
        Ajouter à
        <select
          aria-label={`Ajouter ${displayLabel(field)} à une zone`}
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
