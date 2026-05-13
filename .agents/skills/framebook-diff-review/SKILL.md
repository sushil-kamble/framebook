---
name: framebook-diff-review
description: Review Framebook repository diffs, pull requests, local changes, or recent commits before merge or release. Use when Codex is asked to audit Framebook changes for project intent, package-boundary fit, client/server/shared contract correctness, tests, code quality, dead code, regressions, or findings-first review without editing files.
---

# Framebook Diff Review

## Operating Mode

Stay read-only unless the user explicitly asks for fixes. Do not stage, commit, format, or edit files during a review.

Lead with findings, ordered by severity. If there are no findings, say that directly and include residual risk or validation gaps.

## Framebook Intent

Framebook is a pnpm workspace monorepo for agent-driven image/workflow development. The current goal is a clean, maintainable foundation, not broad feature sprawl.

Package boundaries are review-critical:

- `packages/client`: TanStack Start / React client application.
- `packages/server`: Node server package, HTTP/bootstrap, domains, and Codex app-server integration.
- `packages/shared`: shared contracts, constants, config, validation, and runtime-safe helpers.
- `bin`: packaged CLI entrypoints.

Framebook-specific rules:

- Keep client UI under `packages/client/src/app`; do not recreate `packages/client/src/features`.
- Keep route files under `packages/client/src/routes`.
- Keep app-specific React components under `packages/client/src/app/components`.
- Keep app-specific client helpers under `packages/client/src/app/lib`.
- Keep shared client utilities under `packages/client/src/shared`.
- Keep server bootstrap/routes under `packages/server/src/app`.
- Keep domain logic under `packages/server/src/domains`.
- Keep external integrations under `packages/server/src/infrastructure`.
- Put cross-package contracts in `packages/shared`; update shared exports intentionally.
- Preserve the existing theme unless the user explicitly asks for visual restyling.
- Do not add heavy dependencies or generated/build artifacts without a clear need.

## Workflow

1. Establish scope.
   - Run `git status --short`.
   - Identify whether to review staged, unstaged, branch, commit, or recent work.
   - Use `git diff --stat`, `git diff --name-only`, and the relevant `git diff` or `git show`.
   - Ignore unrelated dirty files unless they affect the reviewed change; call them out separately.

2. Read Framebook guidance before judging.
   - Open `AGENTS.md` and `CLAUDE.md`.
   - Check `package.json`, package-level scripts, `pnpm-workspace.yaml`, and touched package configs when relevant.
   - For routing, shared exports, package structure, or server/client integration, expect `pnpm build` to be part of validation.

3. Trace changed behavior.
   - For client changes: inspect app shell, component state ownership, routes, loading/error states, copy/click behavior, keyboard behavior, accessibility, and responsive layout risks.
   - For server changes: inspect router entrypoints, domain services, storage, generated metadata, filesystem paths, Codex app-server adapters, and error handling.
   - For shared changes: inspect every producer/consumer across client and server.
   - For image generation changes: trace prompt construction, metadata persistence, existing-image compatibility, reference image paths, and worker contract text.

4. Review checklist.
   - Intent: Does this fit Framebook's current product direction and avoid broad implementation without explicit request?
   - Boundaries: Is code in the right package and folder?
   - Contracts: Are shared types/API responses/server records/client assumptions aligned?
   - Behavior: Look for regressions, stale state, missing fallbacks for existing metadata, race conditions, path bugs, swallowed errors, and user-visible breakage.
   - Tests: Are focused tests updated for the changed surface and meaningful enough to fail on regression?
   - Code quality: Is the change explicit, boring, typed, ESM-consistent, and locally patterned?
   - Dead code: Use `rg` for unused exports, stale imports, unreachable branches, obsolete tests, stale docs, unused dependencies, and removed symbols still referenced.
   - UI fit: Does the UI preserve theme, spacing, route-scoped behavior, and expected controls without accidental redesign?

5. Validate carefully.
   - Minimum expected commands after code changes: `pnpm typecheck` and `pnpm lint`.
   - Prefer focused tests for changed surfaces, for example `pnpm --filter @framebook/client test -- image-grid.test.tsx` or `pnpm --filter @framebook/server test -- framebook-service.test.mjs`.
   - Run `pnpm build` for package structure, shared exports, routing, build config, or server/client integration.
   - Report commands and exit codes. If not run, explain why.

## Output Format

Use this structure:

```markdown
**Findings**
- [P1] Short title - path:line
  Impact, evidence from the traced code path, and the smallest actionable fix.

**Open Questions**
- Only real blockers or assumptions.

**Validation**
- `command`, exit code N, relevant result.

**Summary**
Brief secondary context, only after findings.
```

Severity guide:

- `P0`: data loss, security issue, broken release/migration, or production blocker.
- `P1`: likely user-visible regression, broken contract, missing compatibility, serious validation gap.
- `P2`: edge-case correctness issue, maintainability risk, weak tests for changed behavior.
- `P3`: low-risk cleanup, docs, naming, or test clarity.

## Reference

Load [references/review-principles.md](references/review-principles.md) only when you need the source-inspired review rationale or links.
