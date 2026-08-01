/**
 * A small, deliberately constrained formula language for calculated fields — think "one Excel
 * formula", not a general scripting language. Everything here compiles to parameterized SQL
 * (knex's `?`/`??` bindings) and NOTHING from the formula text is ever string-interpolated
 * directly into SQL: field references go through `??` (knex's identifier escaping), literals go
 * through `?` (knex's value binding), and every operator/function name is matched against a fixed
 * allowlist during parsing — an unrecognized name is a parse error, never SQL text that reaches
 * the database. This is the load-bearing safety property of the whole module.
 *
 * Supported syntax:
 *   [table.column]                field reference (only real, already-known fields — a
 *                                  calculated field cannot reference another calculated field,
 *                                  which rules out cycles entirely)
 *   123, 3.14, "some text"         number / string literals
 *   + - * /                       arithmetic
 *   > >= < <= = !=                comparison
 *   AND OR NOT                    boolean logic
 *   IF(cond, then, else)          conditional
 *   CONCAT(a, b, ...)             string concatenation (2+ args)
 *   UPPER(x) / LOWER(x)           case conversion
 *   DATEDIFF(a, b)                whole days between two dates (a - b)
 *   ROUND(x) / ROUND(x, n)        numeric rounding
 *   ABS(x)                        absolute value
 *   ( ... )                       grouping
 */

export type FormulaDtype = 'text' | 'numeric' | 'date' | 'boolean';

export interface AvailableField {
  tableName: string;
  columnName: string;
}

export class FormulaError extends Error {}

// ---------- Tokenizer ----------

type TokenType = 'number' | 'string' | 'field' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

const MULTI_CHAR_OPERATORS = ['>=', '<=', '!='];
const SINGLE_CHAR_OPERATORS = ['+', '-', '*', '/', '>', '<', '='];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', value: char });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen', value: char });
      i++;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma', value: char });
      i++;
      continue;
    }

    if (char === '[') {
      const end = source.indexOf(']', i);
      if (end === -1) throw new FormulaError('Crochet "[" non refermé.');
      tokens.push({ type: 'field', value: source.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    if (char === '"') {
      let value = '';
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\' && source[i + 1] === '"') {
          value += '"';
          i += 2;
        } else {
          value += source[i];
          i++;
        }
      }
      if (i >= source.length) throw new FormulaError('Guillemet non refermé.');
      tokens.push({ type: 'string', value });
      i++;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let value = '';
      while (i < source.length && /[0-9.]/.test(source[i])) {
        value += source[i];
        i++;
      }
      tokens.push({ type: 'number', value });
      continue;
    }

    const twoChar = source.slice(i, i + 2);
    if (MULTI_CHAR_OPERATORS.includes(twoChar)) {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }
    if (SINGLE_CHAR_OPERATORS.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        value += source[i];
        i++;
      }
      tokens.push({ type: 'ident', value });
      continue;
    }

    throw new FormulaError(`Caractère inattendu : "${char}"`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

// ---------- AST ----------

type BinaryOp = '+' | '-' | '*' | '/' | '>' | '>=' | '<' | '<=' | '=' | '!=' | 'AND' | 'OR';

export type AstNode =
  | { kind: 'literal'; dtype: 'numeric' | 'text'; value: number | string }
  | { kind: 'field'; tableName: string; columnName: string }
  | { kind: 'binary'; op: BinaryOp; left: AstNode; right: AstNode }
  | { kind: 'not'; operand: AstNode }
  | { kind: 'negate'; operand: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] };

const FUNCTION_ARITY: Record<string, { min: number; max: number }> = {
  IF: { min: 3, max: 3 },
  CONCAT: { min: 2, max: 32 },
  UPPER: { min: 1, max: 1 },
  LOWER: { min: 1, max: 1 },
  DATEDIFF: { min: 2, max: 2 },
  ROUND: { min: 1, max: 2 },
  ABS: { min: 1, max: 1 },
};

// ---------- Parser (recursive descent, standard precedence climbing) ----------

class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    /** null = skip the field-existence check (query-time recompilation of an already-validated formula). */
    private readonly availableFields: AvailableField[] | null,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, description: string): Token {
    const token = this.next();
    if (token.type !== type) throw new FormulaError(`Attendu ${description}, trouvé "${token.value || '(fin)'}"`);
    return token;
  }

  parse(): AstNode {
    const node = this.parseOr();
    this.expect('eof', 'la fin de la formule');
    return node;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (this.peek().type === 'ident' && this.peek().value.toUpperCase() === 'OR') {
      this.next();
      left = { kind: 'binary', op: 'OR', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (this.peek().type === 'ident' && this.peek().value.toUpperCase() === 'AND') {
      this.next();
      left = { kind: 'binary', op: 'AND', left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): AstNode {
    if (this.peek().type === 'ident' && this.peek().value.toUpperCase() === 'NOT') {
      this.next();
      return { kind: 'not', operand: this.parseNot() };
    }
    return this.parseComparison();
  }

  private parseComparison(): AstNode {
    const left = this.parseAdditive();
    const token = this.peek();
    if (token.type === 'op' && ['>', '>=', '<', '<=', '=', '!='].includes(token.value)) {
      this.next();
      return { kind: 'binary', op: token.value as BinaryOp, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value as BinaryOp;
      left = { kind: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parseUnary();
    while (this.peek().type === 'op' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.next().value as BinaryOp;
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek().type === 'op' && this.peek().value === '-') {
      this.next();
      return { kind: 'negate', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const token = this.peek();

    if (token.type === 'number') {
      this.next();
      return { kind: 'literal', dtype: 'numeric', value: Number(token.value) };
    }
    if (token.type === 'string') {
      this.next();
      return { kind: 'literal', dtype: 'text', value: token.value };
    }
    if (token.type === 'field') {
      this.next();
      const [tableName, columnName] = token.value.split('.');
      if (!tableName || !columnName) throw new FormulaError(`Référence de champ invalide : [${token.value}] (attendu [table.colonne])`);
      if (this.availableFields) {
        const known = this.availableFields.some((f) => f.tableName === tableName && f.columnName === columnName);
        if (!known) throw new FormulaError(`Champ inconnu : ${tableName}.${columnName}`);
      }
      return { kind: 'field', tableName, columnName };
    }
    if (token.type === 'lparen') {
      this.next();
      const inner = this.parseOr();
      this.expect('rparen', '")"');
      return inner;
    }
    if (token.type === 'ident') {
      const name = token.value.toUpperCase();
      const arity = FUNCTION_ARITY[name];
      if (!arity) throw new FormulaError(`Fonction inconnue : ${token.value}()`);
      this.next();
      this.expect('lparen', `"(" après ${name}`);
      const args: AstNode[] = [];
      if (this.peek().type !== 'rparen') {
        args.push(this.parseOr());
        while (this.peek().type === 'comma') {
          this.next();
          args.push(this.parseOr());
        }
      }
      this.expect('rparen', `")" pour fermer ${name}(...)`);
      if (args.length < arity.min || args.length > arity.max) {
        throw new FormulaError(`${name}() attend ${arity.min === arity.max ? arity.min : `${arity.min} à ${arity.max}`} argument(s), reçu ${args.length}`);
      }
      return { kind: 'call', name, args };
    }

    throw new FormulaError(`Expression inattendue près de "${token.value || '(fin)'}"`);
  }
}

export function parseFormula(source: string, availableFields: AvailableField[] | null): AstNode {
  const trimmed = source.trim();
  if (!trimmed) throw new FormulaError('La formule est vide.');
  const tokens = tokenize(trimmed);
  return new Parser(tokens, availableFields).parse();
}

/** Every real field a formula touches — used to know which tables need joining when the field is used in a view. */
export function collectFieldRefs(node: AstNode): AvailableField[] {
  switch (node.kind) {
    case 'field':
      return [{ tableName: node.tableName, columnName: node.columnName }];
    case 'literal':
      return [];
    case 'binary':
      return [...collectFieldRefs(node.left), ...collectFieldRefs(node.right)];
    case 'not':
    case 'negate':
      return collectFieldRefs(node.operand);
    case 'call':
      return node.args.flatMap(collectFieldRefs);
  }
}

// ---------- SQL compilation ----------

export interface CompiledSql {
  sql: string;
  bindings: (string | number)[];
}

const BINARY_SQL: Record<BinaryOp, string> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '=': '=',
  '!=': '!=',
  AND: 'AND',
  OR: 'OR',
};

function compileNode(node: AstNode): CompiledSql {
  switch (node.kind) {
    case 'literal':
      return { sql: '?', bindings: [node.value] };
    case 'field':
      return { sql: '??', bindings: [`${node.tableName}.${node.columnName}`] };
    case 'binary': {
      const left = compileNode(node.left);
      const right = compileNode(node.right);
      return { sql: `(${left.sql} ${BINARY_SQL[node.op]} ${right.sql})`, bindings: [...left.bindings, ...right.bindings] };
    }
    case 'not': {
      const operand = compileNode(node.operand);
      return { sql: `(NOT ${operand.sql})`, bindings: operand.bindings };
    }
    case 'negate': {
      const operand = compileNode(node.operand);
      return { sql: `(-${operand.sql})`, bindings: operand.bindings };
    }
    case 'call':
      return compileFunctionCall(node.name, node.args.map(compileNode));
  }
}

function compileFunctionCall(name: string, args: CompiledSql[]): CompiledSql {
  const bindings = args.flatMap((a) => a.bindings);
  switch (name) {
    case 'IF':
      return { sql: `(CASE WHEN ${args[0].sql} THEN ${args[1].sql} ELSE ${args[2].sql} END)`, bindings };
    case 'CONCAT':
      // Every argument explicitly cast to text: Postgres's CONCAT is variadic ("any"), so a bare
      // `?` placeholder among the arguments has no type to infer from ("could not determine data
      // type of parameter") — this also correctly stringifies a non-text field (e.g. a number)
      // for concatenation, which is what CONCAT is for anyway.
      return { sql: `CONCAT(${args.map((a) => `(${a.sql})::text`).join(', ')})`, bindings };
    case 'UPPER':
      return { sql: `UPPER(${args[0].sql})`, bindings };
    case 'LOWER':
      return { sql: `LOWER(${args[0].sql})`, bindings };
    case 'DATEDIFF':
      return { sql: `(${args[0].sql}::date - ${args[1].sql}::date)`, bindings };
    case 'ROUND':
      return args.length === 2
        ? { sql: `ROUND((${args[0].sql})::numeric, ${args[1].sql})`, bindings }
        : { sql: `ROUND((${args[0].sql})::numeric)`, bindings };
    case 'ABS':
      return { sql: `ABS(${args[0].sql})`, bindings };
    default:
      // Unreachable: the parser already rejects unknown function names before this point.
      throw new FormulaError(`Fonction inconnue : ${name}()`);
  }
}

const DTYPE_CAST: Record<FormulaDtype, string> = {
  text: 'text',
  numeric: 'double precision',
  date: 'timestamptz',
  boolean: 'boolean',
};

/** Parses, validates field references against `availableFields`, and compiles straight to a bound SQL expression cast to the declared result type. */
export function compileFormula(source: string, dtype: FormulaDtype, availableFields: AvailableField[] | null): CompiledSql {
  const ast = parseFormula(source, availableFields);
  const compiled = compileNode(ast);
  return { sql: `(${compiled.sql})::${DTYPE_CAST[dtype]}`, bindings: compiled.bindings };
}
