# Repository Guidelines

## Project Structure & Module Organization
- `src/server/` holds the Hono-based server, routes, and LLM helpers (entry: `src/server/index.ts`).
- `src/ui/` is the Vite + React frontend (entry: `src/ui/src/main.tsx`, static assets in `src/ui/public/`).
- `dist/` contains build output for the server (`dist/index.mjs`).
- Root configs include `biome.json`, `tsconfig.json`, and `tsdown.config.mts`.

## Build, Test, and Development Commands
- `pnpm dev`: run the UI in dev mode (Vite) using `src/ui/vite.config.ts`.
- `pnpm dev:server`: run the server with watch via `tsx`.
- `pnpm typecheck`: TypeScript type checks without emit.
- `pnpm build`: full build (typecheck + server + UI).
- `pnpm build:server`: bundle server to `dist/` with `tsdown`.
- `pnpm build:ui`: build the UI with Vite.
- `pnpm start`: run the built server (`dist/index.mjs`).
- `pnpm lint`, `pnpm format`, `pnpm check`: Biome lint/format/check (all are write-enabled).

## Coding Style & Naming Conventions
- Indentation: tabs; line width 80; single quotes; semicolons (see `biome.json`).
- Prefer TypeScript across server and UI. Keep modules small and named after their responsibility (e.g., `routes/generate.ts`, `services/format.ts`).
- Use Biome for formatting and linting; run `pnpm check` before PRs.

## Testing Guidelines
- No automated test framework is configured yet. If you add tests, document the framework and add scripts to `package.json`.

## Commit & Pull Request Guidelines
- Commit history favors short, lowercase messages (e.g., `chore`, `server`, `mastra`), sometimes in Japanese. Keep commits concise and focused.
- PRs should include a brief summary, the commands run (e.g., `pnpm typecheck`), and screenshots for UI changes when applicable.

## Configuration Tips
- UI builds rely on `src/ui/vite.config.ts`; server builds rely on `tsdown.config.mts`. Keep both aligned if you change entry points.
