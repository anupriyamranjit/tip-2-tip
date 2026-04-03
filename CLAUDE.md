@AGENTS.md

# Project — Claude Instructions

---

## Project Overview

| Layer | Stack |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | Rust (Axum 0.8), SQLx 0.8, PostgreSQL 16 |
| Infra | Docker Compose (3 services: app, backend, db) |

---

## Mandatory Verification After Every Change

After making ANY change, you MUST verify it actually works before telling the user you are done.
Never assume a change is correct — always run a check appropriate to what was changed:

| What changed | How to verify |
|---|---|
| `Dockerfile` or `docker-compose.yml` | Run `docker compose build` and confirm it exits 0. If it fails, fix it and retry until it builds. |
| Backend code | Run `cargo build` AND `cargo test` inside `backend/`. Both must pass. |
| Frontend JS/JSX/TS/TSX | Run `npm run build` and confirm no errors. Then take a screenshot if UI changed. |
| CSS | Take a screenshot and visually confirm the layout matches intent. |
| Any test file | Run the relevant test suite and confirm all tests pass. |

**If verification fails:** Fix the issue immediately. Do not report success until the verification
command exits cleanly. Do not ask the user to run the command themselves — you run it first.

---

## Automatic Commit After Every Completed Task

After every task is fully complete (code written, verified, screenshot taken if UI), you MUST
commit AND push immediately — without waiting to be asked. This is non-negotiable.

### Commit rules
1. Stage only the files changed for this task (never `git add -A` blindly).
2. Write a concise commit message: one summary line + bullet points for notable details.
3. Always append the co-author trailer:
   ```
   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
4. Run `git push` immediately after the commit.
5. Tell the user the short SHA and what was committed so they know it's done.

### What counts as "done"
A task is NOT done until:
- [ ] All code is written and verified (build passes, tests pass, screenshot taken if UI)
- [ ] `git commit` has been run with a proper message
- [ ] `git push` has completed successfully
- [ ] The user has been told the short SHA

**DO NOT describe what you did and then wait — commit first, then tell the user what you did
and show them the SHA.**

---

## Proof of Correctness — Required After Every Task

After every completed task you MUST provide explicit proof that the change works as intended.
"It compiled" is not proof. Show evidence matched to what was changed:

| What changed | Proof required |
|---|---|
| New backend endpoint | Show the test output with all relevant tests passing |
| Frontend UI change | Take a screenshot and annotate what proves the change is correct |
| Bug fix | Show before/after output, or a test that would have failed before and passes now |
| Auth / security change | Show the relevant test names passing |
| Config / infra change | Show the build or compose output confirming a clean exit |
| API / data change | Show a real response (curl, test output, or screenshot of the UI rendering data) |

**Show the output directly in your response.** Do not say "tests pass" — paste the relevant
lines. Do not say "the screenshot confirms it" — share the actual screenshot.

---

## Backend Rules

### Test Requirements

Every change to backend source code MUST include tests. Building is not enough.

1. **New endpoint or handler** — add an integration test that calls the endpoint and asserts response status and body.
2. **New helper function or business logic** — add a unit test covering the happy path and at least one error/edge case.
3. **Bug fix** — add a regression test that would have caught the bug. Name it clearly: `test_<thing>_<what_was_wrong>`.
4. **Refactor with no behaviour change** — run existing tests; all must pass.
5. **Database query or model change** — add or update integration tests that exercise the query.

### Test quality standards
- Test names must be descriptive: `test_create_expense_returns_400_when_amount_is_zero` (good) vs `test_create_2` (bad).
- Each test should have a one-line comment explaining **what** it checks and **why** it matters.
- Do not use `unwrap()` in test assertions — use `expect("reason")` so failures print useful messages.

### Security patterns to follow
- Never expose internal error details (DB schema, constraint names) to the client.
- Use parameterized queries everywhere — no string interpolation in SQL.
- Validate all inputs at the handler level with clear error messages.
- Hash passwords with argon2; use `spawn_blocking()` so hashing doesn't block the async executor.
- Store JWT secrets as env vars; refuse to start if the secret is weak (< 32 chars).

---

## Frontend Rules

### Architecture patterns
- Use the Editorial Wanderlust design system defined in `design.md`.
- Use **design tokens** (CSS custom properties in `globals.css`) as the single source of truth for colors, spacing, typography.
- Use **font-display** (Plus Jakarta Sans) for headlines and **font-body** (Inter) for body text.
- NO 1px borders — use background color shifts for section boundaries.

### State management
- Keep auth state in a context provider — token, user info, login/register/logout methods.
- Store JWT in `sessionStorage` (not `localStorage`) for tighter security.

### API layer
- Create a single `api.ts` with all API calls pointing to the Rust backend at `/api/v1`.
- Support a dev mock mode that returns fixture data without a backend.
- On 401 responses, auto-refresh the token and retry the request.

### Accessibility
- Modals must trap focus (Tab/Shift+Tab cycle, Escape closes).
- Dropdowns must support arrow-key navigation.
- Use semantic HTML: `role="dialog"`, `aria-label`, `aria-expanded`, `aria-selected`.

---

## Frontend–Backend Contract Rule

Any time the API layer is modified to add or change a real endpoint URL, you MUST
immediately verify the matching route exists in the backend before committing.

### Checklist when adding/changing an API function
1. Identify the real URL in the non-mock branch.
2. Grep the backend routes to confirm it is registered.
3. If the route is **missing** — implement it in the same task.
4. If the route **exists** — confirm the HTTP method (GET/POST/PUT/DELETE) matches.
5. Build the backend to confirm it still compiles.

---

## Design System Rules

### Key conventions (from design.md)
- Use CSS custom properties defined in `globals.css` for all colors.
- No raw hex colors in components — always reference a theme token.
- Surface hierarchy: `surface` → `surface-low` → `surface-lowest` → `surface-highest`.
- Tonal layering over borders and drop shadows ("No-Line Rule").
- `label-stamp` class for metadata (uppercase, bold, +0.05em tracking).
- `gradient-cta` for primary buttons (135° primary to primary-container).
- `glass` for floating/glassmorphism elements.
- `shadow-float` for ambient floating shadows.
- `tracking-editorial` (-0.02em) on display headings.
- Rounded corners: `rounded-2xl` (1rem) or `rounded-3xl` (1.5rem).
- Text: `text-on-surface` (#071E27), NEVER pure black.

---

## Screenshot Verification for UI Changes

When you edit any file that affects the UI (`.tsx`, `.css`), you MUST take a screenshot to verify:

1. Start the dev server (or reuse if already running).
2. Take a screenshot of the affected page/component.
3. Share the screenshot with the user so they can visually verify.

Do not wait to be asked. Do not skip this step.

---

## What NOT To Do

- **Never commit `.env` files** — they contain secrets. Warn the user if they ask.
- **Never use `git add -A`** — stage only the files you changed.
- **Never say "tests pass" without pasting the output** — show proof.
- **Never assume a screenshot proves the backend works** — grep the routes.
- **Never skip verification** — if the build fails, fix it before reporting success.
- **Never amend a previous commit after a hook failure** — create a NEW commit instead.
- **Never push force to main/master** — warn the user if they request it.
