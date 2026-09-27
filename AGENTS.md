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
- Shared contracts, migrations, lockfile, global styles, and application entry points require coordination. Respect each Issue's file boundaries; unexpected overlap blocks concurrent edits until resolved.
- Update claim state when handing off to a PR, stopping, or finishing. Expired claims require inspection of their branches and PRs before takeover.
- Close Issues only when their acceptance checks pass and changes reach the intended default branch. Open PRs and green local tests alone are insufficient.
- Recompute the queue after dependency changes, claims, PR state changes, or Issue closure. Optional deployment does not block the mandatory Epic.

## Verification and delivery

- Test business invariants with isolated temporary databases. Never reset a user database as part of tests or startup.
- Keep real LLM validation separate from mocked CI tests; missing provider credentials are an external validation blocker, not a passing result.
- Never commit secrets, environment files, database contents, or sensitive logs. Use synthetic community data.
- Commit and push completed in-scope changes after relevant checks; use concise English Conventional Commit messages without agent/tool branding. Preserve unrelated changes and never force-push without explicit authorization.
- After each push, follow configured CI/CD to completion and verify a live surface when deployment exists. If no CI/CD or deployment is configured, report that explicitly.
