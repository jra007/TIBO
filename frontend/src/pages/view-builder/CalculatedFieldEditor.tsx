import { useState } from 'react';
import type { CalculatedField, FormulaDtype } from '../../api/types';
import { displayLabel, type Field } from './shelves';

const DTYPE_LABELS: Record<FormulaDtype, string> = {
  text: 'Texte',
  numeric: 'Nombre',
  date: 'Date',
  boolean: 'Booléen',
};

export function CalculatedFieldEditor({
  availableFields,
  editing,
  onSave,
  onDelete,
  onCancel,
}: {
  /** Real fields only — calculated fields can't reference each other. */
  availableFields: Field[];
  editing: CalculatedField | null;
  onSave: (field: CalculatedField) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [dtype, setDtype] = useState<FormulaDtype>(editing?.dtype ?? 'text');
  const [formula, setFormula] = useState(editing?.formula ?? '');

  function insertFieldRef(field: Field) {
    setFormula((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}[${field.tableName}.${field.columnName}]`);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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

      <label htmlFor="calc-formula">Formule</label>
      <textarea
        id="calc-formula"
        value={formula}
        onChange={(e) => setFormula(e.target.value)}
        rows={4}
        placeholder='IF([table.colonne] > 1000, "Gros client", "Petit client")'
        required
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
