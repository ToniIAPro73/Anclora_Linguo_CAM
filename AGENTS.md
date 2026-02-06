# Repository Guidelines

## Project Structure & Module Organization
- `index.html` hosts the Vite entry point and loads `index.tsx`.
- `index.tsx` bootstraps the React app and renders `App.tsx`.
- `App.tsx` contains the main UI, call flow, and Gemini live translation logic.
- `constants.ts`, `types.ts` centralize configuration and shared types.
- `utils/audioUtils.ts` includes audio encode/decode helpers used by the live session.
- `metadata.json` stores app metadata; `vite.config.ts` and `tsconfig.json` define build settings.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server for local development.
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the production build locally for smoke testing.

## Coding Style & Naming Conventions
- TypeScript + React with functional components and hooks.
- Indentation is 2 spaces; keep JSX props aligned and wrap long lines.
- Use `camelCase` for variables/functions, `PascalCase` for components/types, `UPPER_SNAKE_CASE` for constants.
- No formatter or linter is configured; keep changes small and consistent with existing patterns.

## Testing Guidelines
- No test framework is configured yet, and there is no `tests/` directory.
- If adding tests, prefer colocated `*.test.ts`/`*.test.tsx` near the module or a new `tests/` folder, and document the runner in `package.json`.

## Commit & Pull Request Guidelines
- Git history suggests Conventional Commits (e.g., `feat: add screen share`).
- Use short, imperative subjects and include a scope if helpful (`fix(ui): ...`).
- PRs should include: a concise summary, steps to verify, and screenshots for UI changes.

## Security & Configuration Tips
- Store API keys in `.env.local` (see `README.md`); never commit secrets.
- The app expects `GEMINI_API_KEY` to run translation features.
