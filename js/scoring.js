/**
 * @module scoring
 */

/**
 * Maps individual rule IDs to the five high-level report categories.
 * ESLint rules and style checks -> CodeQuality
 * Structural rules (long functions, nesting) -> Architecture
 * Hardcoded secrets -> Security
 * Regex rules and duplication -> AICodeSmells
 * (Performance is currently unpopulated by existing rules)
 */
export const CATEGORY_MAP = {
  'hardcoded-secret': 'Security',

  'no-unused-vars': 'CodeQuality',
  'no-undef': 'CodeQuality',
  'eqeqeq': 'CodeQuality',
  'no-console': 'CodeQuality',
  'no-debugger': 'CodeQuality',

  'long-function': 'Architecture',
  'deep-nesting': 'Architecture',

  'todo-comment': 'AICodeSmells',
  'debug-statement': 'AICodeSmells',
  'duplicate-code': 'AICodeSmells',
};

/**
 * Maps existing numeric severity (1, 2) and rule IDs into the 4-tier
 * spec system: Critical, High, Medium, Low.
 * 
 * Design reasoning:
 * - Critical: Security issues (e.g. hardcoded secrets) are an immediate risk and must be flagged as Critical.
 * - High: Other severity-2 (error) findings indicate significant logic or structural problems.
 * - Medium: Severity-1 (warning) findings (e.g. TODOs, code style, unused vars) are technical debt but not fatal.
 * - Low: Reserved for informational findings (none currently emit this level).
 */
export const SEVERITY_LABELS = {
  2: 'High',
  1: 'Medium',
};

/**
 * Gets the string severity label for a finding.
 * Overrides mapping for critical security issues.
 * 
 * @param {string} ruleId
 * @param {number} severity
 * @returns {string}
 */
export function getSeverityLabel(ruleId, severity) {
  if (ruleId === 'hardcoded-secret') {
    return 'Critical';
  }
  return SEVERITY_LABELS[severity] || 'Low';
}

/**
 * Normalizes and flattens the result arrays from different rule engines into a single array.
 * 
 * @param {Array<{path: string, findings: Array}>} allResults - The combined output of all rule engines
 * @returns {Array<{file: string, line: number, ruleId: string, category: string, severity: string, message: string}>}
 */
export function normalizeFindings(allResults) {
  const normalized = [];

  for (const fileResult of allResults) {
    for (const finding of fileResult.findings) {
      // Provide fallback in case a ruleId is missing from CATEGORY_MAP
      const category = CATEGORY_MAP[finding.ruleId] || 'CodeQuality';
      const severityLabel = getSeverityLabel(finding.ruleId, finding.severity);

      normalized.push({
        file: fileResult.path,
        line: finding.line || 1, // Fallback to 1 if missing
        ruleId: finding.ruleId,
        category: category,
        severity: severityLabel,
        message: finding.message,
      });
    }
  }

  return normalized;
}

/**
 * Calculates a 0-100 score for each category and an overall score.
 * 
 * Scoring Formula (Hybrid Scaling):
 * - We start with a base score of 100 for each category.
 * - Deductions are split by severity tier before combining:
 *   - Critical and High findings are treated as absolute risks. They apply a flat deduction 
 *     (-20 and -10 respectively) regardless of project size.
 *   - Medium and Low findings are treated as tech debt density. They apply a scaled deduction 
 *     (-5 and -1 respectively) divided by the total number of files analyzed.
 * - The score is floored at 0.
 * - The Overall score is a simple average of the 5 category scores.
 * 
 * This mirrors how real static-analysis tools (e.g., SonarQube, Snyk) weight severity 
 * as absolute (vulnerabilities) rather than density-scaled (code smells).
 * 
 * Note on Performance: The current ruleset has no performance rules. 
 * Real performance analysis is a known gap to be addressed in the future.
 * 
 * @param {Array} normalizedFindings
 * @param {number} totalFilesAnalyzed
 * @returns {Object} Score object matching the assignment spec.
 */
export function calculateScores(normalizedFindings, totalFilesAnalyzed) {
  const categories = {
    Security: { score: 100, counts: { critical: 0, high: 0, medium: 0, low: 0 } },
    CodeQuality: { score: 100, counts: { critical: 0, high: 0, medium: 0, low: 0 } },
    Performance: { score: 100, counts: { critical: 0, high: 0, medium: 0, low: 0 } },
    Architecture: { score: 100, counts: { critical: 0, high: 0, medium: 0, low: 0 } },
    AICodeSmells: { score: 100, counts: { critical: 0, high: 0, medium: 0, low: 0 } },
  };

  const globalCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    passed: 0,
  };

  // Tally counts
  for (const finding of normalizedFindings) {
    const sev = finding.severity.toLowerCase();
    
    // Increment global severity count
    if (globalCounts[sev] !== undefined) {
      globalCounts[sev]++;
    }

    // Increment category-specific severity count
    const cat = categories[finding.category];
    if (cat && cat.counts[sev] !== undefined) {
      cat.counts[sev]++;
    }
  }

  // Passed could represent files with 0 findings
  const filesWithFindings = new Set(normalizedFindings.map(f => f.file));
  globalCounts.passed = Math.max(0, totalFilesAnalyzed - filesWithFindings.size);

  // Finalize category scores
  let totalScore = 0;
  const numCategories = Object.keys(categories).length;

  for (const key of Object.keys(categories)) {
    const cat = categories[key];
    
    const flatDeduction = (cat.counts.critical * 20) + (cat.counts.high * 10);
    const scaledDeduction = (cat.counts.medium * 5 + cat.counts.low * 1) / Math.max(1, totalFilesAnalyzed);
    
    const rawScore = 100 - flatDeduction - scaledDeduction;
    cat.score = Math.max(0, Math.round(rawScore)); // Cap at 0
    totalScore += cat.score;
  }

  const overall = Math.round(totalScore / numCategories);

  // Remap categories to just return their score value
  const finalCategories = {};
  for (const key of Object.keys(categories)) {
    finalCategories[key] = categories[key].score;
  }

  return {
    overall,
    categories: finalCategories,
    counts: globalCounts,
  };
}
