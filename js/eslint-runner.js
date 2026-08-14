/**
 * ESLint runner for in-browser linting.
 *
 * Requires the `eslint-linter-browserify` script to have been loaded via CDN
 * before this module is imported (it attaches `window.eslint`).
 *
 * @module eslint-runner
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Extensions that ESLint can meaningfully lint. */
const LINTABLE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

/**
 * Minimal rule config applied to every file.
 * Intentionally hardcoded – no separate config file needed for this milestone.
 *
 * Uses the flat-config `languageOptions` shape supported by
 * `eslint-linter-browserify` 10.x (`Linter#verify`).
 */
const ESLINT_CONFIG = {
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
    globals: {
      window: 'readonly',
      document: 'readonly',
      console: 'readonly',
      module: 'readonly',
      require: 'readonly',
      process: 'readonly',
      // add any other browser/node globals your linted repos commonly use
    },
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'warn',
    'no-console': 'warn',
    'no-debugger': 'error',
    eqeqeq: ['warn', 'always'],
  },
};

// ── Singleton linter ─────────────────────────────────────────────────────────

let _linter = null;

/**
 * Returns the shared Linter instance, creating it lazily on first call.
 * Throws a clear error if the CDN script wasn't loaded.
 *
 * @returns {import('eslint').Linter}
 */
function getLinter() {
  if (_linter) return _linter;

  if (typeof window.eslint === 'undefined') {
    throw new Error(
      'eslint-linter-browserify is not loaded. ' +
        'Make sure the CDN <script> tag appears before js/main.js.'
    );
  }

  _linter = new window.eslint.Linter();
  return _linter;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns `true` when ESLint should be run on a given filename.
 *
 * @param {string} filename
 * @returns {boolean}
 */
export function isLintableFile(filename) {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return LINTABLE_EXTENSIONS.has(filename.slice(dotIndex).toLowerCase());
}

/**
 * Runs ESLint on the supplied source code and returns a normalised array of
 * findings.
 *
 * Syntax errors (parse failures) are caught and returned as a single finding
 * rather than propagating an exception.
 *
 * @param {string} code     - Source code to lint.
 * @param {string} filename - File path / name (used only for context, not for
 *                            TS parsing – the browser linter only supports JS).
 * @returns {Array<{line: number, ruleId: string|null, message: string, severity: number}>}
 *          severity: 1 = warning, 2 = error (ESLint convention).
 */
export function runESLint(code, filename) {
  let linter;
  try {
    linter = getLinter();
  } catch (initErr) {
    console.error('[eslint-runner] Failed to initialise linter:', initErr);
    return [
      {
        line: 1,
        ruleId: null,
        message: `ESLint unavailable: ${initErr.message}`,
        severity: 2,
      },
    ];
  }

  let messages;
  try {
    messages = linter.verify(code, ESLINT_CONFIG, { filename });
  } catch (verifyErr) {
    // Unexpected internal error from the linter itself
    console.error(`[eslint-runner] Unexpected linter error in ${filename}:`, verifyErr);
    return [
      {
        line: 1,
        ruleId: null,
        message: `ESLint internal error: ${verifyErr.message}`,
        severity: 2,
      },
    ];
  }

  // ESLint reports parse errors as messages with ruleId === null and a fatal
  // flag. We keep them as-is; callers can detect them via ruleId === null.
  return messages.map(({ line, ruleId, message, severity }) => ({
    line,
    ruleId: ruleId ?? null,
    message,
    severity,
  }));
}
