import { isValidGithubRepoUrl } from './validate.js';
import {
  fetchRepoTree,
  filterSupportedFiles,
  fetchAllFileContents,
  detectProjectType,
} from './github.js';

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

    // TODO (next issue): send to review pipeline / render results
    console.log(`Project type: ${projectType}`);
    console.log(
      `Successfully fetched content for ${fileEntries.length} / ${supported.length} files`
    );
    console.log(fileEntries);
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
