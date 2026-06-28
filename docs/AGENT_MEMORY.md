# Agent Memory & Handoff Guide

> **Purpose:** how persistent, structured "memory" works in this project for AI
> coding agents and humans, and how to resume work after time away or hand the
> project to a colleague. If you read one file before starting, read this one,
> then [`AGENTS.md`](../AGENTS.md).

## TL;DR — resuming in 30 seconds

```bash
bd ready        # what can I work on right now (no blockers)?
bd show <id>    # full detail on an issue (e.g. bd show stockscreenclaude-b2l)
bd update <id> --status in_progress   # claim it
bd close  <id> --reason "..."         # finish it
bd sync         # commit + push the issue changes alongside your code
```

If `bd` is not installed or `bd ready` says *"no beads database found"*, see
[First-time setup](#first-time-setup-new-machine--new-colleague) below.

---

## The memory layers

This repo does **not** use a single memory file. Work-state and knowledge live in
several complementary places:

| Layer | Location | What it holds | Tracked in git? |
|-------|----------|---------------|-----------------|
| **Work tracker (primary)** | `.beads/` | Open/closed issues, priorities, dependencies — the live "what's left to do" state. Managed by **beads** (`bd`). | `issues.jsonl` yes; local Dolt DB no |
| **Agent protocol** | [`AGENTS.md`](../AGENTS.md) | The `bd` workflow + the mandatory **"Landing the Plane"** session-completion checklist. | yes |
| **Claude instructions** | [`CLAUDE.md`](../CLAUDE.md) | Architecture, commands, conventions, gotchas for Claude Code. | yes |
| **Domain glossary** | [`CONTEXT.md`](../CONTEXT.md) | Ubiquitous language (Market, MIC, Provider Data Plan…) so plans/tests/reviews share terms. | yes |
| **Plans** | `.plans/` | Detailed implementation plans referenced by issues. | yes |
| **Long-form docs** | `docs/` | ADRs (`docs/adr/`), `ARCHITECTURE.md`, `DEVELOPMENT.md`, etc. | yes |

The **beads tracker is the resume engine.** Everything else is reference.

## What is beads (`bd`)?

Beads is a git-native issue tracker built for AI coding agents. Issues live in
your repo (`.beads/issues.jsonl`) and sync through git — no web UI, no account.

- **Binary:** `bd`, a compiled Go program. Open source (MIT),
  [github.com/gastownhall/beads](https://github.com/gastownhall/beads),
  distributed on npm as `@beads/bd`.
- **Storage:** an **embedded Dolt** database (version-controlled SQL) lives in
  `.beads/embeddeddolt/`. That directory is **gitignored** — each developer
  rebuilds it locally from the committed `.beads/issues.jsonl`, which is the
  shared source of truth.
- **Why it matters here:** `AGENTS.md` mandates the `bd` workflow, so without
  `bd` installed an agent can't follow this project's own process.

## First-time setup (new machine / new colleague)

A fresh clone contains `.beads/issues.jsonl` but **not** the local database (it's
gitignored). Rebuild it once:

```bash
# 1. Install the bd binary (pin 1.0.4 — see "Known gotchas" for why not :latest)
npm install -g @beads/bd@1.0.4

# 2. From the repo root, build the local Dolt DB from the tracked JSONL
bd init --from-jsonl --prefix stockscreenclaude --skip-agents

# 3. Verify
bd ready          # should list the open issues
```

Notes:
- `--skip-agents` preserves this repo's customized `AGENTS.md` (don't drop it).
- `--prefix stockscreenclaude` keeps issue IDs consistent (`stockscreenclaude-<hash>`).
- Requires Node 18+ (this machine has Node 26 / npm 11).
- `npm` may warn that the postinstall script is blocked (`allow-scripts`); the
  binary still installs. To pre-approve: `npm config set allow-scripts=@beads/bd --location=user`.

## Daily workflow & "Landing the Plane"

See [`AGENTS.md`](../AGENTS.md) for the authoritative version. In short: at
session **end** you must update issue status, run quality gates, `bd sync`, and
**`git push`** — work isn't done until it's pushed.

## Known gotchas

- **Use `@beads/bd@1.0.4`, not latest.** As of 2026-06-28 the npm `@beads/bd@1.0.5`
  postinstall tries to download a GitHub release asset that returns **HTTP 404**
  (the published release lags the npm version). v1.0.4 is the latest tag with a
  real `windows_amd64` asset.
- **bd auto-commits.** `bd init` and `bd sync` create git commits on the current
  branch automatically. This repo's history shows work committed directly to
  `main`, so that's consistent here — just be aware.
- **Legacy SQLite → Dolt migration.** This `.beads/` was created by an older,
  SQLite-based beads. v1.x dropped SQLite for Dolt; `bd init --from-jsonl` handled
  the one-time migration (the 13 issues were re-imported from JSONL).
- **CLAUDE.md is stale on Node.** It says "system Node is v14, use NVM for Node 22."
  This machine now ships Node 26 globally — no NVM dance needed.

## Recovering the pre-migration issue data

The original (pre-bd-init) `.beads/issues.jsonl` is preserved in git history:

```bash
git show 2743ed03:.beads/issues.jsonl    # the last commit before bd init
```

## Change log

### 2026-06-28 — beads installed & migrated to Dolt (by Claude, requested by David Ten)

- Backed up `.beads/issues.jsonl` before any changes (pre-init state also in git
  history at commit `2743ed03`).
- Installed the `bd` binary via `npm install -g @beads/bd@1.0.4` after the `@1.0.5`
  postinstall failed with a 404 on its release asset. Verified provenance:
  npm `@beads/bd` → repo `github.com/gastownhall/beads`, maintainer `steveyegge`,
  MIT license.
- Ran `bd init --from-jsonl --prefix stockscreenclaude --skip-agents --skip-hooks
  --non-interactive` to create the embedded Dolt DB and import all **13** existing
  issues with their original IDs (e.g. `stockscreenclaude-b2l`).
- bd auto-committed its init (`.beads/.gitignore`, `.beads/metadata.json`, root
  `.gitignore` additions for `.dolt/`) to `main`.
- Removed stray `*.bak-*` backup files that bd's init swept into git, and added a
  `*.bak-*` ignore rule under `.beads/`.
- Authored this guide (`docs/AGENT_MEMORY.md`).
- **Did not** push to `origin` (left for the maintainer to review/push).

#### Current work snapshot (at handoff)

13 issues total · 3 closed · 10 open. Top of the ready queue:

| ID | P | Type | Title |
|----|---|------|-------|
| `stockscreenclaude-b2l` | P1 | bug | Live preset filtering broken: filtered scan-results queries time out (30s axios), show stale rows |
| `stockscreenclaude-55r` | P2 | task | WS4: frontend — surface results-query timeout instead of silent stale rows |
| `stockscreenclaude-e1n` | P2 | task | WS2: investigate live scan result relevance |
| `stockscreenclaude-dof` | P2 | feature | Market Health & Exposure dashboard |
| `stockscreenclaude-7iu` | P2 | feature | Build Social Signal Queue from X/theme signals |
| `stockscreenclaude-e05` | P2 | feature | Add Theme Pulse rotation evidence panel |
| `stockscreenclaude-fn7` | P2 | bug | Make full backend pytest runnable without a live server |
| `stockscreenclaude-8k2` | P2 | bug | Stabilize backend full unit suite |
| `stockscreenclaude-2ub` | P2 | bug | Stabilize frontend UI test timeouts under full-suite runs |
| `stockscreenclaude-bnb` | P3 | feature | Add runner guardrails to watchlists |

Run `bd ready` for the live list.
