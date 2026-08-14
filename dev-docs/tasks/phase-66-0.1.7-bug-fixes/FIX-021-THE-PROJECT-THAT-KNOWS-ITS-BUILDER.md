# FIX-021 — The project that knows its builder

**Report 16** · Tier: **brainstorm + two small slices** · Effort **S** (slice A) + **M** (slice B); the loop is the open design

> *"Why don't we have a CLAUDE.md file at the level of each individual project, and a global
> CLAUDE.md file at the editor level?"*

## What already exists — more than the report assumes

- **Every project already gets a `CLAUDE.md`** (BST-005, both creation paths) — but it is a
  test-enforced **signpost, not a memory**: `agentConfig.ts:134-143` forbids it restating the
  server briefing, nothing in the product ever reads it back, and it is never overwritten
  ("the user's to own").
- **The project-docs substrate is unusually complete:** `docs/` with BRIEF / ARCHITECTURE /
  CONVENTIONS / `decisions/`, arbitrary user docs with per-file front matter
  (`inject: always|pull`, `when:` hints), caps, atomic writes, a 2s external-edit poll (editing
  in VS Code changes the next build live), the DocsPanel UI with per-turn token-cost disclosure,
  and MCP tools (`list_project_docs` / `get_project_doc` / `write_project_doc`) — *"Claude Code
  and the editor are equally well briefed rather than one being a second-class citizen."*
- The internal AI injects BRIEF + CONVENTIONS + every `inject: always` doc each turn, with a
  precedence ladder already stated ("a project rule beats your habit").
- **What does NOT exist, anywhere:** any global user-scoped document; any user profile
  (experience level, Function-vs-Visual-Function preference, deploy target, go-to backend —
  stored nowhere); any write-back loop that distils a session into a doc. `DocProposalStore`
  stages AI doc edits as accept/reject diffs — and its header carries the standing
  counter-argument this task must engage head-on: *"An assistant that rewrites ARCHITECTURE.md
  after every component lands produces changelog sludge nobody reads and, within a fortnight,
  nobody trusts."*

## 🔴 A concrete defect to fix regardless of the brainstorm (slice 0, S)

A project scoped by the **launcher wizard** gets a `CLAUDE.md` with **no summary and no mention of
`docs/`** — `LocalProjectsModel.writeAgentConfigFor` passes no `hasDocs`/`summary`, and the wizard
writes `docs/` *afterwards*. The MCP-created twin gets both. This violates BST-005's own
acceptance ("same two files, same content shape"). Fix the ordering or re-render after the docs
land. (Pairs naturally with FIX-008's backfill-on-open.)

## Slice A — project-level memory (~zero new machinery, S)

A `docs/LEARNINGS.md` (or preferences doc) is *already expressible today*: created from
`newDocTemplate` in the DocsPanel, `inject: always` front matter, picked up by
`projectAlwaysDocs()`, listed to Claude Code by `list_project_docs`, pointed at by one new line in
`renderClaudeMd`'s "Where the decisions are" bullets. The only new work: seed it at creation,
and decide who updates it.

## Slice B — the global doc (genuinely new, M)

`<userData>/PREFERENCES.md` (a real markdown file — the doc *is* the UI, plus an "Open
preferences" button in settings): seeded from a question-template; a `currentGlobalPrefs.ts`
provider mirroring `currentDocs.ts` exactly; a capped (~2k chars) `globalPreferences()` handout
appended **last** in the reference blocks (cache-tail-only, absent-means-omitted — the
`bld-011/cacheSafety` discipline); a precedence sentence: **global ranks below project
conventions, above model defaults**. MCP reads it via the path baked into `.mcp.json` `env` at
registration (the BST-004 "front door, never guess" pattern) — ⚠️ this deliberately breaks the
server's every-path-inside-projectDir invariant and needs its own read-only containment note.

## The brainstorm — six questions that decide the product

1. **Who writes updates, when?** End-of-session distillation via `DocProposalStore` diffs / a
   user-triggered "remember this" affordance / human-authored only. Each is a different product;
   the DocProposals sludge argument must be answered, not sidestepped.
2. **One file or a set?** NodeGX already has BRIEF/ARCHITECTURE/CONVENTIONS/decisions — where does
   "learnings" not overlap CONVENTIONS? Two overlapping taxonomies = two sources of truth, the
   exact failure the docs tooling warns about. Possibly the answer is *no new project doc*, just
   better seeding + prompting into CONVENTIONS.
3. **Does `CLAUDE.md` become the memory or stay the signpost?** Memory-in-`docs/` keeps one
   system and Claude Code auto-loads CLAUDE.md pointing at it; making CLAUDE.md itself the memory
   conflicts with never-overwrite and needs a reader.
4. **Privacy and the shared-repo boundary:** `docs/` is committed — "I prefer Visual Functions"
   is about *me*, not the project. Does a third scope exist: `.nodegx/preferences.md`
   (gitignored, per-user, per-project)?
5. **`always` vs `pull` cost:** a global always-doc is a per-turn cost on every project forever;
   `when:` hints are hard to write for preferences. Cap and placement?
6. **Structured settings vs prose:** deploy target / go-to backend map onto real settings
   (`ai.role.*` keys are precedent) the product can *act on*; keep the prose doc only for what a
   model must interpret. This split sharply shrinks the doc and makes it defensible.

## Acceptance for this task

1. Slice 0 fixed: launcher-scoped and MCP-scoped projects produce byte-equivalent-shape
   `CLAUDE.md`s (the BST-005 acceptance re-verified).
2. The six rulings recorded with rejected options named; slices A/B built only as ruled.
3. If slice B ships: a fresh project's Build-panel opening turn shows the global block **last**,
   absent when the file is empty (cache-safety spec extended, not weakened).
