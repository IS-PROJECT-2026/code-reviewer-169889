/**
 * @module dashboard
 */

/**
 * Returns the color classes for text/gradient based on the score.
 * @param {number} score 
 * @returns {string[]} Array of Tailwind classes to apply
 */
function getScoreColorClasses(score) {
  if (score >= 80) return ['from-green-500', 'to-green-700'];
  if (score >= 50) return ['from-amber-500', 'to-amber-700'];
  return ['from-red-500', 'to-red-700'];
}

/**
 * Returns the color class for the progress bar based on the score.
 * @param {number} score 
 * @returns {string} Tailwind class for background color
 */
function getBarColorClass(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

/**
 * Returns the text color class for icons based on the score.
 * @param {number} score 
 * @returns {string} Tailwind class for text color
 */
function getIconColorClass(score) {
  if (score >= 80) return 'text-green-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

/**
 * Updates a specific category card in the UI.
 * @param {string} idPrefix - The suffix for the DOM IDs (e.g. 'security')
 * @param {number} score - The 0-100 score for this category
 */
function updateCategory(idPrefix, score) {
  const scoreEl = document.getElementById(`score-${idPrefix}`);
  const barEl = document.getElementById(`bar-${idPrefix}`);
  
  if (!scoreEl || !barEl) return;

  scoreEl.textContent = score;
  
  // Set bar width (animate in)
  setTimeout(() => {
    barEl.style.width = `${score}%`;
  }, 100); // Small delay to allow CSS transition after unhiding
  
  // Update bar color
  barEl.classList.remove('bg-gray-400', 'bg-green-500', 'bg-amber-500', 'bg-red-500');
  barEl.classList.add(getBarColorClass(score));

  // Update icon color
  const iconEl = document.getElementById(`icon-${idPrefix}`);
  if (iconEl) {
    iconEl.classList.remove('text-gray-400', 'text-green-500', 'text-amber-500', 'text-red-500');
    iconEl.classList.add(getIconColorClass(score));
  }
}

/**
 * Renders the score dashboard with the given results.
 * 
 * @param {Object} scoreResult - The object returned by calculateScores
 * @param {string} repoName - e.g. "owner/repo"
 */
export function renderDashboard(scoreResult, repoName) {
  const dashboard = document.getElementById('dashboard-section');
  
  // 1. Show the dashboard
  dashboard.classList.remove('hidden');

  // 2. Set Repo Name
  const repoDisplay = document.querySelector('#repo-name-display span');
  if (repoDisplay) repoDisplay.textContent = repoName;

  // 3. Set Overall Score and color it
  const overallEl = document.getElementById('overall-score');
  if (overallEl) {
    overallEl.textContent = scoreResult.overall;
    // Remove default gradient colors
    overallEl.classList.remove('from-gray-700', 'to-gray-900');
    // Add dynamic colors
    overallEl.classList.add(...getScoreColorClasses(scoreResult.overall));
  }

  // 4. Update Severity Counts
  const counts = scoreResult.counts || {};
  const severities = ['critical', 'high', 'medium', 'low', 'passed'];
  for (const sev of severities) {
    const el = document.getElementById(`count-${sev}`);
    if (el) el.textContent = counts[sev] || 0;
  }

  // 5. Update Categories
  const cat = scoreResult.categories || {};
  updateCategory('security', cat.Security || 0);
  updateCategory('codequality', cat.CodeQuality || 0);
  updateCategory('architecture', cat.Architecture || 0);
  updateCategory('aicodesmells', cat.AICodeSmells || 0);
  updateCategory('performance', cat.Performance || 0);

  // 6. Initialize Lucide icons (since they were hidden or might need re-rendering)
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}
