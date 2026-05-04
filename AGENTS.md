# AGENTS.md

This file guides AI coding agents working in this repository. Keep changes deliberate, small, and easy to review.

## Project Overview

Framebook is a pnpm workspace application scaffolded as a package-based monorepo. The goal is to support agent-driven development while preserving clear package boundaries, strong code quality, and a clean foundation for a future Codex app-server implementation.

High-level layout:

- `packages/client` — TanStack Start / React client application.
- `packages/server` — Node.js server package. This is where the future Codex app-server implementation belongs.
- `packages/shared` — Shared types, contracts, constants, config, validation, and runtime helpers.
- `bin` — CLI entrypoints for starting/running the packaged app.
- Root config files — workspace, TypeScript, linting, formatting, package metadata.

The current codebase is intentionally bare-metal. Prefer building structure first, then implementation.

## Agent Working Rules

- Read existing files before changing them.
- Make the smallest useful change that satisfies the task.
- Preserve the package boundaries: client code in `packages/client`, server code in `packages/server`, shared contracts in `packages/shared`.
- Prefer explicit, boring, maintainable code over clever abstractions.
- Keep public interfaces and contracts in shared files when they are used by both client and server.
- Update scripts/config only when required by the task.
- Run validation commands after meaningful changes.

## Code Quality Expectations

Use the project tooling instead of ad-hoc checks:

```bash
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm build
```

Before considering work complete, run at least:

```bash
pnpm typecheck && pnpm lint
```

Run `pnpm build` when changing package structure, build config, routing, or server/client integration.

## TypeScript / JavaScript Guidance

- Keep TypeScript strictness intact.
- Do not weaken compiler options to make errors disappear.
- Prefer typed contracts and validation at boundaries.
- Use ESM consistently.
- Keep server `.mjs` code simple until TypeScript sources are introduced there intentionally.
- Avoid global mutable state unless it is clearly owned and documented.

## Client Guidance

- Keep the existing theme and design-token setup in `packages/client/src/app/styles/index.css`.
- Do not copy UI components from other projects unless explicitly requested.
- Put route files under `packages/client/src/routes`.
- Framebook is the client application, not a feature module. Put app-specific screens, shell, and orchestration under `packages/client/src/app`.
- Put app-specific React components under `packages/client/src/app/components`.
- Put app-specific client helpers, form helpers, constants, and local app types under `packages/client/src/app/lib`.
- Put shared client utilities under `packages/client/src/shared`.
- Do not create `packages/client/src/features` unless the product later grows separate, independently owned feature areas.

## Server Guidance

- Keep HTTP/server bootstrap code under `packages/server/src/app`.
- Put domain-specific server code under `packages/server/src/domains`.
- Put adapters and external integrations under `packages/server/src/infrastructure`.
- The future Codex integration should live under `packages/server/src/infrastructure/agent-clients` or a clearly named server domain if orchestration grows.
- Keep server endpoints thin; move business logic into domains/services.

## Shared Package Guidance

- Use `packages/shared` for contracts, constants, config, validation schemas, and runtime-safe shared helpers.
- Do not place browser-only or Node-only code in shared unless it is clearly separated.
- Keep exports intentional in `packages/shared/package.json`.

## DON'Ts

- Do not start large application implementation without explicit direction.
- Do not flatten the monorepo back into a single-package app.
- Do not mix client UI code into server or shared packages.
- Do not add generated/build artifacts to source control.
- Do not commit secrets, local databases, `.env.*` files, or machine-specific paths.
- Do not disable lint/typecheck rules without explaining why.
- Do not introduce heavy dependencies unless there is a clear need.
- Do not copy Agent Todo UI components; only use its structure as inspiration.
- Do not overwrite the current theme unless explicitly asked.

## Dependency Management

- Use `pnpm` only.
- Add dependencies to the package that uses them, not blindly to the root.
- Prefer workspace dependencies for internal packages, e.g. `workspace:*`.

## Completion Checklist

When finishing a task, summarize:

1. Files changed.
2. Why the change was made.
3. Validation commands run and their result.
4. Any follow-up work or known limitations.
