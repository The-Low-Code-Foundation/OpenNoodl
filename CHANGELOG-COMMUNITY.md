# NodeGX — Community Changelog & Roadmap

**The Noodl revival, in plain language.** *July 2026 · v0.1.0*

> A note on names: the desktop app is now shipping under the name **NodeGX** (the repo, packages, and GitHub org still say OpenNoodl — only the user-facing app was rebranded). Same project, same open-source spirit, picking up where classic Noodl left off.

---

## Where we're headed (read this first)

Classic Noodl's original pitch was *"visual development instead of code."* We've deliberately **retired that framing.** The revival is built around a narrower, more honest thesis:

> **NodeGX is a legible substrate for human–AI co-building, and for learning real engineering.**

In practice that means three bets:
1. **Make the graph a language** every human *and* every AI can read, write, and verify.
2. **Make the editor worthy of it** — modern, fast, and maintainable.
3. **Make the AI a visible collaborator inside the graph** — you *see* what it built, you own it, and you can always get your code out.

Everything below serves that. We ship from day one, and we've committed to honest go/no-go gates so we stop if nobody comes.

---

## ✅ Shipped so far

### 🫀 Reanimation — a green, modern, shippable base
The starting point was a project that wouldn't build. That's fixed, and then some.

- **The build works again.** Typecheck and renderer build went from broken to zero errors. Everything else stands on this.
- **A real test suite.** Grew from ~540 to **700+ specs, green**, running locally and headless — where before the tests couldn't even boot.
- **Continuous Integration.** Every merge is now gated by six checks plus nightly cross-platform packaged builds. Regressions can't sneak back in.
- **Modern desktop shell.** Jumped **Electron 31 → 43** (12 major versions) and Node 20 → 24.
- **Security & dependency hygiene.** Audit findings cut from ~89 to a handful of documented, accepted items; TypeScript unified at 5.9 across the whole codebase.
- **Design tokens now survive deployment.** Style tokens used to work in the editor but silently break in deployed apps — exported apps now carry them correctly.
- **Signed-build & auto-update pipeline.** Full release infrastructure for **macOS, Windows, and Linux (AppImage + deb)**, with notarization and auto-update wired up. (The first *signed* public cut is a human credential step still to come.)

### 🧬 The v2 format & AI substrate — "the graph is a language"
This is the strategic heart of the revival, and it's **complete**.

- **Decomposed v2 project format.** Projects now save as **per-component files** instead of one giant monolithic blob. One edit touches only that component — which is what finally makes diffing, merging, and AI editing possible.
- **Guaranteed round-trip fidelity.** Save-and-reload loses nothing — we closed eight data-loss gaps (comments, visual roots, lessons, thumbnails, styles, and more), verified against real projects.
- **Safe migration engine.** Converts old monolithic projects to v2 with a backup-first, verify-before-commit, auto-rollback design — your original is never at risk.
- **The Node Catalog.** A machine-readable catalog of **all 135 node types** — every port, type, default, and enum — generated from the live runtime. This is what lets an AI know what nodes exist and how to wire them.
- **Catalog enrichment.** Human/AI-readable semantics on top: descriptions, when-to-use notes, 40 validated example fragments, and connection-compatibility rules. A blind A/B test confirmed it produces materially better AI output.
- **Semantic Validator.** A linter for graphs — catches unknown node types, nonexistent ports, dangling connections, and orphan nodes. Ships as a CLI, a library, and an in-editor **Problems panel** with click-to-navigate. It's the AI's compiler errors — and it catches human mistakes too.
- **Graph-native diff/merge — git for graphs.** Replaced the old 666-line merger with a v2-aware engine: human-readable graph diffs in the editor and sane per-component merge conflicts. This unlocks real team and PR workflows on visual graphs.
- **NodeGX MCP Server.** A standalone Model Context Protocol server with 14 tools that lets **any** agent — Claude Code, IDE agents, CI bots — open, read, validate, and author NodeGX projects. *(This passed our first decision gate — see below.)*
- **Live preview harness.** Render a project in a plain browser with **no editor running**, hot-reloading as files change on disk, with a validation gate that keeps the last good build on screen while an agent is mid-edit.

### 🛠 Editor platform health — the "never again" work
- **Canvas decomposition.** The scariest file in the codebase — a **3,481-line** graph-editor "god object" — was broken into 20 modular, tested units (down to ~790 lines), performance-verified at 500 nodes. We kept the fast HTML5 canvas rendering (deliberately *not* a React Flow rewrite).
- **jQuery is completely gone.** From **547 jQuery calls to zero**, 68 files to zero, all 34 legacy HTML templates deleted. Popups, property editors, and widgets were rebuilt in TypeScript/React.

### 🤝 AI collaboration
- **Modern AI client.** Replaced the stale, retired-model plumbing with a provider-agnostic client supporting current Anthropic / OpenAI / OpenAI-compatible models **and local models via Ollama** (for schools and privacy), with secure credential storage.
- **Explain Mode.** Select any node or subgraph and the AI narrates what it does, where data flows, and what triggers what — read-only, with citations that highlight back onto the canvas.

### ⚛️ React 19 apps — opt in per project
- **Your apps can now run on React 19.** Flip one setting (Project Settings → Runtime) and both live preview and your next deploy use React 19; leave it alone and nothing changes — existing projects stay on React 18.3 exactly as before, and the switch is fully reversible. Verified by rendering a corpus of real projects head-to-head on both versions (signal ordering, animations, navigation, repeaters): no behavioural differences. The comparison work also uncovered — and fixed — a long-standing bug where styles applied directly to elements (visibility, transforms, animations) silently didn't land until an unrelated re-render. Details: `docs/runtime/REACT-19-RUNTIME.md`.

### 🔌 External backends — bring your own backend
Your data, your server, first-class in the editor.

- **Backend Services panel + five `noodl.byob.*` data nodes.** Connect a self-hosted **Directus, Supabase, Pocketbase, or custom REST** backend, sync its schema into the editor, and every node dropdown, field input, enum, and relation comes from your real database structure. Two-token design keeps your admin credentials out of deployed apps.
- **Query Data with a real filter editor.** Nested and/or groups, drag-and-drop, schema-aware operators and value editors, values from the graph via connected ports, dotted paths across relations (`author.name`) for both filtering and sorting, and correct pagination totals under filters.
- **Related data in one toggle.** Many-to-one relations become `Include` ports — flip one and each record arrives with the related record nested inside.
- **Create / Update / Delete Record** with schema-generated field inputs and success/failure signals.
- **Subscribe To Changes — realtime.** A WebSocket subscription on any collection (Directus): remote creates, updates and deletes fire signals with the changed records, with auto-reconnect and honest `subscribed` state. Wire `changed` → `fetch` and a list stays live without polling.
- **Verified against live servers, not mocks.** A committed Docker-based Directus e2e rig; schema parsing exercised against live Directus *and* live PostgREST (Supabase's REST layer); the whole path from editor-built filter to row-exact live results — including a server-restart reconnect — demonstrated end-to-end. Along the way this work found and fixed real defects unit tests couldn't see (dropped relations, dead enum dropdowns, wrong pagination counts, a reconnect dead-end on failed connects).
- Docs: `docs/runtime/BACKEND-SERVICES.md`.

### 🧱 Foundation from earlier work
- **React 19 editor.** The editor itself now runs on React 19.
- **Universal Backend Adapter (UBA) — retired.** First contact with a real backend showed the UBA design targeted a middleware protocol no server speaks; the working **Backend Services / BYOB** stack above is the external-backend story, and the UBA panel and client have been removed.
- **Styles overhaul.** A ~200-token, Tailwind-scale style system with presets and a style analyser.
- **Canvas visualization views.** Component X-Ray shipped and enabled; a Trigger Chain Debugger and Data Lineage view are reachable (still stabilizing).

> **Honesty note:** a few "shipped" items still carry caveats — the AI client, authoring loop, and Explain Mode need verification against *live* AI providers; the merge-conflict UI hasn't yet been exercised on a real conflict. A dedicated live-verification pass (below) exists specifically to convert asserted results into demonstrated ones.

---

## 🔧 In progress right now

- **The Authoring Loop** — *the headline feature.* "Describe a page → the agent writes the component → the editor shows the new graph live → you accept, refine, or reject." The headless core (gather context → author → validate → self-repair, on a hard context budget) is built, and the **Build panel** now ships in the editor: describe a component, watch the agent's progress stream in (its reasoning, what it read, each validation verdict), then accept, refine, or reject. Nothing touches your project until you accept; accepting is undoable like any edit. Live-provider runs and live-on-canvas rendering during authoring are next.
- **Typing the runtime.** Converting the runtime and viewer from JavaScript to TypeScript, tests-first, and publishing the node-definition API types.
- **Lessons engine revival.** Assessment complete — verdict: *revive, don't rebuild.* The lesson runtime is intact; only the discovery UI and authoring format need work.
- **Revival debt cleanup.** A crash in a Cloud Function node (that broke deployed apps) is already fixed; a prioritized backlog of defects and owed verification follows.

---

## 🗺 The roadmap — what's to come

### Near term — finish the platform & prove the claims
- **Live verification pass** — prove the shipped claims against the running app. Evidence over assertions.
- **Fix authoring-critical defects** — Expressions reading Variables, safe component-port renames.
- **Editor UX loose ends** — property-panel polish and the style-suggestion banner.
- **Graph-native review** — visual diff of AI-proposed changes: added / removed / rewired nodes highlighted on canvas *before* you accept.

### Runtime & deploy health
- ~~**Runtime React 17 → 19**~~ — ✅ shipped (see above): per-project opt-in, React 18.3 stays the default.
- **SSR / SSG support** — server-side rendering and static generation, per project.
- ~~**Finish the backend adapters**~~ — ✅ shipped (see *External backends* above): Directus verified end-to-end incl. realtime, committed e2e rig, Supabase schema parsing verified against live PostgREST. Still open: a full live-Supabase CRUD verification pass and one-to-many/many-to-many relation traversal.
- **Reliable local SQLite** — *silent data loss fixed.* The local backend used to quietly swap in an in-memory mock when its database engine was missing, so records saved, demoed, and then vanished on restart. It now **fails loudly** instead: the backend refuses to start with a clear, actionable error, and the throwaway in-memory mode is a labelled, opt-in "ephemeral" choice you make on purpose — the Backend Services panel shows persistent / ephemeral / failed at a glance. Making the native engine build reliably on every platform is folded into the standalone-backend work (WF-004); until then, "loud" is the honest state.

### Noodl Learn — education as a real product line
- **Curriculum v1** — 10–15 lessons teaching *real engineering concepts* (state, data flow, events, componentization) through the graph, with the AI as tutor rather than ghostwriter.
- **Web read-only viewer** — a browser-based, Chromebook-viable graph viewer so lessons and shared projects are one link away.
- **Web editor spike** — a time-boxed investigation into running the editor in the browser, then an explicit go/no-go.
- **Classroom mode & pilots** — teacher dashboard, offline/no-account start, local-model AI, and two real-world pilots (a school and a code club).

### Code Export v2 — no lock-in, guaranteed
- **`@nodegx/core`** — a reactive-primitives library preserving NodeGX's semantics.
- **Deterministic generators** — export visual nodes, state, events, and routing to a **React + Vite** repo.
- **AI-assisted logic translation with trace verification** — translate custom logic via LLM, then run original vs. exported side-by-side on recorded traces so humans only review mismatches.
- **Multi-framework** — port the exported React codebase to Svelte/Vue, verified by the same harness.

### Cloud & workflows
- Finish the workflow runtime, connect the execution-history pipeline, ship Series 1 workflow nodes and one managed deploy target done well.

### Ecosystem *(gated — later)*
- Real-time collaborative (multiplayer) editing, a component & lesson marketplace, multi-project workspaces, and a hosted platform — only after the wedges above prove out.

### What's explicitly *not* coming (so we don't over-promise)
- Advanced GitHub-workflow plumbing (graph-native diff/merge serves the real need instead).
- Five simultaneous deploy-target wrappers (code export is the universal escape hatch).
- Native multi-framework compilers (verified AI post-processing instead).
- Racing vibe-coding tools on raw speed — our pitch is comprehension, ownership, and learning.

---

## 🎯 The honesty gates

We committed to three pre-decided go/no-go gates, because the most expensive failure is building everything for a product nobody adopts:

| Gate | Question | Status |
|---|---|---|
| **G1** | Can an external AI agent author a valid page via the catalog + MCP into a real project? | ✅ **Passed** — an external agent added a valid page to a real 176-component app, accepted first try. |
| **G2** | After the authoring demo ships for a quarter and pilots run — do people *return unprompted*? | ⏳ Ahead |
| **G3** | Which wedge pulled harder — education, or the AI-collaborative builder? | ⏳ Ahead |

---

*Built in the open by the Low Code Foundation. If the legibility thesis speaks to you — as a builder, a teacher, or a contributor — we'd love to hear from you.*
