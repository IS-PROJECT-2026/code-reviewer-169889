/**
 * Structural code-quality rules based on AST metrics.
 *
 * Each rule accepts a parsed AST and the file path, walks all function nodes,
 * measures a metric (line count or nesting depth), and emits a finding when
 * the measured value exceeds the configured threshold.
 *
 * Finding shape — identical to the ESLint finding shape used in the pipeline:
 *   { line, ruleId, message, severity }
 *   – line:     1-based line where the function starts.
 *   – ruleId:   rule identifier string.
 *   – message:  human-readable description including the measured value.
 *   – severity: 1 (warning) for all structural rules.
 *
 * @module structural-rules
 */

import { getFunctionLength, getMaxNestingDepth } from './ast-utils.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Functions longer than this many lines are flagged. */
export const MAX_FUNCTION_LINES = 40;

/** Control-flow nesting deeper than this level is flagged. */
export const MAX_NESTING_DEPTH = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** AST node types that represent a callable unit. */
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Returns a display name for a function node.
 *
 * Covers the most common patterns:
 *   function foo()         → "foo"
 *   const foo = () =>      → "foo"   (parent is VariableDeclarator)
 *   const foo = function bar() → "bar"
 *   method() {}            → "method"  (parent is MethodDefinition / Property)
 *   (none of the above)    → "(anonymous)"
 *
 * @param {object} node   - The function AST node.
 * @param {object|null} parent - The immediate parent AST node.
 * @returns {string}
 */
function getFunctionName(node, parent) {
  if (node.id?.name) return node.id.name;

  if (parent?.type === 'VariableDeclarator' && parent.id?.name) {
    return parent.id.name;
  }

  if (
    (parent?.type === 'MethodDefinition' || parent?.type === 'Property') &&
    parent.key?.name
  ) {
    return parent.key.name;
  }

  return '(anonymous)';
}

/**
 * Walks every node in an AST with parent tracking, calling `visitorFn` for
 * each node.
 *
 * @param {object} node
 * @param {(node: object, parent: object|null) => void} visitorFn
 * @param {object|null} [parent]
 */
function walkWithParent(node, visitorFn, parent = null) {
  if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;

  visitorFn(node, parent);

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkWithParent(child, visitorFn, node);
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walkWithParent(value, visitorFn, node);
    }
  }
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/**
 * Flags functions whose body exceeds {@link MAX_FUNCTION_LINES} lines.
 *
 * @param {object} ast  - Root Program node from `parseToAST`.
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function ruleLongFunctions(ast) {
  const findings = [];

  walkWithParent(ast, (node, parent) => {
    if (!FUNCTION_TYPES.has(node.type)) return;

    const lines = getFunctionLength(node);
    if (lines > MAX_FUNCTION_LINES) {
      findings.push({
        line: node.loc?.start.line ?? 1,
        ruleId: 'long-function',
        message: `Function "${getFunctionName(node, parent)}" is ${lines} lines long (max ${MAX_FUNCTION_LINES}).`,
        severity: 1,
      });
    }
  });

  return findings;
}

/**
 * Flags functions whose control-flow nesting exceeds {@link MAX_NESTING_DEPTH}.
 *
 * @param {object} ast  - Root Program node from `parseToAST`.
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function ruleDeepNesting(ast) {
  const findings = [];

  walkWithParent(ast, (node, parent) => {
    if (!FUNCTION_TYPES.has(node.type)) return;

    const depth = getMaxNestingDepth(node);
    if (depth > MAX_NESTING_DEPTH) {
      findings.push({
        line: node.loc?.start.line ?? 1,
        ruleId: 'deep-nesting',
        message: `Function "${getFunctionName(node, parent)}" has nesting depth ${depth} (max ${MAX_NESTING_DEPTH}).`,
        severity: 1,
      });
    }
  });

  return findings;
}

// ── Composite runner ──────────────────────────────────────────────────────────

/**
 * Runs all structural rules against a parsed AST and returns merged findings
 * sorted by line number.
 *
 * Returns an empty array when `ast` is `null` (parse failure — file is skipped
 * silently).
 *
 * @param {object|null} ast  - Parsed Program node, or null.
 * @param {string}      path - File path (used in log messages only).
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function runStructuralRules(ast, path) {
  if (!ast) return [];

  return [
    ...ruleLongFunctions(ast),
    ...ruleDeepNesting(ast),
  ].sort((a, b) => a.line - b.line);
}
