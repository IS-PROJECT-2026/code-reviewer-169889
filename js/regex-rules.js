/**
 * Regex-based code-review rules.
 *
 * Scans source files line-by-line with regular expressions to detect:
 *   1. Hardcoded credentials / secrets  (ruleId: 'hardcoded-secret')
 *   2. TODO / FIXME comments            (ruleId: 'todo-comment')
 *   3. Debug statements                 (ruleId: 'debug-statement')
 *
 * Runs on ALL supported file types (.js, .ts, .jsx, .tsx, .html, .css, .json)
 * because secrets and TODOs can appear in any file.
 *
 * Finding shape — identical to the ESLint / structural-rules shape:
 *   { line, ruleId, message, severity }
 *   – line:     1-based line number of the match.
 *   – ruleId:   string identifier for the rule.
 *   – message:  human-readable description.
 *   – severity: 2 (error) for secrets, 1 (warning) for TODOs and debug.
 *
 * @module regex-rules
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

/**
 * Credentials / secret patterns.
 *
 * Each entry has:
 *   label   – shown in the finding message.
 *   pattern – regex tested against the trimmed source line.
 *
 * Design notes:
 *  • Patterns are intentionally broad so real leaks are caught, but anchored
 *    to assignment / value context to avoid false positives on, e.g., CSS
 *    colour names containing "key" or prose in comments.
 *  • Placeholder / example values ("your-api-key", "xxxx", "****", "<…>")
 *    are explicitly excluded via negative look-ahead where the risk of noise
 *    outweighs the benefit.
 */
const SECRET_PATTERNS = [
  {
    label: 'API key',
    // Covers: apiKey = "…"  |  "api_key": "…"  |  apiKey: string = "…" (TS)
    // Key may be optionally double-quoted (JSON). After the key, an optional
    // `: TypeAnnotation` is skipped before the `=` or `:` assignment.
    // Excludes obvious placeholder values (your-, xx+, **).
    pattern:
      /"?api[_-]?key"?(?:\s*:[^=\n"']+)?\s*[:=]\s*["'](?!(?:your[_-]?|my[_-]?)?(?:api[_-]?)?key|<|xx+|\*+)[^"'\s]{8,}["']/i,
  },
  {
    label: 'secret / token',
    // Covers: secret = "…"  |  "token": "…"  |  authToken: string = "…" (TS)
    pattern:
      /"?(?:secret|token|auth[_-]?token|bearer)"?(?:\s*:[^=\n"']+)?\s*[:=]\s*["'](?!(?:your|my|the|a)[_\s-]|<|xx+|\*+)[^"'\s]{8,}["']/i,
  },
  {
    label: 'password',
    // Covers: password = "hunter2"  |  "passwd": "…"  |  password: string = "…"
    // Excludes: empty value, value equal to "password" itself, common placeholders.
    pattern:
      /"?(?:password|passwd|pwd)"?(?:\s*:[^=\n"']+)?\s*[:=]\s*["'](?!(?:password|passwd|your|my|<|xx+|\*+))[^"'\s]{4,}["']/i,
  },
  {
    label: 'private key header',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
];


/**
 * TODO / FIXME comment patterns.
 * Matches the keywords anywhere inside a comment-like context on the line.
 */
const TODO_PATTERN = /(?:\/\/|\/\*|#|<!--|;)\s*(?:TODO|FIXME)\b/i;

/**
 * Debug-statement patterns.
 * Matches standalone console.log / debugger as statements (not inside strings).
 */
const DEBUG_PATTERNS = [
  {
    label: 'console.log',
    // Allows console.error / .warn / .info — only flags .log
    pattern: /\bconsole\.log\s*\(/,
  },
  {
    label: 'debugger statement',
    pattern: /\bdebugger\s*;?$/,
  },
];

// ── Core scanner ──────────────────────────────────────────────────────────────

/**
 * Scans `code` line-by-line, applying the supplied pattern set.
 *
 * @param {string}   code      - Raw file content.
 * @param {Array<{label:string, pattern:RegExp}>} patterns
 * @param {string}   ruleId    - Finding ruleId.
 * @param {number}   severity  - Finding severity.
 * @param {(label:string, lineText:string) => string} messageFn
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
function scanLines(code, patterns, ruleId, severity, messageFn) {
  const findings = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    for (const { label, pattern } of patterns) {
      if (pattern.test(lineText)) {
        findings.push({
          line: i + 1,
          ruleId,
          message: messageFn(label, lineText.trim()),
          severity,
        });
        break; // one finding per line per rule category
      }
    }
  }

  return findings;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

/**
 * Detects hardcoded credentials / secrets.
 *
 * @param {string} code - Raw source content.
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function ruleHardcodedSecrets(code) {
  return scanLines(
    code,
    SECRET_PATTERNS,
    'hardcoded-secret',
    2,
    (label) => `Possible hardcoded ${label} detected. Move secrets to environment variables.`
  );
}

/**
 * Detects TODO and FIXME comments.
 *
 * @param {string} code
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function ruleTodoComments(code) {
  return scanLines(
    code,
    [{ label: 'TODO/FIXME', pattern: TODO_PATTERN }],
    'todo-comment',
    1,
    (_label, lineText) => `Unresolved comment: "${lineText.slice(0, 80)}"`
  );
}

/**
 * Detects debug statements (console.log, debugger).
 *
 * @param {string} code
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function ruleDebugStatements(code) {
  return scanLines(
    code,
    DEBUG_PATTERNS,
    'debug-statement',
    1,
    (label) => `Debug statement found: ${label}. Remove before merging.`
  );
}

// ── Composite runner ──────────────────────────────────────────────────────────

/**
 * Runs all regex-based rules against raw file content and returns merged
 * findings sorted by line number.
 *
 * Accepts any file type — callers do not need to filter by extension.
 *
 * @param {string} code - Raw file content.
 * @param {string} path - File path (reserved for future use / logging).
 * @returns {Array<{line:number, ruleId:string, message:string, severity:number}>}
 */
export function runRegexRules(code, path) {
  return [
    ...ruleHardcodedSecrets(code),
    ...ruleTodoComments(code),
    ...ruleDebugStatements(code),
  ].sort((a, b) => a.line - b.line);
}
