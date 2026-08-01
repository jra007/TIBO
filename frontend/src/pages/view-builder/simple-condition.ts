import type { FormulaDtype } from '../../api/types';
import type { Field } from './shelves';

export const CONDITION_FIELD_DROP_ID = 'calc-condition-field';

export type ComparisonOperator = '=' | '!=' | '>' | '>=' | '<' | '<=';

export const COMPARISON_LABELS: Record<ComparisonOperator, string> = {
  '=': 'est égal à',
  '!=': 'est différent de',
  '>': 'est supérieur à',
  '>=': 'est supérieur ou égal à',
  '<': 'est inférieur à',
  '<=': 'est inférieur ou égal à',
};

export interface SimpleCondition {
  fieldId: string | null;
  operator: ComparisonOperator;
  value: string;
  thenValue: string;
  elseValue: string;
}

export function emptySimpleCondition(): SimpleCondition {
  return { fieldId: null, operator: '>', value: '', thenValue: '', elseValue: '' };
}

function quoteIfNeeded(raw: string, dtype: 'text' | 'numeric' | 'date' | 'boolean'): string {
  if (dtype === 'numeric') return raw;
  return `"${raw.replace(/"/g, '\\"')}"`;
}

/** Builds the same IF(...) formula text the advanced/text mode would produce — the visual builder is just a friendlier way to write it. */
export function compileSimpleCondition(condition: SimpleCondition, resultDtype: FormulaDtype, field: Field): string {
  const fieldRef = `[${field.tableName}.${field.columnName}]`;
  const value = quoteIfNeeded(condition.value, field.dtype);
  const thenValue = quoteIfNeeded(condition.thenValue, resultDtype);
  const elseValue = quoteIfNeeded(condition.elseValue, resultDtype);
  return `IF(${fieldRef} ${condition.operator} ${value}, ${thenValue}, ${elseValue})`;
}
