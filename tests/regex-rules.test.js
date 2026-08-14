/**
 * Tests for js/regex-rules.js
 *
 * Run with: node tests/regex-rules.test.js
 *
 * Uses Node's built-in assert module — no test framework required.
 * Each test calls assert.ok / assert.strictEqual and logs PASS / FAIL.
 */

import assert from 'node:assert/strict';
import { ruleHardcodedSecrets, ruleTodoComments, ruleDebugStatements, runRegexRules } from '../js/regex-rules.js';

// ── Mini test harness ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns findings for a single-line snippet. */
function findingsFor(fn, line) {
  return fn(line);
}

/** Asserts at least one finding with the given ruleId exists in results. */
function assertFinds(findings, ruleId, description) {
  const match = findings.some((f) => f.ruleId === ruleId);
  assert.ok(match, `Expected a "${ruleId}" finding for: ${description}`);
}

/** Asserts NO finding with the given ruleId exists in results. */
function assertNoFind(findings, ruleId, description) {
  const match = findings.some((f) => f.ruleId === ruleId);
  assert.ok(!match, `Did NOT expect a "${ruleId}" finding for: ${description}`);
}

// ── ruleHardcodedSecrets ──────────────────────────────────────────────────────

section('ruleHardcodedSecrets — positive cases');

test('JS: apiKey assignment with double quotes', () => {
  const findings = ruleHardcodedSecrets(`const apiKey = "sk-example-secret123";`);
  assertFinds(findings, 'hardcoded-secret', 'apiKey double-quote');
});

test('JS: api_key with single quotes', () => {
  const findings = ruleHardcodedSecrets(`const api_key = 'live_abcdefghij';`);
  assertFinds(findings, 'hardcoded-secret', 'api_key single-quote');
});

test('JS: password assignment', () => {
  const findings = ruleHardcodedSecrets(`const password = "super-secret";`);
  assertFinds(findings, 'hardcoded-secret', 'password assignment');
});

test('JS: token assignment', () => {
  const findings = ruleHardcodedSecrets(`const token = "ghp_abcdefghijklmno";`);
  assertFinds(findings, 'hardcoded-secret', 'token assignment');
});

test('JS: secret assignment', () => {
  const findings = ruleHardcodedSecrets(`const secret = "s3cr3tV@lue!";`);
  assertFinds(findings, 'hardcoded-secret', 'secret assignment');
});

test('TS: typed apiKey const', () => {
  const findings = ruleHardcodedSecrets(`const apiKey: string = "sk-realvalue12345";`);
  assertFinds(findings, 'hardcoded-secret', 'typed TS apiKey');
});

test('JSON: password field', () => {
  const findings = ruleHardcodedSecrets(`  "password": "hunter2abc"`);
  assertFinds(findings, 'hardcoded-secret', 'JSON password field');
});

test('Any file: PEM private key header', () => {
  const findings = ruleHardcodedSecrets(`-----BEGIN RSA PRIVATE KEY-----`);
  assertFinds(findings, 'hardcoded-secret', 'PEM header');
});

test('severity is 2 (error) for secrets', () => {
  const findings = ruleHardcodedSecrets(`const apiKey = "sk-example-secret123";`);
  assert.strictEqual(findings[0].severity, 2, 'severity should be 2');
});

test('line number is correct (multi-line)', () => {
  const code = `// normal\nconst x = 1;\nconst apiKey = "sk-realvalue99999";\n`;
  const findings = ruleHardcodedSecrets(code);
  assert.strictEqual(findings[0].line, 3, 'line should be 3');
});

section('ruleHardcodedSecrets — negative cases (no false positives)');

test('placeholder: "your-api-key"', () => {
  const findings = ruleHardcodedSecrets(`const apiKey = "your-api-key";`);
  assertNoFind(findings, 'hardcoded-secret', 'placeholder your-api-key');
});

test('placeholder: "xxxxxxxxxxxx"', () => {
  const findings = ruleHardcodedSecrets(`const apiKey = "xxxxxxxxxxxx";`);
  assertNoFind(findings, 'hardcoded-secret', 'placeholder xxxx');
});

test('empty password string', () => {
  const findings = ruleHardcodedSecrets(`const password = "";`);
  assertNoFind(findings, 'hardcoded-secret', 'empty password');
});

test('CSS colour name containing "key" word in property', () => {
  const findings = ruleHardcodedSecrets(`.monkey-key { color: #abc; }`);
  assertNoFind(findings, 'hardcoded-secret', 'CSS colour class name');
});

test('comment mentioning password generically', () => {
  const findings = ruleHardcodedSecrets(`// prompt user for password`);
  assertNoFind(findings, 'hardcoded-secret', 'comment about password');
});

// ── ruleTodoComments ──────────────────────────────────────────────────────────

section('ruleTodoComments — positive cases');

test('JS: // TODO comment', () => {
  assertFinds(ruleTodoComments(`// TODO: fix this`), 'todo-comment', '// TODO');
});

test('JS: // FIXME comment', () => {
  assertFinds(ruleTodoComments(`// FIXME: handle this properly`), 'todo-comment', '// FIXME');
});

test('JS: /* TODO */ block comment', () => {
  assertFinds(ruleTodoComments(`/* TODO: refactor */`), 'todo-comment', '/* TODO */');
});

test('HTML: <!-- TODO --> comment', () => {
  assertFinds(ruleTodoComments(`<!-- TODO: update this section -->`), 'todo-comment', 'HTML TODO');
});

test('CSS: /* FIXME */ comment', () => {
  assertFinds(ruleTodoComments(`/* FIXME: remove hack */`), 'todo-comment', 'CSS FIXME');
});

test('TS/TSX: // TODO inside component file', () => {
  assertFinds(ruleTodoComments(`  // TODO: add error boundary`), 'todo-comment', 'TSX TODO');
});

test('severity is 1 (warning) for TODOs', () => {
  const findings = ruleTodoComments(`// TODO: fix this`);
  assert.strictEqual(findings[0].severity, 1, 'severity should be 1');
});

test('line number is reported correctly', () => {
  const code = `const x = 1;\n// TODO: fix this\n`;
  const findings = ruleTodoComments(code);
  assert.strictEqual(findings[0].line, 2, 'line should be 2');
});

section('ruleTodoComments — negative cases');

test('TODO inside a string literal is not flagged', () => {
  // Regex-based check: we only flag comment-like prefixes, not strings.
  // A plain string like `"TODO"` without // or /* won't match.
  assertNoFind(ruleTodoComments(`const msg = "TODO later";`), 'todo-comment', 'TODO in string');
});

test('Word "todo" as an identifier is not flagged', () => {
  assertNoFind(ruleTodoComments(`const todoList = [];`), 'todo-comment', 'todo identifier');
});

// ── ruleDebugStatements ───────────────────────────────────────────────────────

section('ruleDebugStatements — positive cases');

test('JS: console.log call', () => {
  assertFinds(ruleDebugStatements(`console.log("debug");`), 'debug-statement', 'console.log');
});

test('JS: debugger statement', () => {
  assertFinds(ruleDebugStatements(`debugger;`), 'debug-statement', 'debugger');
});

test('TSX: console.log inside component', () => {
  assertFinds(ruleDebugStatements(`  console.log(data);`), 'debug-statement', 'TSX console.log');
});

test('severity is 1 (warning) for debug statements', () => {
  const findings = ruleDebugStatements(`console.log("x");`);
  assert.strictEqual(findings[0].severity, 1, 'severity should be 1');
});

test('line number is reported correctly', () => {
  const code = `function foo() {\n  console.log("hi");\n}\n`;
  const findings = ruleDebugStatements(code);
  assert.strictEqual(findings[0].line, 2, 'line should be 2');
});

section('ruleDebugStatements — negative cases');

test('console.error is NOT flagged', () => {
  assertNoFind(ruleDebugStatements(`console.error("oops");`), 'debug-statement', 'console.error');
});

test('console.warn is NOT flagged', () => {
  assertNoFind(ruleDebugStatements(`console.warn("heads up");`), 'debug-statement', 'console.warn');
});

test('console.info is NOT flagged', () => {
  assertNoFind(ruleDebugStatements(`console.info("ready");`), 'debug-statement', 'console.info');
});

test('"debugger" inside a string is NOT flagged', () => {
  // The regex requires end-of-line after "debugger", so "debugger" in a string
  // followed by more chars won't match.
  assertNoFind(ruleDebugStatements(`const msg = "debugger mode";`), 'debug-statement', 'debugger in string');
});

// ── runRegexRules (composite) ─────────────────────────────────────────────────

section('runRegexRules — composite runner');

test('returns merged findings sorted by line', () => {
  const code = [
    `// TODO: fix`,           // line 1 → todo-comment
    `const x = 1;`,           // line 2 → clean
    `console.log("hi");`,     // line 3 → debug-statement
    `const apiKey = "sk-realvalue99999";`, // line 4 → hardcoded-secret
  ].join('\n');

  const findings = runRegexRules(code, 'example.js');
  assert.ok(findings.length >= 3, 'should have at least 3 findings');

  // Verify sort order
  for (let i = 1; i < findings.length; i++) {
    assert.ok(
      findings[i].line >= findings[i - 1].line,
      `findings should be sorted by line (got ${findings[i-1].line} before ${findings[i].line})`
    );
  }
});

test('runs on .html content', () => {
  const html = `<html>\n<!-- TODO: update -->\n<script>\nconsole.log("x");\n</script>\n</html>`;
  const findings = runRegexRules(html, 'index.html');
  assert.ok(findings.some((f) => f.ruleId === 'todo-comment'), 'HTML TODO found');
  assert.ok(findings.some((f) => f.ruleId === 'debug-statement'), 'HTML console.log found');
});

test('runs on .css content', () => {
  const css = `/* FIXME: remove hack */\n.foo { color: red; }`;
  const findings = runRegexRules(css, 'style.css');
  assert.ok(findings.some((f) => f.ruleId === 'todo-comment'), 'CSS FIXME found');
});

test('runs on .json content', () => {
  const json = `{\n  "password": "hunter2abc"\n}`;
  const findings = runRegexRules(json, 'config.json');
  assert.ok(findings.some((f) => f.ruleId === 'hardcoded-secret'), 'JSON secret found');
});

test('clean file returns empty array', () => {
  const code = `const x = 1;\nfunction add(a, b) { return a + b; }\n`;
  const findings = runRegexRules(code, 'clean.js');
  assert.strictEqual(findings.length, 0, 'clean file should have no findings');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
