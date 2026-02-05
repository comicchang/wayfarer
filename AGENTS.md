# Repository Guidelines

## Project Structure & Module Organization
- Root-level userscripts: `wayfarer-planner.user.js`, `wayfarer-exporter.user.js`, and `wayfarer-translate.user.js` contain the IITC/TamperMonkey logic.
- Google Apps Script backend: `Code.gs` powers the Google Sheets integration.
- Documentation: `README.md` and `exporter.md` explain usage and setup.
- Assets: `assets/` stores screenshots and diagrams used in docs.

## Build, Test, and Development Commands
- `npm install` installs linting/formatting tooling.
- `npm run validate` runs ESLint (with auto-fix) and Prettier (write + check) on `*.js` files.

There is no build step; scripts are shipped directly as userscripts and Apps Script.

## Coding Style & Naming Conventions
- Indentation follows the existing scripts (2 spaces, no tabs).
- Keep functions and variables descriptive; avoid abbreviations unless already established in the file.
- Prefer single-purpose helpers over long inline blocks, matching the current functional style.
- Formatting and linting are enforced via ESLint + Prettier (`npm run validate`).

## Testing Guidelines
- No automated test suite is present.
- Validate changes by running `npm run validate` and exercising the userscript in IITC and/or Google Apps Script.
- When editing Apps Script (`Code.gs`), follow the deployment steps in `README.md` to publish a new version.

## Commit & Pull Request Guidelines
- Recent commits use short, descriptive messages (e.g., “Adjusted planner messaging”). Keep messages concise and focused on the change.
- For pull requests/merge requests, include:
  - A clear description of behavior changes.
  - Screenshots for UI or map-layer changes (see `CONTRIBUTING.md`).
  - Any setup or deployment notes if Apps Script changes are involved.

## Configuration & Security Tips
- Google Apps Script deployments must be set to “Anyone” access for shared sheets.
- If a browser extension blocks Google domains, ensure `script.google.com` is allowed for proper operation.
