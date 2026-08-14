import { isValidGithubRepoUrl } from './validate.js';
import {
  fetchRepoTree,
  filterSupportedFiles,
  fetchAllFileContents,
  detectProjectType,
} from './github.js';
import { isLintableFile, runESLint } from './eslint-runner.js';
import { parseToAST } from './ast-utils.js';

const form = document.getElementById('repo-form');
const input = document.getElementById('repo-url');
const submitBtn = document.getElementById('submit-btn');
const errorEl = document.getElementById('url-error');

// ── Helpers ────────────────────────────────────────────────────────────────

function showError(message) {
  errorEl.textContent = message;
  input.classList.add('border-red-500');
  input.classList.remove('border-gray-300');
}

function clearError() {
  errorEl.textContent = '';
  input.classList.remove('border-red-500');
  input.classList.add('border-gray-300');
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Reviewing…' : 'Review Repo';
}

// ── Submit handler ─────────────────────────────────────────────────────────

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const { valid, owner, repo } = isValidGithubRepoUrl(input.value);

  if (!valid) {
    showError('Enter a valid GitHub repository URL');
    return;
  }

  clearError();
  setLoading(true);

  try {
    const tree = await fetchRepoTree(owner, repo);
    const supported = filterSupportedFiles(tree);
    console.log(
      `Filtered ${tree.length} entries down to ${supported.length} supported files`
    );

    const fileEntries = await fetchAllFileContents(owner, repo, supported);
    const projectType = detectProjectType(fileEntries);

    console.log(`Project type: ${projectType}`);
    console.log(
      `Successfully fetched content for ${fileEntries.length} / ${supported.length} files`
    );

    // ── ESLint pass ──────────────────────────────────────────────────────────
    // Only lint JS/TS files; skip .html, .css, .json.
    const lintResults = fileEntries
      .filter((f) => isLintableFile(f.path))
      .map((f) => ({
        path: f.path,
        findings: runESLint(f.content, f.path),
      }));

    const totalFindings = lintResults.reduce(
      (sum, r) => sum + r.findings.length,
      0
    );

    console.log(
      `ESLint: ${totalFindings} finding(s) across ${lintResults.length} linted file(s)`
    );
    console.log(lintResults);

    // ── AST parse pass ─────────────────────────────────────────────────────
    // Attempt to parse every lintable file into an AST. Files that fail
    // (e.g. non-standard syntax, JSX without a transform) get ast === null.
    // Structural analysis (long functions, deep nesting) is issue #6.
    const lintableEntries = fileEntries.filter((f) => isLintableFile(f.path));
    const astResults = lintableEntries.map((f) => ({
      path: f.path,
      ast: parseToAST(f.content),
    }));

    const parsedCount = astResults.filter((r) => r.ast !== null).length;
    const failedCount = astResults.length - parsedCount;

    console.log(
      `AST: ${parsedCount} / ${astResults.length} file(s) parsed successfully` +
        (failedCount > 0 ? ` (${failedCount} failed)` : '')
    );

    // TODO (next issue): run structural-analysis rules on astResults
    // TODO (next issue): send to review pipeline / render results
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

// ── Clear error on input ───────────────────────────────────────────────────

input.addEventListener('input', () => {
  if (errorEl.textContent) {
    clearError();
  }
});
