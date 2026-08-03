import type { Field } from './shelves';

export type BlockOp = '+' | '-' | '*' | '/';

export const BLOCK_OP_SYMBOLS: Record<BlockOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/**
 * A block-assembled arithmetic tree — the user never types formula syntax, only drags field
 * blocks and picks operator blocks. Compiles down to the same formula-text grammar formula.ts
 * already parses (see compileBlockExpr) rather than a separate execution path: the constrained
 * parser + parameterized SQL already gives every safety property a JSON-tree representation
 * would (no free-text interpretation reaches the database either way), so reusing it avoids a
 * second backend representation to validate and keep in sync.
 */
export type BlockExpr =
  | { kind: 'empty' }
  | { kind: 'field'; fieldId: string }
  | { kind: 'constant'; value: string }
  | { kind: 'binary'; op: BlockOp; left: BlockExpr; right: BlockExpr }
  | { kind: 'ratio'; numerator: BlockExpr; denominator: BlockExpr }
  | { kind: 'variation'; current: BlockExpr; previous: BlockExpr };

export function emptyBlockExpr(): BlockExpr {
  return { kind: 'empty' };
}

export function isBlockExprComplete(expr: BlockExpr): boolean {
  switch (expr.kind) {
    case 'empty':
      return false;
    case 'field':
      return Boolean(expr.fieldId);
    case 'constant':
      return expr.value.trim() !== '' && !Number.isNaN(Number(expr.value));
    case 'binary':
      return isBlockExprComplete(expr.left) && isBlockExprComplete(expr.right);
    case 'ratio':
      return isBlockExprComplete(expr.numerator) && isBlockExprComplete(expr.denominator);
    case 'variation':
      return isBlockExprComplete(expr.current) && isBlockExprComplete(expr.previous);
  }
}

/** Assumes isBlockExprComplete(expr) — callers check completeness before offering to save/preview. */
export function compileBlockExpr(expr: BlockExpr, fieldsById: Record<string, Field>): string {
  switch (expr.kind) {
    case 'empty':
      throw new Error('Formule incomplète.');
    case 'field': {
      const field = fieldsById[expr.fieldId];
      if (!field) throw new Error('Champ introuvable.');
      return `[${field.tableName}.${field.columnName}]`;
    }
    case 'constant':
      return expr.value.trim();
    case 'binary':
      return `(${compileBlockExpr(expr.left, fieldsById)} ${expr.op} ${compileBlockExpr(expr.right, fieldsById)})`;
    case 'ratio': {
      // Safe division: falls back to 0 rather than letting a zero denominator surface as a SQL error.
      const numerator = compileBlockExpr(expr.numerator, fieldsById);
      const denominator = compileBlockExpr(expr.denominator, fieldsById);
      return `IF(${denominator} = 0, 0, ${numerator} / ${denominator})`;
    }
    case 'variation': {
      const current = compileBlockExpr(expr.current, fieldsById);
      const previous = compileBlockExpr(expr.previous, fieldsById);
      return `IF(${previous} = 0, 0, ((${current} - ${previous}) / ${previous}) * 100)`;
    }
  }
}

export const BLOCK_ROOT_DROP_ID = 'calc-block-root';

export function blockDropIdFor(parentId: string, key: string): string {
  return `${parentId}.${key}`;
}

/**
 * Every denominator (Ratio) / prior-period value (Variation%) in the tree, compiled to formula
 * text — the block compiler wraps each in `IF(denom = 0, 0, ...)` so the query never errors, but
 * that means a missing/zero denominator silently renders as a plausible "0" unless the preview
 * checks these separately and flags it (spec: calculated-field addendum §3.3/§6).
 */
export function collectDivisionGuards(expr: BlockExpr, fieldsById: Record<string, Field>): string[] {
  switch (expr.kind) {
    case 'empty':
    case 'field':
    case 'constant':
      return [];
    case 'binary':
      return [...collectDivisionGuards(expr.left, fieldsById), ...collectDivisionGuards(expr.right, fieldsById)];
    case 'ratio':
      return [compileBlockExpr(expr.denominator, fieldsById), ...collectDivisionGuards(expr.numerator, fieldsById), ...collectDivisionGuards(expr.denominator, fieldsById)];
    case 'variation':
      return [compileBlockExpr(expr.previous, fieldsById), ...collectDivisionGuards(expr.current, fieldsById), ...collectDivisionGuards(expr.previous, fieldsById)];
  }
}

/** Inverse of blockDropIdFor's nesting — turns a drop target's id back into the path of keys from the root. */
export function pathFromBlockDropId(dropId: string): string[] {
  if (dropId === BLOCK_ROOT_DROP_ID) return [];
  if (!dropId.startsWith(`${BLOCK_ROOT_DROP_ID}.`)) return [];
  return dropId.slice(BLOCK_ROOT_DROP_ID.length + 1).split('.');
}

function childKeys(expr: BlockExpr): { key: string; child: BlockExpr }[] {
  switch (expr.kind) {
    case 'binary':
      return [
        { key: 'left', child: expr.left },
        { key: 'right', child: expr.right },
      ];
    case 'ratio':
      return [
        { key: 'numerator', child: expr.numerator },
        { key: 'denominator', child: expr.denominator },
      ];
    case 'variation':
      return [
        { key: 'current', child: expr.current },
        { key: 'previous', child: expr.previous },
      ];
    default:
      return [];
  }
}

/** Replaces the node at `path` (from the root) with `value` — used to drop a field onto a nested slot. Returns the root unchanged if the path no longer matches the tree's current shape (a stale drop-target id from before a re-render). */
export function setBlockExprAtPath(root: BlockExpr, path: string[], value: BlockExpr): BlockExpr {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const match = childKeys(root).find((c) => c.key === head);
  if (!match) return root;
  const updatedChild = setBlockExprAtPath(match.child, rest, value);
  return { ...root, [head]: updatedChild } as BlockExpr;
}
