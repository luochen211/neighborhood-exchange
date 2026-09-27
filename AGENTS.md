# Repository guidance

## Requirements and scope

- Read `docs/product/PRD.md`, `docs/engineering/SRS.md`, and `docs/planning/DAG.md` before implementation.
- PRD defines product behavior; SRS defines the implementation contract and acceptance cases. Keep both current when requirements change.
- This is a single-community, mobile-first Web exam project. Do not add payments, real registration, messaging infrastructure, or multiple communities without a scope change.
- Planning artifacts describe intended behavior, not implemented or verified behavior.

## DAG execution

- GitHub native parent and blocked-by relationships are the scheduling source of truth. `docs/planning/tasks.json` and `DAG.md` are the initial plan and readable snapshot.
- Re-read Issue state, dependencies, PRs, checks, and claim comments before selecting work. Do not start a dependent Issue before its prerequisites are closed with acceptance evidence.
- Each independent session claims one Ready Issue, using a visible `DAG-CLAIM` comment with session, branch, scope, claimed-at, heartbeat-at, and expires-at. Re-read after claiming to detect competing claims.
- Use a distinct `codex/` branch and isolated worktree per implementation session. Do not spawn parallel sessions merely because a task is Ready.
- Issue #9 exclusively owns all of apps/web, including routes, shared UI, global styles, API adapters and frontend tests. Issue #4 exclusively owns all of apps/api, including routes, auth, database migrations, business modules and API tests. They work independently against the same contract.
- Shared contracts/OpenAPI/SRS protocol changes and root package.json/lockfile/CI changes are serialized through the coordinator. Neither frontend nor backend may edit the other workspace. Do not split either implementation into sibling execution sessions.
- Frontend may use an explicitly enabled development Mock adapter for independent interaction acceptance; production uses the HTTP adapter with no silent Mock fallback. Backend acceptance uses real isolated databases and API tests, without requiring the frontend.
- Update claim state when handing off to a PR, stopping, or finishing. Expired claims require inspection of their branches and PRs before takeover.
- Close delivered Issues as completed only after acceptance passes and changes reach the default branch. Superseded tasks are closed as not_planned and removed from active dependencies/parent scope, never counted as delivered. Open PRs and green local tests alone are insufficient.
- Recompute the queue after dependency changes, claims, PR state changes, or Issue closure. Optional deployment does not block the mandatory Epic.

## Verification and delivery

- Test business invariants with isolated temporary databases. Never reset a user database as part of tests or startup.
- Keep real LLM validation separate from mocked CI tests; missing provider credentials are an external validation blocker, not a passing result.
- Never commit secrets, environment files, database contents, or sensitive logs. Use synthetic community data.
- Commit and push completed in-scope changes after relevant checks; use concise English Conventional Commit messages without agent/tool branding. Preserve unrelated changes and never force-push without explicit authorization.
- After each push, follow configured CI/CD to completion and verify a live surface when deployment exists. If no CI/CD or deployment is configured, report that explicitly.
