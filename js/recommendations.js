/**
 * @module recommendations
 * Provides suggested fixes and actionable advice for each rule violation.
 */

export const RECOMMENDATIONS = {
  'hardcoded-secret': 'Use environment variables and ensure secrets are not committed to the repository.',
  'no-unused-vars': 'Remove unused variables to keep the codebase clean and avoid confusion.',
  'no-undef': 'Ensure all variables and functions are defined before use, or properly imported.',
  'eqeqeq': 'Use strict equality (=== and !==) to prevent unexpected type coercion.',
  'no-console': 'Remove or replace console statements with a proper logging framework for production.',
  'no-debugger': 'Remove debugger statements before committing code.',
  'long-function': 'Refactor this function into smaller, more focused helper functions to improve readability and maintainability.',
  'deep-nesting': 'Extract deeply nested logic into separate functions or use early returns to flatten the structure.',
  'todo-comment': 'Resolve this TODO or track it formally in an issue tracker.',
  'debug-statement': 'Remove leftover debug statements or switch to a proper logging framework.',
  'duplicate-code': 'Extract this duplicated logic into a shared reusable function or component.'
};

/**
 * Gets a recommendation string for a given rule ID.
 * @param {string} ruleId 
 * @returns {string} The recommendation, or a generic fallback.
 */
export function getRecommendation(ruleId) {
  return RECOMMENDATIONS[ruleId] || 'Review this issue and refactor the code according to project best practices.';
}
