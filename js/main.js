import { isValidGithubRepoUrl } from './validate.js';

const form = document.getElementById('repo-form');
const input = document.getElementById('repo-url');
const errorEl = document.getElementById('url-error');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const { valid, owner, repo } = isValidGithubRepoUrl(input.value);

  if (!valid) {
    // Show error state
    errorEl.textContent = 'Enter a valid GitHub repository URL';
    input.classList.add('border-red-500');
    input.classList.remove('border-gray-300');
    return;
  }

  // Clear error state
  errorEl.textContent = '';
  input.classList.remove('border-red-500');
  input.classList.add('border-gray-300');

  // TODO (next issue): fetch and analyse the repo
  console.log('Valid repo submitted');
  console.log('  owner:', owner);
  console.log('  repo: ', repo);
});

// Clear error state as soon as the user starts editing again
input.addEventListener('input', () => {
  if (errorEl.textContent) {
    errorEl.textContent = '';
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-300');
  }
});
