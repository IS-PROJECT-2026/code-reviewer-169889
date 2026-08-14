/**
 * Duplicate code detection rule.
 *
 * Detects repeated code by two complementary strategies:
 *
 *  1. Function-body comparison (JS/TS/JSX/TSX — requires a parsed AST):
 *     Walks the AST of each file, extracts every function body, normalizes
 *     identifiers and whitespace, and compares all pairs using Jaccard
 *     similarity on character trigrams. Pairs above FUNC_SIMILARITY_THRESHOLD
 *     and above MIN_FUNC_NORMALIZED_LEN characters are flagged.
 *
 *     Normalization replaces all non-keyword identifiers with "ID" and all
 *     numeric literals with "NUM", so two functions that differ only in
 *     variable/parameter names produce identical normalized strings.
 *
 *  2. Line-sequence comparison (all file types — no AST required):
 *     Splits each file into normalized lines and slides a window of
 *     LINE_WINDOW_SIZE lines across. Identical normalized windows at different
 *     file positions are flagged. Overlapping windows from the same clone
 *     block are merged into one finding to prevent finding explosions.
 *
 * Finding shape — identical to all other rules in the pipeline:
 *   { line, ruleId, message, severity }
 *   – line:     1-based start line of the duplicate block.
 *   – ruleId:   'duplicate-code'
 *   – message:  description including the other file/line for reference.
 *   – severity: 1 (warning).
 *
 * This module intentionally does NOT import from ast-utils.js so that it
 * remains free of browser-CDN imports and can be tested directly in Node.js.
 * The walkAST helper is inlined here.
 *
 * @module duplicate-rules
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Jaccard similarity threshold (0–1) for flagging similar function bodies.
 * At 0.85, two functions that differ only in variable names score ~1.0 after
 * identifier normalization; genuinely different functions typically score < 0.5.
 */
export const FUNC_SIMILARITY_THRESHOLD = 0.85;

/**
 * Minimum length (chars) of normalized function text required for comparison.
 * Functions shorter than this are trivial stubs (getters, one-liners) and are
 * skipped to avoid false positives.
 */
export const MIN_FUNC_NORMALIZED_LEN = 80;

/** Number of consecutive lines required to form a line-sequence duplicate. */
export const LINE_WINDOW_SIZE = 4;

/** Min total chars across a window to be considered non-trivial content. */
const LINE_WINDOW_MIN_CHARS = 60;

// ── JS / TS keyword set ───────────────────────────────────────────────────────

/**
 * Keywords preserved as-is during identifier normalization.
 * Everything else (variable names, function names, parameters) becomes "ID".
 */
const KEYWORDS = new Set([
  // ECMAScript
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of',
  'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'async', 'await', 'from', 'as',
  'true', 'false', 'null', 'undefined',
  // TypeScript
  'type', 'interface', 'enum', 'namespace', 'abstract', 'declare',
  'implements', 'readonly', 'override', 'keyof', 'infer', 'satisfies',
]);

// ── Normalization ─────────────────────────────────────────────────────────────

/**
 * Normalizes a function body for structural comparison.
 *
 * Steps (in order):
 *  1. Strip `//` line comments.
 *  2. Strip block comments.
 *  3. Normalize template literals → STR.
 *  4. Normalize double-quoted strings → STR.
 *  5. Normalize single-quoted strings → STR.
 *  6. Normalize numeric literals → NUM.
 *  7. Replace non-keyword identifiers → ID.
 *  8. Collapse all whitespace to a single space.
 *
 * Two functions identical in structure but with different variable/function
 * names will produce the same normalized string.
 *
 * Exported for testing.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeCode(text) {
  return text
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/`[^`]*`/g, '0STR')
    .replace(/"(?:[^"\\]|\\.)*"/g, '0STR')
    .replace(/'(?:[^'\\]|\\.)*'/g, '0STR')
    .replace(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, '0NUM')
    .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, (m) => (KEYWORDS.has(m) ? m : 'ID'))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a single source line for line-sequence comparison.
 * Only collapses whitespace — does NOT normalize identifiers, so only exact
 * content matches (modulo formatting) are flagged at this level.
 *
 * Exported for testing.
 *
 * @param {string} line
 * @returns {string}
 */
export function normalizeLine(line) {
  return line.trim().replace(/\s+/g, ' ');
}

// ── Similarity ────────────────────────────────────────────────────────────────

/**
 * Builds a Set of character n-grams from `text`.
 *
 * Exported for testing.
 *
 * @param {string} text
 * @param {number} [n=3]
 * @returns {Set<string>}
 */
export function buildNgramSet(text, n = 3) {
  const set = new Set();
  for (let i = 0; i <= text.length - n; i++) {
    set.add(text.slice(i, i + n));
  }
  return set;
}

/**
 * Computes Jaccard similarity between two strings using character trigrams.
 * Returns a value in [0, 1] where 1 means identical.
 *
 * Exported for testing.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function computeSimilarity(a, b) {
  if (a === b) return 1;
  const setA = buildNgramSet(a);
  const setB = buildNgramSet(b);
  let intersection = 0;
  for (const g of setA) if (setB.has(g)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

// ── AST helpers (inlined — no CDN import) ─────────────────────────────────────

const FUNC_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Lightweight pre-order AST walker.
 * Inlined from ast-utils.js so this module has no browser-CDN dependencies.
 */
function walkAST(node, visitorFn) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitorFn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkAST(child, visitorFn);
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      walkAST(value, visitorFn);
    }
  }
}

/** Returns the declared name of a function node, or "(anonymous)". */
function getFuncName(node) {
  return node.id?.name ?? '(anonymous)';
}

// ── Function-level duplicate detection ────────────────────────────────────────

/**
 * Collects all qualifying function entries from AST-bearing file entries.
 *
 * @param {Array<{path:string, content:string, ast:object|null}>} fileEntries
 * @returns {Array<{path:string, startLine:number, endLine:number, name:string, normalized:string}>}
 */
function collectFunctions(fileEntries) {
  const functions = [];

  for (const { path, content, ast } of fileEntries) {
    if (!ast) continue;
    const lines = content.split('\n');

    walkAST(ast, (node) => {
      if (!FUNC_TYPES.has(node.type) || !node.loc) return;

      const startLine = node.loc.start.line;  // 1-based
      const endLine = node.loc.end.line;

      // Extract source text using loc (slice is 0-based)
      const bodyText = lines.slice(startLine - 1, endLine).join('\n');
      const normalized = normalizeCode(bodyText);

      if (normalized.length >= MIN_FUNC_NORMALIZED_LEN) {
        functions.push({ path, startLine, endLine, name: getFuncName(node), normalized });
      }
    });
  }

  return functions;
}

/**
 * Compares all collected function entries pairwise and returns duplicate pairs.
 *
 * Skips:
 *  – Same-location pairs (same file, same start line).
 *  – Nested functions (one's range fully contained within the other's).
 *  – Already-reported pairs (only A→B is reported, not also B→A).
 *
 * Exported for testing — callers can supply pre-built function entries
 * without needing a parsed AST.
 *
 * @param {Array<{path:string, startLine:number, endLine:number, name:string, normalized:string}>} functions
 * @returns {Array<{pathA:string, lineA:number, nameA:string, pathB:string, lineB:number, nameB:string, similarity:number}>}
 */
export function findDuplicateFunctions(functions) {
  const pairs = [];
  const seen = new Set();

  for (let i = 0; i < functions.length; i++) {
    for (let j = i + 1; j < functions.length; j++) {
      const a = functions[i];
      const b = functions[j];

      // Same location
      if (a.path === b.path && a.startLine === b.startLine) continue;

      // Skip nested functions (one range fully inside the other)
      if (
        a.path === b.path &&
        ((b.startLine >= a.startLine && b.endLine <= a.endLine) ||
          (a.startLine >= b.startLine && a.endLine <= b.endLine))
      ) {
        continue;
      }

      // Canonical pair key to avoid A→B and B→A both appearing
      const pairKey = [`${a.path}:${a.startLine}`, `${b.path}:${b.startLine}`]
        .sort()
        .join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const sim = computeSimilarity(a.normalized, b.normalized);
      if (sim >= FUNC_SIMILARITY_THRESHOLD) {
        pairs.push({
          pathA: a.path, lineA: a.startLine, nameA: a.name,
          pathB: b.path, lineB: b.startLine, nameB: b.name,
          similarity: sim,
        });
      }
    }
  }

  return pairs;
}

// ── Line-sequence duplicate detection ─────────────────────────────────────────

/**
 * Finds repeated line sequences across all file entries.
 *
 * Algorithm:
 *  1. For each file, slide a window of LINE_WINDOW_SIZE normalized lines.
 *  2. Store each window in a Map keyed by its normalized content.
 *  3. When a key is seen a second time (different location), record a pair.
 *  4. Sort and merge overlapping windows from the same clone block into one
 *     result entry to avoid reporting dozens of findings for a single block.
 *
 * Exported for testing.
 *
 * @param {Array<{path:string, content:string}>} fileEntries
 * @returns {Array<{pathA:string, lineA:number, pathB:string, lineB:number, windowSize:number}>}
 */
export function findDuplicateLineSequences(fileEntries) {
  // windowMap: normalized-window-key → first occurrence {path, startLine}
  const windowMap = new Map();
  const rawPairs = [];

  for (const { path, content } of fileEntries) {
    const normLines = content.split('\n').map(normalizeLine);

    for (let i = 0; i <= normLines.length - LINE_WINDOW_SIZE; i++) {
      const window = normLines.slice(i, i + LINE_WINDOW_SIZE);

      // Skip trivially short windows (mostly braces / blank lines)
      const totalChars = window.reduce((sum, l) => sum + l.length, 0);
      if (totalChars < LINE_WINDOW_MIN_CHARS) continue;

      const key = window.join('\n');

      if (windowMap.has(key)) {
        const first = windowMap.get(key);
        // Avoid same-location match (shouldn't happen, but guard)
        if (first.path === path && first.startLine === i + 1) continue;

        rawPairs.push({
          pathA: first.path,
          lineA: first.startLine,
          pathB: path,
          lineB: i + 1,  // 1-based
          windowSize: LINE_WINDOW_SIZE,
        });
      } else {
        windowMap.set(key, { path, startLine: i + 1 });
      }
    }
  }

  // Sort by (pathA, pathB, lineA) to make adjacent overlapping windows contiguous
  rawPairs.sort((a, b) => {
    if (a.pathA !== b.pathA) return a.pathA.localeCompare(b.pathA);
    if (a.pathB !== b.pathB) return a.pathB.localeCompare(b.pathB);
    return a.lineA - b.lineA;
  });

  // Merge overlapping windows from the same clone block
  const merged = [];
  // lastEnd: `${pathA}::${pathB}` → {endA, endB}
  const lastEnd = new Map();

  for (const pair of rawPairs) {
    const mergeKey = `${pair.pathA}::${pair.pathB}`;
    const last = lastEnd.get(mergeKey);

    if (last && pair.lineA <= last.endA && pair.lineB <= last.endB) {
      // Overlapping window — extend the last reported region
      last.endA = Math.max(last.endA, pair.lineA + pair.windowSize - 1);
      last.endB = Math.max(last.endB, pair.lineB + pair.windowSize - 1);
      continue;
    }

    merged.push(pair);
    lastEnd.set(mergeKey, {
      endA: pair.lineA + pair.windowSize - 1,
      endB: pair.lineB + pair.windowSize - 1,
    });
  }

  return merged;
}

// ── Main runner ───────────────────────────────────────────────────────────────

/**
 * Runs both duplicate-detection strategies and returns per-file findings,
 * sorted by line number within each file.
 *
 * Runs on all entries; AST-based detection is skipped for files where
 * `ast` is `null` (non-JS files or parse failures).
 *
 * Returns only files that have at least one finding.
 *
 * @param {Array<{path:string, content:string, ast:object|null}>} fileEntries
 * @returns {Array<{path:string, findings:Array<{line:number, ruleId:string, message:string, severity:number}>}>}
 */
export function runDuplicateDetection(fileEntries) {
  // Initialise a findings list for every input file
  const findingsMap = new Map();
  for (const { path } of fileEntries) findingsMap.set(path, []);

  const addFinding = (path, line, message) => {
    findingsMap.get(path)?.push({ line, ruleId: 'duplicate-code', message, severity: 1 });
  };

  // Track reported line ranges per file to avoid duplicate findings when the
  // same block is caught by both strategies or by multiple pairs.
  const reportedRanges = new Map(); // path → [{start, end}]

  const isRangeReported = (path, start, end) =>
    (reportedRanges.get(path) ?? []).some((r) => start <= r.end && end >= r.start);

  const markRange = (path, start, end) => {
    if (!reportedRanges.has(path)) reportedRanges.set(path, []);
    reportedRanges.get(path).push({ start, end });
  };

  // ── 1. Function-level ────────────────────────────────────────────────────

  const functions = collectFunctions(fileEntries);
  const funcPairs = findDuplicateFunctions(functions);

  for (const { pathA, lineA, nameA, pathB, lineB, nameB, similarity } of funcPairs) {
    const pct = Math.round(similarity * 100);
    const fnA = functions.find((f) => f.path === pathA && f.startLine === lineA);
    const fnB = functions.find((f) => f.path === pathB && f.startLine === lineB);
    const endA = fnA?.endLine ?? lineA;
    const endB = fnB?.endLine ?? lineB;

    if (!isRangeReported(pathA, lineA, endA)) {
      addFinding(
        pathA, lineA,
        `Duplicate function body (${pct}% similar to "${nameB}" in ${pathB}:${lineB}).`
      );
      markRange(pathA, lineA, endA);
    }
    if (!isRangeReported(pathB, lineB, endB)) {
      addFinding(
        pathB, lineB,
        `Duplicate function body (${pct}% similar to "${nameA}" in ${pathA}:${lineA}).`
      );
      markRange(pathB, lineB, endB);
    }
  }

  // ── 2. Line-sequence level ────────────────────────────────────────────────

  const seqPairs = findDuplicateLineSequences(fileEntries);

  for (const { pathA, lineA, pathB, lineB, windowSize } of seqPairs) {
    const endA = lineA + windowSize - 1;
    const endB = lineB + windowSize - 1;

    if (!isRangeReported(pathA, lineA, endA)) {
      addFinding(
        pathA, lineA,
        `Duplicate line sequence (${windowSize}+ lines also at ${pathB}:${lineB}).`
      );
      markRange(pathA, lineA, endA);
    }
    if (!isRangeReported(pathB, lineB, endB)) {
      addFinding(
        pathB, lineB,
        `Duplicate line sequence (${windowSize}+ lines also at ${pathA}:${lineA}).`
      );
      markRange(pathB, lineB, endB);
    }
  }

  // ── Collect and sort ─────────────────────────────────────────────────────

  const result = [];
  for (const [path, findings] of findingsMap) {
    if (findings.length > 0) {
      result.push({ path, findings: findings.sort((a, b) => a.line - b.line) });
    }
  }
  return result;
}
