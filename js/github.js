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
    throw new Error('Repository not found. If this is a private repo, RepoReview can only analyze public repositories.');
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

    // 2. Skip excluded directories and lockfiles
    if (EXCLUDED_PREFIX_RE.test(entry.path)) return false;
    
    const basename = entry.path.split('/').at(-1);
    if (basename.endsWith('-lock.json') || basename.endsWith('.lock') || basename === 'pnpm-lock.yaml') return false;

    // 3. Check extension or special filename
    const dotIndex = basename.lastIndexOf('.');
    const ext = dotIndex !== -1 ? basename.slice(dotIndex) : '';

    return SUPPORTED_EXTENSIONS.has(ext) || basename === 'package.json';
  });
}

/**
 * Fetches the decoded UTF-8 content of a single file via the GitHub Contents API.
 *
 * Returns null if the file is not found (404) so a missing file doesn't abort
 * the whole batch.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} filePath - Relative path within the repo (e.g. "src/index.js").
 * @returns {Promise<string|null>}
 */
export async function fetchFileContents(owner, repo, filePath) {
  const BASE = 'https://api.github.com';
  const url = `${BASE}/repos/${owner}/${repo}/contents/${filePath}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
    });
  } catch {
    throw new Error('Network error. Check your connection and try again.');
  }

  if (response.status === 404) {
    return null; // Missing file — skip gracefully
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    if (body.message && body.message.toLowerCase().includes('rate limit')) {
      throw new Error('GitHub API rate limit exceeded. Try again later.');
    }
    throw new Error(`GitHub API error: ${body.message ?? 'Forbidden'}`);
  }

  if (!response.ok) {
    throw new Error(
      `Unexpected error fetching ${filePath} (HTTP ${response.status}).`
    );
  }

  const data = await response.json();

  // GitHub returns content as base64 with newlines — strip them before decoding
  if (data.encoding === 'base64') {
    const cleaned = data.content.replace(/\n/g, '');
    return atob(cleaned);
  }

  // Fallback: content delivered as plain UTF-8 string
  return data.content ?? null;
}

/**
 * Fetches the content of every entry in filteredEntries in small batches,
 * returning only the files that were successfully retrieved.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {Array<{path: string}>} filteredEntries - Output of filterSupportedFiles.
 * @param {number} [batchSize=5] - Number of concurrent requests per batch.
 * @returns {Promise<Array<{path: string, content: string}>>}
 */
export async function fetchAllFileContents(
  owner,
  repo,
  filteredEntries,
  batchSize = 5
) {
  const results = [];
  let rateLimitHit = false;

  for (let i = 0; i < filteredEntries.length; i += batchSize) {
    if (rateLimitHit) break;

    const batch = filteredEntries.slice(i, i + batchSize);

    const settled = await Promise.allSettled(
      batch.map(async (entry) => {
        const content = await fetchFileContents(owner, repo, entry.path);
        return content !== null ? { path: entry.path, content } : null;
      })
    );

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value !== null) results.push(outcome.value);
      } else {
        rateLimitHit = true;
      }
    }
  }

  return { fileEntries: results, rateLimitHit, totalAttempted: filteredEntries.length };
}

/**
 * Detects the primary project type from the fetched file entries.
 *
 * Strategy:
 *  1. Find "package.json" among the results.
 *  2. If absent → "Static HTML/CSS/JS".
 *  3. If present, scan dependencies + devDependencies for known framework signals.
 *  4. Fall back to "Node.js" when package.json exists but no framework matched.
 *
 * @param {Array<{path: string, content: string}>} fileEntries
 * @returns {string} A human-readable project-type label.
 */
export function detectProjectType(fileEntries) {
  // Use the root-level package.json only (path === 'package.json')
  const pkgEntry = fileEntries.find((f) => f.path === 'package.json');

  if (!pkgEntry) {
    return 'Static HTML/CSS/JS';
  }

  let pkg;
  try {
    pkg = JSON.parse(pkgEntry.content);
  } catch {
    // Malformed package.json — treat as plain Node
    return 'Node.js';
  }

  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  // Order matters: more specific frameworks first
  const FRAMEWORK_SIGNALS = [
    { keys: ['next', 'next.js'], label: 'Next.js' },
    { keys: ['nuxt', 'nuxt.js'], label: 'Nuxt.js' },
    { keys: ['react', 'react-dom'], label: 'React' },
    { keys: ['vue'], label: 'Vue' },
    { keys: ['@angular/core'], label: 'Angular' },
    { keys: ['svelte'], label: 'Svelte' },
    { keys: ['express'], label: 'Express' },
    { keys: ['fastify'], label: 'Fastify' },
    { keys: ['koa'], label: 'Koa' },
    { keys: ['hapi', '@hapi/hapi'], label: 'Hapi' },
  ];

  for (const { keys, label } of FRAMEWORK_SIGNALS) {
    if (keys.some((k) => k in deps)) {
      return label;
    }
  }

  return 'Node.js';
}
