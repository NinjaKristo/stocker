# Static Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cloned app launch locally in read-only static mode without paid APIs or backend infrastructure.

**Architecture:** Keep the existing static SPA and make only the static-data origin configurable. Use a Windows batch launcher as the one-click entrypoint.

**Tech Stack:** React 18, Vite, Vitest, Windows batch.

## Global Constraints

- First startup path must not require paid API keys.
- Keep the existing compact scanner visual language.
- `CJN-LAUNCH.bat` is the expected one-click launcher name.
- Backtesting and live trading persistence are not part of this first startup slice.

---

### Task 1: Configurable Static Data Origin

**Files:**
- Modify: `frontend/src/config/runtimeMode.js`
- Test: `frontend/src/config/runtimeMode.test.js`

**Interfaces:**
- Consumes: `import.meta.env.VITE_STATIC_DATA_BASE_URL`
- Produces: `getStaticDataUrl(relativePath = 'manifest.json')`

- [ ] Write a failing test proving `getStaticDataUrl('manifest.json')` returns `https://xang1234.github.io/stock-screener/static-data/manifest.json` when `VITE_STATIC_DATA_BASE_URL` is set to `https://xang1234.github.io/stock-screener/static-data/`.
- [ ] Run `npm run test:run -- src/config/runtimeMode.test.js` from `frontend` and verify the test fails because the env var is not yet supported.
- [ ] Update `getStaticDataUrl()` to normalize the env base URL with one trailing slash and append the normalized relative path.
- [ ] Run the same test and verify it passes.

### Task 2: One-Click Static Launcher

**Files:**
- Create: `CJN-LAUNCH.bat`

**Interfaces:**
- Produces: a local Vite dev server at `http://localhost:5173/` with `VITE_STATIC_SITE=true`.

- [ ] Create `CJN-LAUNCH.bat` that changes to the repo root, checks for Node and npm, installs frontend dependencies when `frontend\node_modules` is missing, sets `VITE_STATIC_SITE=true`, sets `VITE_STATIC_DATA_BASE_URL=https://xang1234.github.io/stock-screener/static-data/`, and runs `npm run dev -- --host 127.0.0.1`.
- [ ] Run the launcher command path and verify Vite starts.

### Task 3: Verification

**Files:**
- Read: `frontend/src/App.static.test.jsx`

**Interfaces:**
- Consumes: all changes from Tasks 1 and 2.
- Produces: verified local startup path.

- [ ] Run `npm run test:run -- src/config/runtimeMode.test.js src/App.static.test.jsx` from `frontend`.
- [ ] Run `npx vite build --mode static` from `frontend` with `VITE_STATIC_SITE=true` and the static-data base URL set.
- [ ] Start the launcher and verify the local page responds at `http://127.0.0.1:5173/`.
