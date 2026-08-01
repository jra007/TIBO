import { useDndContext, useDroppable } from '@dnd-kit/core';
import { displayLabel, type Field } from './shelves';
import { BLOCK_OP_SYMBOLS, BLOCK_ROOT_DROP_ID, blockDropIdFor, type BlockExpr, type BlockOp } from './block-formula';

type OperatorChoice = BlockOp | 'ratio' | 'variation';

const OPERATOR_OPTIONS: { value: OperatorChoice; label: string }[] = [
  { value: '+', label: 'Addition (+)' },
  { value: '-', label: 'Soustraction (−)' },
  { value: '*', label: 'Multiplication (×)' },
  { value: '/', label: 'Division (÷)' },
  { value: 'ratio', label: 'Ratio (division sécurisée)' },
  { value: 'variation', label: 'Variation %' },
];

function applyOperator(choice: OperatorChoice): BlockExpr {
  if (choice === 'ratio') return { kind: 'ratio', numerator: { kind: 'empty' }, denominator: { kind: 'empty' } };
  if (choice === 'variation') return { kind: 'variation', current: { kind: 'empty' }, previous: { kind: 'empty' } };
  return { kind: 'binary', op: choice, left: { kind: 'empty' }, right: { kind: 'empty' } };
}

/** A single slot in the block tree — empty (droppable + pickable), a filled leaf (field/constant), or an operation with two nested slots. Every drop target only accepts numeric fields, rejecting anything else both visually (data-invalid) and functionally (ViewBuilderPage's drop handler ignores non-numeric drops). */
function BlockSlot({
  expr,
  dropId,
  fieldsById,
  onChange,
}: {
  expr: BlockExpr;
  dropId: string;
  fieldsById: Record<string, Field>;
  onChange: (next: BlockExpr) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  const { active } = useDndContext();
  const draggedField = active?.data?.current?.field as Field | undefined;
  const rejecting = isOver && expr.kind === 'empty' && Boolean(draggedField) && draggedField?.dtype !== 'numeric';

  if (expr.kind === 'empty') {
    return (
      <div ref={setNodeRef} className="block-slot block-slot-empty" data-over={isOver} data-invalid={rejecting}>
        <span className="block-slot-placeholder">Glissez un champ numérique</span>
        <div className="page-actions">
          <button type="button" className="secondary" onClick={() => onChange({ kind: 'constant', value: '' })}>
            123
          </button>
          <label className="visually-hidden" htmlFor={`${dropId}-op`}>
            Opération
          </label>
          <select
            id={`${dropId}-op`}
            value=""
            onChange={(e) => {
              if (e.target.value) onChange(applyOperator(e.target.value as OperatorChoice));
            }}
          >
            <option value="">+ Opération</option>
            {OPERATOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (expr.kind === 'field') {
    const field = fieldsById[expr.fieldId];
    return (
      <div className="block-slot block-slot-filled">
        <span>{field ? displayLabel(field) : expr.fieldId}</span>
        <button type="button" aria-label="Retirer ce champ" onClick={() => onChange({ kind: 'empty' })}>
          ×
        </button>
      </div>
    );
  }

  if (expr.kind === 'constant') {
    return (
      <div className="block-slot block-slot-filled">
        <label className="visually-hidden" htmlFor={`${dropId}-const`}>
          Constante numérique
        </label>
        <input
          id={`${dropId}-const`}
          type="number"
          value={expr.value}
          placeholder="ex. 100"
          onChange={(e) => onChange({ kind: 'constant', value: e.target.value })}
        />
        <button type="button" aria-label="Retirer cette constante" onClick={() => onChange({ kind: 'empty' })}>
          ×
        </button>
      </div>
    );
  }

  if (expr.kind === 'binary') {
    return (
      <div className="block-slot block-slot-operation">
        <BlockSlot expr={expr.left} dropId={blockDropIdFor(dropId, 'left')} fieldsById={fieldsById} onChange={(left) => onChange({ ...expr, left })} />
        <span className="block-operator">{BLOCK_OP_SYMBOLS[expr.op]}</span>
        <BlockSlot expr={expr.right} dropId={blockDropIdFor(dropId, 'right')} fieldsById={fieldsById} onChange={(right) => onChange({ ...expr, right })} />
        <button type="button" aria-label="Retirer cette opération" onClick={() => onChange({ kind: 'empty' })}>
          ×
        </button>
      </div>
    );
  }

  if (expr.kind === 'ratio') {
    return (
      <div className="block-slot block-slot-operation">
        <span className="block-operator-label">Ratio</span>
        <BlockSlot
          expr={expr.numerator}
          dropId={blockDropIdFor(dropId, 'numerator')}
          fieldsById={fieldsById}
          onChange={(numerator) => onChange({ ...expr, numerator })}
        />
        <span className="block-operator">÷</span>
        <BlockSlot
          expr={expr.denominator}
          dropId={blockDropIdFor(dropId, 'denominator')}
          fieldsById={fieldsById}
          onChange={(denominator) => onChange({ ...expr, denominator })}
        />
        <button type="button" aria-label="Retirer ce ratio" onClick={() => onChange({ kind: 'empty' })}>
          ×
        </button>
      </div>
    );
  }

  // expr.kind === 'variation'
  return (
    <div className="block-slot block-slot-operation">
      <span className="block-operator-label">Variation %</span>
      <BlockSlot
        expr={expr.current}
        dropId={blockDropIdFor(dropId, 'current')}
        fieldsById={fieldsById}
        onChange={(current) => onChange({ ...expr, current })}
      />
      <span className="block-operator">vs</span>
      <BlockSlot
        expr={expr.previous}
        dropId={blockDropIdFor(dropId, 'previous')}
        fieldsById={fieldsById}
        onChange={(previous) => onChange({ ...expr, previous })}
      />
      <button type="button" aria-label="Retirer cette variation" onClick={() => onChange({ kind: 'empty' })}>
        ×
      </button>
    </div>
  );
}

export function BlockFormulaEditor({
  expr,
  fieldsById,
  onChange,
}: {
  expr: BlockExpr;
  fieldsById: Record<string, Field>;
  onChange: (next: BlockExpr) => void;
}) {
  return (
    <div className="block-formula-editor">
      <BlockSlot expr={expr} dropId={BLOCK_ROOT_DROP_ID} fieldsById={fieldsById} onChange={onChange} />
    </div>
  );
}
