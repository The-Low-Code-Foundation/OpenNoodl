# RUN-003 Assessment — the built UBA is a config-form renderer, not a backend data-adapter; the spec's premise is stale

> **CORRECTION + DECISION (2026-07-25, same day, hours later — read this box first).**
> Section 3's claim that "there is **no adapter interface or registry** … no runtime data-node wiring" is **wrong about the repo**. It was true of the UBA subsystem this assessment audited, but a broader sweep (prompted by mapping the Parse-node pattern for the option-A build) found **BYOB ("Bring Your Own Backend")** — a separate, newer, *working* native-backend adapter that every UBA-focused document missed, including this one:
>
> - **Editor:** `models/BackendServices/` (`BackendServices.ts`, `types.ts`, `presets.ts` with Directus/Supabase/Pocketbase/custom presets, admin-vs-public token split) + `views/panels/BackendServicesPanel/` with `AddBackendDialog` — registered live in `router.setup.ts` (sidebar id `backend-services`).
> - **Runtime:** `noodl-runtime/src/nodes/std-library/data/byob-{query-data,create-record,update-record,delete-record}.js` + `byob-utils.js` — registered in `register-nodes.js`, schema-driven dynamic ports (`sendDynamicPorts`), a `byob-filter` property-editor type, reads `backendServices` project metadata at runtime.
> - **Provenance:** commits `ae7d3b8` / `73b5a42` (2025-12-30/31, `origin/feature/byob-backend`), ancestors of HEAD.
>
> **Empirically verified same day** (real `BackendServices.parseDirectusSchema` + real `byob-utils` driven against the live containerised Directus from `uba-e2e/`): introspection **works** (collections, fields, PKs, enum choices), the runtime CRUD path **works end-to-end** (create → filtered query round-trip, HTTP 200), field→port mapping **works** (incl. enum ports). Confirmed gap: **relations are dropped** (`foreign_key_table` never mapped to `relationTarget`). BYOB has **zero tests**, and its Supabase/Pocketbase parsers are unverified against real instances.
>
> **So the premise correction goes one level deeper than §3 knew:** RUN-003's Desired State is *not* net-new construction after all — it is finishing work on **BYOB** (the spec's original "finishing" framing was accidentally right, about a subsystem nobody's docs named). §4's options are therefore superseded. **Decision (Richard, 2026-07-25): consolidate on BYOB and go deeper** — BYOB becomes the *single* external-backend story, finished to Parse-node quality: relations parsing, a real test suite, containerised-Directus e2e, Supabase parser verified against a real instance, visual-filter parity with the Parse QueryEditor, M2O relation traversal, a realtime subscribe node, then Supabase as the full second adapter; **UBA is formally retired** (its config-form renderer answered the same question in name only), and **phase 19's `nodegx-backend` must surface as one more preset in `BackendServicesPanel`** — one panel, one node UX, no fifth backend story. The rest of this assessment stands as the accurate record of what UBA is and why it could never have been the vehicle.

**Date:** 2026-07-25
**Status of task:** Step 1–2 (stand up a real backend and drive the existing client against it) **complete, with a load-bearing finding.** The spec explicitly makes this the first move ("Standing up a containerised Directus and driving the existing `UBAClient` against it is the fastest way to discover what the untested code actually does") and warns first contact "usually breaks something." It broke something structural, not incidental.
**Verdict:** **The premise is wrong, not the estimate.** RUN-003 is written as *finishing* work — "the architecture exists and works; this is end-to-end testing, a reference implementation, and a second adapter following an established pattern." First contact with a real Directus shows the built UBA subsystem is a **schema-driven configuration-FORM renderer for a hypothetical UBA-protocol middleware server** — not a system that reads a real backend's tables and lets you build against them. The two are different features. The Desired State RUN-003 asks for ("point OpenNoodl at a Directus instance, see their real collections and fields, and build against them") is **net-new construction**, not finishing. This changes the task's scope, its executor tier, and what "done" means, so it is a decision for Richard before any adapter is built. Evidence is reproducible in [`uba-e2e/`](./uba-e2e/); the raw run is [`uba-e2e/FIRST-CONTACT-OUTPUT.txt`](./uba-e2e/FIRST-CONTACT-OUTPUT.txt).

---

## 1. What the spec assumed vs. what is built

The spec and the phase-16 tracker inherited a belief — traceable to `PROGRESS-richard.md`'s session log — that "UBA-001…009" delivered a working backend adapter needing only E2E tests, a reference backend, and a second adapter. The phase-6 REV-006 truth pass already corrected the *coverage* claim (only `SchemaParser` and the conditions helper are tested; 6E Reference Backend and 6F Community have zero code). This assessment corrects something deeper: **what the built thing is.**

The built UBA subsystem (all editor-side, `packages/noodl-editor/src/editor/src/{models,services,views}/UBA*`) is:

- **`UBASchema`** — *not* a description of a backend's data. It is a description of a **configuration form**: `sections → fields` (string/text/number/boolean/secret/url/select/multi_select) with `visible_when` conditions and `ui` hints. It answers "what inputs should I render so a user can configure this backend adapter?"
- **`UBAClient`** — three static methods against a backend that is assumed to expose three endpoints (`schema.backend.endpoints`): `config` (POST the form values), `health` (GET), `debug_stream` (SSE).
- **`UBAPanel`** — fetches a `UBASchema` from a URL, renders the config form, POSTs values to `config`, shows a health badge, tails the `debug_stream` SSE.

In other words, the whole system presupposes a **UBA-protocol server** sitting in front of each backend — the "Erleah AI Agent" reference implementation that phase-6 UBA-005 was going to build (and never did). It is the *admin/config UI* for such a server. It contains no notion of collections, tables, records, relations, or CRUD, and it has zero runtime wiring to Noodl data nodes.

## 2. First contact — proven, not argued

Repo culture here is "don't reason about whether it works, stand it up and run it" (per RUN-002). So: Directus 11 in Docker, seeded with a rich schema (`authors`, `articles` with a M2O relation, a file relation, an enum, a timestamp, an integer, a boolean), driven by the **real** `UBAClient` and `SchemaParser` (esbuild-bundled standalone — both files import only `import type`). Four probes:

| Probe | Call | Result |
|---|---|---|
| 1 | `UBAClient.health('/server/health', {type:'bearer'}, {token})` | ✅ **200, `healthy:true`.** Directus's health endpoint maps cleanly. The one point of real compatibility. |
| 2 | `UBAClient.configure('/configure', …)` | ❌ **404 → `UBAClientError`.** Directus has no config-ingest endpoint. UBA's "POST your config to the backend" model has nothing to talk to. |
| 3 | `SchemaParser.parse(<Directus /collections>)` and `parse(<Directus /fields>)` | ❌ **fails**: `schema_version missing`, `backend missing`, `sections missing`. Directus serves its own metadata format, not a `UBASchema`. **Nothing translates one into the other** — there is no adapter. |
| 4 | Directus `/collections` + `/fields` introspection | Prints exactly the metadata a real adapter needs: per field a `type`, an `interface` (`select-dropdown`, `datetime`, `file-image`, `select-dropdown-m2o`…), FK relations, and enum `choices`. UBA has **no code that reads any of this.** |

Probe 4 is the important one. Directus already hands you, for `articles.status`, `interface: "select-dropdown"` with `choices: [draft, published, archived]` and `default_value: "draft"`; for `articles.author`, a M2O foreign key to `authors`; for `articles.hero_image`, a file relation. This is "pick a table, see the fields" sitting right there in the API — and consuming it is the feature RUN-003 actually wants. It is not written.

## 3. Why this is a premise failure, not a "gap to fill"

The spec's own Risks table anticipates "first real-backend contact reveals significant gaps — *Expected*." But the gap here is not "the abstraction is Directus-shaped and Supabase bends it" (the risk it names). It is the inverse and deeper: **the abstraction is *middleware*-shaped.** It models the config surface of a bespoke UBA server, not the data surface of any real BaaS. So:

- There is **no adapter interface or registry** to "follow an established pattern" from (confirmed by subsystem map + repo grep). The "pattern" the spec assumes exists does not.
- A "Directus adapter" in the current architecture would mean **building a UBA-protocol server that fronts Directus** — a whole separate service per backend, exposing `config`/`health`/`debug_stream` and proxying to Directus's real API. That is the heaviest possible reading and arguably the wrong architecture: the spec's Desired State explicitly wants config-*free* discovery ("without writing configuration by hand"), which is the opposite of a config-form system.
- The genuinely valuable feature — introspect a real backend → schema-aware node experience → CRUD at runtime — requires **net-new** design: an adapter abstraction over native backend APIs, a metadata→node mapping, and runtime data wiring (which point-9 of the subsystem map confirms does not exist anywhere in `noodl-runtime`/`noodl-viewer-react`).

## 4. The decision RUN-003 now needs

The empirical step the spec prescribed has done its job: it "substantially changed the estimate" — really, the shape. Three honest ways forward, for Richard to choose:

**A. Build the real native BaaS data-adapter (fulfil the Desired State).** Introduce an adapter abstraction over backends' *native* APIs (Directus REST first), introspect collections/fields → generate the schema-aware node/CRUD experience `NATIVE-BAAS-INTEGRATIONS.md` describes, and wire it into runtime data nodes. This is what the task's Desired State and success criteria actually describe. It is **core feature construction, multi-week, and beyond the "finishing work / Sonnet-5 / follow a pattern" framing** — it touches runtime data nodes (net-new) and needs real design. The existing config-form UBA becomes at most a small sub-part (adapters that genuinely need user config could reuse it).

**B. Honour the built architecture — build the reference UBA-protocol server (the phase-6 "Erleah" plan).** Keep `UBAClient`/`UBAPanel` as-is and build the missing middleware: a reference UBA server exposing `config`/`health`/`debug_stream` that proxies to Directus. This makes the *existing* code demonstrably work end-to-end and gives a copyable reference. But every backend then needs a bespoke server, users still hand-configure, and it does not deliver "see your real collections and build against them." Lowest-risk to the current code, weakest against the task's stated purpose.

**C. Split the task (recommended).** Do two smaller, honest things instead of one mis-specified big one:
  1. **Make what exists dependable at its real altitude:** add the missing tests for `UBAClient` (health ✓ against real Directus, configure/SSE against a tiny stub UBA server) and document UBA accurately as "a config-form renderer for UBA-protocol backends" — closing the "never pointed at anything / untested" charge honestly.
  2. **Re-scope the native BaaS data-integration (option A) as its own properly-estimated task** in the roadmap, since that — not "finish UBA" — is what "how do I hook up my backend?" actually needs. This is the cleanest match to how this phase has handled stale premises before (RUN-001, RUN-002).

My recommendation is **C**, with the native-BaaS piece (A) as the follow-on task, because it is the only option that both tells the truth about the built code and points the real effort at the feature users actually asked for. But this is a scope-and-priority call, not a technical one, so it is yours.

## 5. What is already banked regardless of the choice

- A reproducible containerised-Directus harness with a rich seed schema ([`uba-e2e/`](./uba-e2e/)) — the spec's step-1 deliverable, reusable by whichever path is chosen.
- Empirical proof of the one real compatibility point (`health`) and the three mismatches (`configure`, schema parse, no introspection consumer).
- The subsystem map (in the RUN-003 working notes / this repo's grep-verifiable state): no adapter interface, no registry, no runtime data-node wiring, tests cover only the two pure modules.

## 6. What stays true from the spec

- "A backend adapter system that has never been pointed at a backend is a hypothesis" — correct, and now it *has* been pointed at one; the hypothesis did not survive.
- "How do I hook up my backend?" being the top user question — still the right north star; option A/C-2 is how you actually answer it.
- Starting with the backend and the test rather than the adapter — correct method; it is exactly what surfaced the premise failure this early, before any adapter code was written.
