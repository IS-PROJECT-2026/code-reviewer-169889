# RepoReview — Automated Code Review for Vibe-Coded Projects

RepoReview is a web-based static analysis tool that reviews a public GitHub repository and generates a structured code review report, covering security, code quality, architecture, and AI/vibe-coding patterns.

It's aimed at the growing number of projects built rapidly with AI coding tools, where working code often ships without a thorough human review. RepoReview surfaces potential problems rather than claiming to replace one.


## How It Works

1. Enter a public GitHub repository URL (e.g. `https://github.com/username/project`)
2. RepoReview fetches the repository's file tree and contents through the GitHub REST API
3. Supported files (`.js`, `.ts`, `.jsx`, `.tsx`, `.html`, `.css`, `.json`, `package.json`) are filtered from the full tree, excluding `node_modules/`, `dist/`, `build/`, and lockfiles
4. Each file is run through four independent analysis passes (see below)
5. Findings are merged, mapped to a category and severity, and scored into a report

## What Gets Analyzed

- **Security** — hardcoded credentials and API keys (regex-based detection with placeholder filtering)
- **Code Quality** — unused variables, loose equality, leftover `console.log`/`debugger` statements (via an in-browser ESLint build)
- **Architecture** — overly long functions and deep nesting (via Acorn AST parsing)
- **AI/Vibe-Code Patterns** — leftover TODO/FIXME comments, duplicate code (AST-based function similarity plus line-sequence matching for non-JS files)

**Known gap:** Performance is a defined category in the scoring model but doesn't yet have a dedicated rule generating findings for it, it currently always scores 100. A real Performance rule (e.g. detecting expensive operations or unnecessary re-renders) would be a natural next addition.

Each finding includes severity (Critical/High/Medium/Low), category, file, line number, an explanation, and a suggested fix. Scores are calculated per category and overall, with Critical/High findings applying a flat deduction (so a single leaked secret can't be diluted away in a large repo) and Medium/Low findings scaled by file count.

## Tech Stack

- HTML, CSS, and vanilla JavaScript (ES modules, no framework, runs entirely client-side)
- [Tailwind CSS](https://tailwindcss.com/) (CDN build)
- [Lucide](https://lucide.dev/) icons
- [GitHub REST API](https://docs.github.com/en/rest) for fetching repository contents
- [ESLint](https://www.npmjs.com/package/eslint-linter-browserify) (browser build) for rule-based linting
- [Acorn](https://github.com/acornjs/acorn) for AST parsing, extended with [`acorn-jsx`](https://github.com/acornjs/acorn-jsx) and [`@sveltejs/acorn-typescript`](https://github.com/sveltejs/acorn-typescript) for JSX/TSX support

## Running Locally

Since RepoReview is a static site with no build step, you can run it directly:

```bash
git clone https://github.com/IS-PROJECT-2026/repo-reviewer-169889.git
cd repo-reviewer-169889
```

Then open `index.html` in your browser, or serve it locally with any static server:

```bash
npx serve .
```

## Limitations

- Only analyzes public repositories (GitHub's unauthenticated API rate limit is 60 requests/hour, which is spent quickly on large repos since each file fetch is a separate request)
- Supports JavaScript, TypeScript, JSX, TSX, HTML, CSS, and JSON in this version
- AST-based structural analysis (long functions, deep nesting) may not run on some `.jsx`/`.tsx` files due to limitations in the third-party TypeScript AST parser plugin; ESLint-based findings are unaffected since ESLint's browser build handles JSX independently
- Static analysis only, no live code execution or dynamic testing
- No Performance-category rules yet (see above)

