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

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str 
 * @returns {string}
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders the list of findings into the UI.
 * @param {Array} normalizedFindings 
 */
export function renderFindingsList(normalizedFindings) {
  const container = document.getElementById('findings-list');
  if (!container) return;

  // Clear existing
  container.innerHTML = '';

  if (!normalizedFindings || normalizedFindings.length === 0) {
    container.innerHTML = `
      <div class="bg-green-50 border border-green-100 rounded-xl p-8 text-center">
        <i data-lucide="check-circle-2" class="w-12 h-12 text-green-500 mx-auto mb-3"></i>
        <h4 class="text-lg font-bold text-green-800 mb-1">No issues found</h4>
        <p class="text-green-600 text-sm">Great job! The codebase looks clean and secure.</p>
      </div>
    `;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  const severityOrder = { 'Critical': 1, 'High': 2, 'Medium': 3, 'Low': 4 };
  const sortedFindings = [...normalizedFindings].sort((a, b) => {
    return (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5);
  });

  const SEVERITY_STYLES = {
    'Critical': { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-700', icon: 'text-red-500', lucide: 'alert-octagon' },
    'High': { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', icon: 'text-orange-500', lucide: 'alert-triangle' },
    'Medium': { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-700', icon: 'text-yellow-500', lucide: 'alert-circle' },
    'Low': { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: 'text-blue-500', lucide: 'info' }
  };

  sortedFindings.forEach(finding => {
    const style = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES['Low'];
    
    const card = document.createElement('div');
    card.className = 'bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 transition hover:-translate-y-0.5 hover:shadow-md duration-300';
    
    // Safely escape external strings to prevent XSS attacks from parsed source code
    const safeSeverity = escapeHTML(finding.severity);
    const safeCategory = escapeHTML(finding.category);
    const safeFile = escapeHTML(finding.file);
    const safeMessage = escapeHTML(finding.message);
    const safeRecommendation = escapeHTML(finding.recommendation || 'Review this issue and refactor.');

    card.innerHTML = `
      <div class="flex-shrink-0">
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.border} ${style.text}">
          <i data-lucide="${style.lucide}" class="w-3.5 h-3.5 ${style.icon}"></i>
          ${safeSeverity}
        </div>
      </div>
      <div class="flex-grow">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">${safeCategory}</span>
          <span class="text-gray-300">•</span>
          <span class="font-mono text-sm text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">${safeFile}:${finding.line}</span>
        </div>
        <p class="text-gray-800 text-sm mb-3 font-medium">${safeMessage}</p>
        <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p class="text-gray-600 text-sm flex items-start gap-2">
            <i data-lucide="lightbulb" class="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0"></i>
            <span>${safeRecommendation}</span>
          </p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}
