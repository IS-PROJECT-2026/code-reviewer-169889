/**
 * AST utilities for in-browser code analysis.
 *
 * Uses Acorn (8.x) loaded directly from jsDelivr's ESM build — no separate
 * <script> tag required. The parse, walkAST, getFunctionLength, and
 * getMaxNestingDepth helpers are the building blocks for the structural-
 * analysis rules (issue #6). This file only provides measurement primitives;
 * threshold comparisons and finding generation are handled in that issue.
 *
 * @module ast-utils
 */

import * as acorn from 'https://cdn.jsdelivr.net/npm/acorn/+esm';
import { tsPlugin } from 'https://cdn.jsdelivr.net/npm/@sveltejs/acorn-typescript/+esm';

// Single extended parser that handles JS, TS, JSX, and TSX — no branching
// on file extension needed. acorn-jsx is not imported separately because
// @sveltejs/acorn-typescript bundles JSX support internally.
const TSParser = acorn.Parser.extend(tsPlugin());

// ── Parse ─────────────────────────────────────────────────────────────────────

/**
 * Parses JavaScript source code into an Acorn AST.
 *
 * Returns `null` on any parse failure (syntax error, unsupported syntax, etc.)
 * so callers can skip invalid files gracefully without try/catch boilerplate.
 *
 * `locations: true` is always set so every node carries `.loc.start.line` and
 * `.loc.end.line`, which are required by {@link getFunctionLength}.
 *
 * @param {string} code - JavaScript source to parse.
 * @returns {import('acorn').Node | null} Root `Program` node, or `null` on failure.
 */
export function parseToAST(code) {
  try {
    return TSParser.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
    });
  } catch {
    return null;
  }
}

// ── Walk ──────────────────────────────────────────────────────────────────────

/**
 * Recursively walks every node in an Acorn AST, calling `visitorFn` on each.
 *
 * The visitor is called *before* recursing into children (pre-order traversal).
 * Array-valued properties (e.g. `body`, `params`) are iterated; non-node
 * objects and primitives are silently skipped.
 *
 * @param {import('acorn').Node | null} node - AST node to start from.
 * @param {(node: import('acorn').Node) => void} visitorFn - Called for every node.
 */
export function walkAST(node, visitorFn) {
  if (!node || typeof node !== 'object') return;

  // Acorn nodes always have a `type` string property.
  if (typeof node.type === 'string') {
    visitorFn(node);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        walkAST(child, visitorFn);
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walkAST(value, visitorFn);
    }
  }
}

// ── Metrics ───────────────────────────────────────────────────────────────────

/**
 * Returns the line count of a function / arrow-function AST node.
 *
 * Requires that the AST was parsed with `locations: true` (which {@link parseToAST}
 * always does). Returns 0 if location data is missing.
 *
 * @param {import('acorn').Node} functionNode
 *   A node whose `type` is one of `FunctionDeclaration`, `FunctionExpression`,
 *   or `ArrowFunctionExpression`.
 * @returns {number} Number of lines the function spans (inclusive).
 */
export function getFunctionLength(functionNode) {
  const loc = functionNode?.loc;
  if (!loc) return 0;
  // +1 because both start and end lines are inclusive
  return loc.end.line - loc.start.line + 1;
}

/**
 * Returns the maximum nesting depth of control-flow blocks inside a function.
 *
 * Counts nesting from `if`, `for`, `while`, `do…while`, and `switch` statements.
 * The function body itself is depth 0; the first nested block is depth 1, etc.
 *
 * @param {import('acorn').Node} functionNode
 *   A function/arrow-function AST node.
 * @returns {number} Maximum nesting depth found, or 0 if the body is flat.
 */
export function getMaxNestingDepth(functionNode) {
  /** Node types that count as a nesting level. */
  const NESTING_TYPES = new Set([
    'IfStatement',
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
    'SwitchStatement',
  ]);

  let maxDepth = 0;

  /**
   * DFS through the function body, tracking the current depth.
   * We only count nesting *inside* the function, so we start from its body,
   * not from the function node itself.
   *
   * @param {import('acorn').Node} node
   * @param {number} depth
   */
  function walk(node, depth) {
    if (!node || typeof node !== 'object') return;

    let nextDepth = depth;
    if (typeof node.type === 'string' && NESTING_TYPES.has(node.type)) {
      nextDepth = depth + 1;
      if (nextDepth > maxDepth) maxDepth = nextDepth;
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) walk(child, nextDepth);
      } else if (value && typeof value === 'object' && typeof value.type === 'string') {
        walk(value, nextDepth);
      }
    }
  }

  // For arrow functions, body may be an expression rather than a BlockStatement.
  const body = functionNode?.body;
  if (body) walk(body, 0);

  return maxDepth;
}
