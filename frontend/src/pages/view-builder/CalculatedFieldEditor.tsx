import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import type { CalculatedField, FormulaDtype } from '../../api/types';
import { displayLabel, valueInputType, type Field } from './shelves';
import { CONDITION_FIELD_DROP_ID, COMPARISON_LABELS, compileSimpleCondition, type ComparisonOperator, type SimpleCondition } from './simple-condition';

const DTYPE_LABELS: Record<FormulaDtype, string> = {
  text: 'Texte',
  numeric: 'Nombre',
  date: 'Date',
  boolean: 'Booléen',
};

function ConditionFieldSlot({ field, onClear }: { field: Field | null; onClear: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: CONDITION_FIELD_DROP_ID });
  return (
    <div ref={setNodeRef} className="condition-field-slot" data-over={isOver}>
      {field ? (
        <>
          <span>{displayLabel(field)}</span>
          <button type="button" aria-label={`Retirer ${displayLabel(field)} de la condition`} onClick={onClear}>
            ×
          </button>
        </>
      ) : (
        <span className="condition-field-slot-placeholder">Glissez un champ ici</span>
      )}
    </div>
  );
}

export function CalculatedFieldEditor({
  availableFields,
  editing,
  simpleCondition,
  onSimpleConditionChange,
  onSave,
  onDelete,
  onCancel,
}: {
  /** Real fields only — calculated fields can't reference each other. */
  availableFields: Field[];
  editing: CalculatedField | null;
  simpleCondition: SimpleCondition;
  onSimpleConditionChange: (condition: SimpleCondition) => void;
  onSave: (field: CalculatedField) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [dtype, setDtype] = useState<FormulaDtype>(editing?.dtype ?? 'text');
  const [mode, setMode] = useState<'simple' | 'advanced'>(editing ? 'advanced' : 'simple');
  const [formula, setFormula] = useState(editing?.formula ?? '');
  const [error, setError] = useState<string | null>(null);

  const conditionField = simpleCondition.fieldId ? (availableFields.find((f) => f.id === simpleCondition.fieldId) ?? null) : null;
  const conditionValueInputType = conditionField ? valueInputType(conditionField.dtype) : 'text';

  function insertFieldRef(field: Field) {
    setFormula((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}[${field.tableName}.${field.columnName}]`);
  }

  function switchToAdvanced() {
    if (conditionField && simpleCondition.value && simpleCondition.thenValue && simpleCondition.elseValue) {
      setFormula(compileSimpleCondition(simpleCondition, dtype, conditionField));
    }
    setMode('advanced');
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === 'simple') {
      if (!conditionField) {
        setError('Glissez un champ dans la condition avant d’enregistrer.');
        return;
      }
      if (!simpleCondition.value || !simpleCondition.thenValue || !simpleCondition.elseValue) {
        setError('Renseignez la valeur de comparaison, le résultat « alors » et le résultat « sinon ».');
        return;
      }
      onSave({ id: editing?.id ?? crypto.randomUUID(), label, dtype, formula: compileSimpleCondition(simpleCondition, dtype, conditionField) });
      return;
    }

    onSave({ id: editing?.id ?? crypto.randomUUID(), label, dtype, formula });
  }

  return (
    <form onSubmit={handleSubmit} className="calculated-field-form">
      <h3>{editing ? 'Modifier le champ calculé' : 'Nouveau champ calculé'}</h3>
      <label htmlFor="calc-label">Nom</label>
      <input id="calc-label" value={label} onChange={(e) => setLabel(e.target.value)} required />

      <label htmlFor="calc-dtype">Type de résultat</label>
      <select id="calc-dtype" value={dtype} onChange={(e) => setDtype(e.target.value as FormulaDtype)}>
        {(Object.keys(DTYPE_LABELS) as FormulaDtype[]).map((d) => (
          <option key={d} value={d}>
            {DTYPE_LABELS[d]}
          </option>
        ))}
      </select>

      <div className="page-actions" role="tablist" aria-label="Mode de formule">
        <button type="button" className={mode === 'simple' ? undefined : 'secondary'} onClick={() => setMode('simple')}>
          Glisser-déposer
        </button>
        <button type="button" className={mode === 'advanced' ? undefined : 'secondary'} onClick={switchToAdvanced}>
          Formule texte
        </button>
      </div>

      {mode === 'simple' ? (
        <div className="simple-condition-builder">
          <p className="simple-condition-keyword">SI</p>
          <ConditionFieldSlot field={conditionField} onClear={() => onSimpleConditionChange({ ...simpleCondition, fieldId: null })} />
          <label htmlFor="calc-condition-operator" className="visually-hidden">
            Condition
          </label>
          <select
            id="calc-condition-operator"
            value={simpleCondition.operator}
            onChange={(e) => onSimpleConditionChange({ ...simpleCondition, operator: e.target.value as ComparisonOperator })}
          >
            {(Object.keys(COMPARISON_LABELS) as ComparisonOperator[]).map((operator) => (
              <option key={operator} value={operator}>
                {COMPARISON_LABELS[operator]}
              </option>
            ))}
          </select>
          <label htmlFor="calc-condition-value" className="visually-hidden">
            Valeur de comparaison
          </label>
          <input
            id="calc-condition-value"
            type={conditionValueInputType}
            value={simpleCondition.value}
            onChange={(e) => onSimpleConditionChange({ ...simpleCondition, value: e.target.value })}
            placeholder="valeur"
          />

          <p className="simple-condition-keyword">ALORS</p>
          <label htmlFor="calc-then-value" className="visually-hidden">
            Résultat si la condition est vraie
          </label>
          <input
            id="calc-then-value"
            value={simpleCondition.thenValue}
            onChange={(e) => onSimpleConditionChange({ ...simpleCondition, thenValue: e.target.value })}
            placeholder="ex. Gros client"
          />

          <p className="simple-condition-keyword">SINON</p>
          <label htmlFor="calc-else-value" className="visually-hidden">
            Résultat si la condition est fausse
          </label>
          <input
            id="calc-else-value"
            value={simpleCondition.elseValue}
            onChange={(e) => onSimpleConditionChange({ ...simpleCondition, elseValue: e.target.value })}
            placeholder="ex. Petit client"
          />
        </div>
      ) : (
        <>
          <label htmlFor="calc-formula">Formule</label>
          <textarea
            id="calc-formula"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            rows={4}
            placeholder='IF([table.colonne] > 1000, "Gros client", "Petit client")'
          />

          <fieldset>
            <legend>Insérer un champ dans la formule</legend>
            {availableFields.map((field) => (
              <button key={field.id} type="button" onClick={() => insertFieldRef(field)}>
                {displayLabel(field)}
              </button>
            ))}
          </fieldset>

          <p>
            Fonctions : IF(condition, alors, sinon) · CONCAT(a, b, ...) · UPPER(x) · LOWER(x) · DATEDIFF(date1, date2) · ROUND(x, décimales) · ABS(x).
            <br />
            Opérateurs : + − × ÷ &gt; &gt;= &lt; &lt;= = != ET (AND) OU (OR) NON (NOT).
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <div className="page-actions">
        <button type="submit">Enregistrer</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
        {editing && (
          <button type="button" className="danger" onClick={() => onDelete(editing.id)}>
            Supprimer ce champ calculé
          </button>
        )}
      </div>
    </form>
  );
}
