/**
 * Fetches the full recursive file tree for a GitHub repository.
 *
 * Steps:
 *  1. GET /repos/{owner}/{repo}  → confirm existence, read default_branch
 *  2. GET /repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1
 *
 * @param {string} owner - GitHub username or organisation.
 * @param {string} repo  - Repository name.
 * @returns {Promise<Array>} Resolves with the array of tree entry objects.
 * @throws {Error} With a user-facing message for 404, rate-limit, or network failures.
 */
export async function fetchRepoTree(owner, repo) {
  const BASE = 'https://api.github.com';

  //  1. Confirm repo exists and get default branch 
  let repoResponse;
  try {
    repoResponse = await fetch(`${BASE}/repos/${owner}/${repo}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  if (repoResponse.status === 404) {
    throw new Error('Repository not found.');
  }

  if (repoResponse.status === 403) {
    const body = await repoResponse.json().catch(() => ({}));
    if (body.message && body.message.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded. Try again later.');
    }
    throw new Error(`GitHub API error: ${body.message ?? 'Forbidden'}`);
  }

  if (!repoResponse.ok) {
    throw new Error(`Unexpected error fetching repository (HTTP ${repoResponse.status}).`);
  }

  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch;

  //  2. Fetch the full recursive tree 
  let treeResponse;
  try {
    treeResponse = await fetch(
      `${BASE}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  if (treeResponse.status === 403) {
    const body = await treeResponse.json().catch(() => ({}));
    if (body.message && body.message.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded. Try again later.');
    }
    throw new Error(`GitHub API error: ${body.message ?? 'Forbidden'}`);
  }

  if (!treeResponse.ok) {
    throw new Error(`Unexpected error fetching file tree (HTTP ${treeResponse.status}).`);
  }

  const treeData = await treeResponse.json();
  return treeData.tree; // Array of { path, type, sha, url, size? }
}

/**
 * Filters a raw GitHub tree array down to reviewable source files.
 *
 * Rules applied (in order):
 *  1. Keep only blob entries (skip trees / submodules).
 *  2. Exclude paths inside node_modules/, dist/, build/, or .git/.
 *  3. Keep files whose extension is one of the supported set, OR whose
 *     basename is exactly "package.json".
 *
 * @param {Array<{path: string, type: string, sha: string}>} treeEntries
 * @returns {Array} Filtered subset of the input array.
 */
export function filterSupportedFiles(treeEntries) {
  const SUPPORTED_EXTENSIONS = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.json',
  ]);

  // Segments that mark dependency / build / vcs output — match at any level
  const EXCLUDED_DIRS = ['node_modules', 'dist', 'build', '.git'];
  const EXCLUDED_PREFIX_RE = new RegExp(
    `(^|/)(?:${EXCLUDED_DIRS.map((d) => d.replace('.', '\\.')).join('|')})/`
  );

  return treeEntries.filter((entry) => {
    // 1. Blobs only
    if (entry.type !== 'blob') return false;

    // 2. Skip excluded directories
    if (EXCLUDED_PREFIX_RE.test(entry.path)) return false;

    // 3. Check extension or special filename
    const basename = entry.path.split('/').at(-1);
    const dotIndex = basename.lastIndexOf('.');
    const ext = dotIndex !== -1 ? basename.slice(dotIndex) : '';

    return SUPPORTED_EXTENSIONS.has(ext) || basename === 'package.json';
  });
}
