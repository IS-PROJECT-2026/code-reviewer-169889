import { isValidGithubRepoUrl } from './validate.js';
import { fetchRepoTree } from './github.js';

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
    // TODO (next issue): filter files and fetch contents
    console.log(`Fetched tree for ${owner}/${repo} — ${tree.length} entries`);
    console.log(tree);
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
