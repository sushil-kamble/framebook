# CLAUDE.md

Guidance for Claude Code and Claude-driven development in this repository.

## Mission

Framebook is currently a bare-metal monorepo scaffold. The goal is to support agent-driven development while preserving clear package boundaries, strong code quality, and a clean foundation for a future Codex app-server implementation.

Do not rush into feature implementation. Structure, contracts, and maintainability matter first.

## Repository Shape

- `packages/client` — React/TanStack Start client.
- `packages/server` — Node server package and future Codex app-server implementation.
- `packages/shared` — Shared contracts, constants, config, validation, and runtime helpers.
- `bin` — CLI entrypoints.
- Root — workspace, TypeScript, lint, format, package, and project-level config.

## Development Principles

- Make focused, reviewable changes.
- Preserve the existing monorepo/package layout.
- Keep client, server, and shared responsibilities separate.
- Prefer simple modules with clear names over premature abstractions.
- Keep generated files, build output, local data, and secrets out of source control.
- Treat `packages/shared` as the contract layer between client and server.

## Commands

Use pnpm for all package operations.

Common commands:

```bash
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm build
```

Minimum validation after code changes:

```bash
pnpm typecheck && pnpm lint
```

Run `pnpm build` after changes to package structure, Vite/TanStack config, routing, shared exports, or server/client integration.

## Code Quality Rules

- Keep strict TypeScript settings enabled.
- Do not silence errors by weakening compiler or lint configuration.
- Prefer explicit imports and exports.
- Keep dependencies local to the package that uses them.
- Use workspace packages through `workspace:*`.
- Keep public shared APIs intentional and stable.
- Add tests when implementing logic, parsing, validation, routing behavior, or non-trivial state transitions.

## Client Notes

- Preserve the current theme in `packages/client/src/app/styles/index.css`.
- Do not copy UI components from Agent Todo or other apps unless explicitly requested.
- Route files belong in `packages/client/src/routes`.
- Framebook is the client application, not a nested feature module.
- App-specific shell, screens, orchestration, and app code belong in `packages/client/src/app`.
- App-specific React components belong in `packages/client/src/app/components`.
- App-specific helpers, form helpers, constants, and local app types belong in `packages/client/src/app/lib`.
- Reusable client utilities belong in `packages/client/src/shared`.
- Do not create `packages/client/src/features` unless the product later grows separate, independently owned feature areas.

## Server Notes

- App bootstrap and HTTP routing live in `packages/server/src/app`.
- Domain logic lives in `packages/server/src/domains`.
- External integrations and adapters live in `packages/server/src/infrastructure`.
- Codex integration should start in `packages/server/src/infrastructure/agent-clients` unless a more appropriate domain boundary is established.
- Keep routes thin and move real logic into domain/service modules.

## Shared Notes

- Put cross-package types, contracts, constants, config, schemas, and runtime-safe helpers in `packages/shared`.
- Avoid browser-only or Node-only assumptions in shared code.
- Update `packages/shared/package.json` exports when adding public shared modules.

## DON'Ts

- Do not implement broad product features unless explicitly asked.
- Do not collapse the workspace into a single package.
- Do not place server logic in the client package.
- Do not place UI components in shared.
- Do not overwrite the current styling theme.
- Do not copy Agent Todo UI; use only its directory/package structure as inspiration.
- Do not commit `.env.*` files, databases, generated build output, logs, or local machine config.
- Do not add large frameworks or dependencies without a clear reason.
- Do not ignore failing checks.

## Claude Workflow

1. Inspect the relevant files first.
2. State or infer the smallest safe plan.
3. Edit only the necessary files.
4. Run the relevant validation commands.
5. Summarize what changed and what was verified.

If a requested change conflicts with this file, follow the user request, but call out the tradeoff clearly.
