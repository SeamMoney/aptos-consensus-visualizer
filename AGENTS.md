# Repository Guidelines

## Project Structure & Module Organization
- `src/app` holds the Next.js App Router entry points (layout, pages, and API routes like `src/app/api/blocks/stream/route.ts`).
- `src/components` contains the visualization UI; Pixi scenes live in `src/components/pixi`, shared UI in `src/components/ui`.
- `src/hooks`, `src/lib`, `src/contexts`, and `src/data` keep custom hooks, utilities, context providers, and static content organized.
- `public` stores static assets (e.g., `public/og-banner.png`); `scripts` contains narrative/video copy.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the local Next.js dev server.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint across the repo.

## Coding Style & Naming Conventions
- TypeScript + React with 2-space indentation and standard Next.js/ESLint defaults.
- Components use PascalCase (`ConsensusStatsPanel`); hooks use `useX` (`useAptosStream`).
- Keep visual styling in Tailwind class strings; global styles live in `src/app/globals.css`.
- Prefer small, focused components; keep data and rendering logic close to the visual component it powers.

## Testing Guidelines
- No automated test suite is configured in `package.json` right now.
- If you add tests, document the new command in `package.json` and place files in a clear location (e.g., `src/**/__tests__`).

## Commit & Pull Request Guidelines
- Commit history favors short, imperative, sentence-case summaries (e.g., `Add network toggle`).
- PRs should include a brief summary, list any UI changes, and attach screenshots or a short clip when visuals change.

## Configuration & Assets
- This is a Next.js 15 + Tailwind project with Pixi.js and p5 for visualizations.
- Update Open Graph/Twitter assets in `src/app/opengraph-image.tsx` and `src/app/twitter-image.tsx` when visuals change.
