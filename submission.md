# Project Submission Report

## 1. Student Details

- **Full Name:** Jeff Ngao Kyalo
- **GitHub Username:** jeffkyalo21
- **Email:** jjkyali5@gmail.com, jeff.kyalo@strathmore.edu

---

## 2. Deployed Project Link

- **Live GitHub Pages URL:** https://is-project-2026.github.io/repo-reviewer-169889/

---

## 3. Reflection — Grounded in Your Git History

> **Rules:** Every answer below **must include a direct link** to the specific commit, PR, issue, or branch in your repository that demonstrates what you are describing. Answers without working links will not be graded. Generic explanations that could apply to any project will receive zero marks.
>
> **Marks:** A (2 marks) · B (1 mark) · C (1 mark) · D (1 mark) = **5 marks total**

### A. Your Best Commit

- **Commit URL:** https://github.com/IS-PROJECT-2026/repo-reviewer-169889/commit/7f41f38

- **Why this one?** This commit fixes a real bug (ESLint's flat-config format requirement) that broke the analysis engine, with a subject line under 50 characters in imperative voice and a clear, singular purpose, no unrelated changes bundled in.

### B. A Mistake or Struggle

- **Link to the evidence:** https://github.com/IS-PROJECT-2026/repo-reviewer-169889/pull/21

- **What happened and how did you recover?** After adding TypeScript/JSX support to the AST parser via the `@sveltejs/acorn-typescript` plugin, real `.tsx` files (e.g. from `mfts/gauge-demo`) still failed to parse with "Unexpected token" errors right at JSX syntax. My first hypothesis was a module-identity mismatch, two different CDN URLs for `acorn` resolving to separate module instances, so I pinned the exact version. That didn't fix it: the failure was byte-identical to before. Research turned up an open bug in SvelteKit's own issue tracker against this same plugin's JSX handling on real-world TypeScript, confirming it wasn't my usage that was wrong, the plugin's JSX support was genuinely unreliable. The actual fix was combining the dedicated `acorn-jsx` plugin (mature, purpose-built JSX tokenizer) with `tsPlugin` for TypeScript grammar, `Parser.extend(jsx(), tsPlugin())`, so JSX tokenization never routed through the buggy path at all. This resolved all three previously-failing `.tsx` files.

### C. A Pull Request You're Proud Of

- **PR URL:** https://github.com/IS-PROJECT-2026/repo-reviewer-169889/pull/28

- **What did you check before merging?** While reviewing my own diff, I noticed the findings list rendered scanned repositories' file paths, messages, and TODO comment text directly into `innerHTML` without escaping, an XSS risk, since RepoReview processes arbitrary public repos and a malicious comment string could execute as HTML. I added an `escapeHTML()` helper and applied it to every field sourced from scanned code before merging.

### D. One Thing You Would Do Differently

- **What would you change?** I'd settle on one consistent branch-naming scheme (matching branch numbers to real issue numbers) from the very first branch, instead of switching between sequential numbering and issue-matched numbering partway through, which caused confusion when opening later PRs and closing issues.
- **Link to the evidence of the original decision:** https://github.com/IS-PROJECT-2026/repo-reviewer-169889/branches
  
---

## 4. Screenshots of Key GitHub Features

> **CRITICAL FOR WORKING IMAGES:** Edit this file directly on the GitHub web interface, click the blank line below each prompt, and **paste (Ctrl+V / Cmd+V)** your screenshot.

### A. Milestones and Issues


* **Caption:** Repo Fetching & Parsing milestone at 100% complete, showing all linked issues resolved.

### B. Project Board


* **Caption:** Project board showing issues distributed across all three columns, reflecting real task progression.

### C. Branching Architecture


* **Caption:** Branch list showing feat/, fix/, and docs/ prefixed branches with linked PR numbers.

### D. Pull Requests & Traceability


* **Caption:** Merged PR showing direct issue linkage via the Development sidebar.

---

## 5. Merge Conflict Evidence

> **Marks:** Conflict 1 full chronology (2 marks) · Conflict 2 (1 mark) · Conflict 3 (1 mark) · All three use distinct causes (1 mark) = **5 marks total**

---

### Conflict 1 — Full Chronology

**What cause did you use?** Same-line edit — two branches (`feat/16-conflict-demo-a` and `feat/17-conflict-demo-b`), created from the same starting commit, both modified the first line of `README.md` differently.

#### Step 1: Generating the Clash


* **Caption:** Attempting to merge feat/17-conflict-demo-b after feat/16-conflict-demo-a was already merged into main, both branches edited the same README title line.

#### Step 2: Inside the Code Editor (Conflict Markers)


* **Caption:** Raw conflict markers showing both competing versions of the README title line before resolution.

#### Step 3: Resolution & Clean Merge


* **Caption:** Branch graph showing both branches diverging from the same commit and merging cleanly through the resolution commit.

---

### Conflict 2 — Different Cause

**What cause did you use?** Modify/rename conflict — one branch renamed `js/recommendations.js` to `js/advice.js` while modifying its content; another branch modified the same file's original content without renaming it.

**Why does this cause trigger a conflict?** Git tracks the rename as a content change on one side and a separate content change on the other, since both sides diverge from the same base file, Git cannot automatically determine which content belongs in the final (renamed) file, producing `CONFLICT (content): Merge conflict in js/advice.js`.



* **Caption:** Branch A modified recommendations.js directly; Branch B renamed it to advice.js with different content changes, producing a rename/content conflict on merge.

---

### Conflict 3 — Different Cause

**What cause did you use?** Modify/delete conflict — one branch deleted `js/validate.js` entirely; another branch modified the same file's content.

**Why does this cause trigger a conflict?** Git cannot reconcile "this file should no longer exist" with "this file has new changes," since there's no way to automatically merge a deletion with a content edit, producing `CONFLICT (modify/delete): js/validate.js deleted in [branch] and modified in HEAD`.



* **Caption:** Branch A modified validate.js; Branch B deleted it entirely, producing a modify/delete conflict on merge. Resolved by keeping the file, since it's actively used by main.js.

---

## 6. Feedback & Evaluation

- [ ] **Anonymous Evaluation Form:** [Course & Instructor Evaluation](https://forms.gle/YLybnsyXXErKEg3s9)

---

