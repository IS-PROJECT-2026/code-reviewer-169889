/**
 * Validates whether a given string is a well-formed GitHub repository URL.
 *
 * Accepted formats:
 *   https://github.com/{owner}/{repo}
 *   https://github.com/{owner}/{repo}/
 *   https://github.com/{owner}/{repo}.git
 *   https://github.com/{owner}/{repo}.git/
 *
 * @param {string} url - The URL string to validate.
 * @returns {{ valid: boolean, owner: string|null, repo: string|null }}
 */
export function isValidGithubRepoUrl(url) {
  const trimmed = url.trim();

  // owner / repo segments: alphanumerics, hyphens, underscores, dots
  const pattern =
    /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(\.git)?\/?$/;

  const match = trimmed.match(pattern);

  if (!match) {
    return { valid: false, owner: null, repo: null };
  }

  return { valid: true, owner: match[1], repo: match[2] };
}
