# EL-002 — The learning kit

| Field | Value |
|---|---|
| **Tier** | 1 |
| **Effort** | L |
| **Surface** | `kit`, `runtime`, `catalog` |
| **Rulings** | **D2** (vocabulary — blocks port/node naming) · **D3** (SCORM 1.2 first, xAPI native always) · **D4** (in-repo source, starter-assets install) |
| **Depends on** | P69's kit substrate (built); EL-009 for multi-page verification of the demo course |

## The job

The logic layer of the whole phase, as a plain-files kit (`manifest.json` + `index.js`, no build
step — the P69 contract), namespaced `nodegx.learn.*`:

- **Emit xAPI Statement** (logic node): actor/verb/object/result in, a conformant statement out to
  the configured LRS endpoint (fetch; `navigator.sendBeacon` for unload-time sends). Endpoint +
  auth are course-level configuration, not per-node retyping.
- **Report Progress** (logic node) — **the transport adapter, and the design centre of the kit**:
  one node, three transports, resolved at runtime in order — a discovered SCORM `window.API`
  (frame-walk, per the standard) → a configured xAPI LRS → local storage. Authors wire progress
  *once*; where it lands is a deployment fact, not an authoring fact.
- **Quiz engine, data-driven**: a **question bank is rows** (Static Data or backend table), not
  slides — question-type components render rows, a **Score** node grades responses, and the bank
  shape supports pooling/randomisation. This is the deliberate divergence from Storyline (where a
  question is a slide) and it is what makes item-level xAPI analytics free.
- **Course State / completion**: tracks visited/completed activities, exposes completion and score
  as outputs the templates wire to Report Progress.

The kit's **source of truth lives in this repository, in a gated package**, and is copied into
projects by EL-001's D4 step. A demo course project ships as its test fixture and caller.

## Acceptance criteria

1. The kit passes the full P69 surface: real extractor registers every node, `validate:project`
   reads 0 errors **with the checks demonstrably running** (the CN-004 lesson — assert a planted
   wrong parameter draws a diagnostic, or the zero is unmeasured), picker shows the nodes **under
   the kit's name** (CN-018), and the AI vocabulary carries each node's `docs` prose.
2. **xAPI conformance, measured not asserted**: statements land in a real LRS (a local LRS
   container is fine) and pass its validation; actor/verb/object/result/context are checked
   against the spec's requirements, not against our own serializer.
3. **All three transports driven, each with the discriminator stated first**: (a) a harness page
   exposing a fake SCORM 1.2 `API` sees `LMSSetValue`/`LMSCommit` with correct CMI keys; (b) with
   an LRS configured and no API, statements arrive there; (c) with neither, local state survives a
   reload. Each drive names what would be observably different if the transport silently fell
   through to the next one.
4. **The question bank is a bank**: the same quiz component, pointed at a 10-row bank with
   pool-of-5 + shuffle, produces different draws across runs (seeded assertably), grades
   correctly, and emits one statement per item answered.
5. **Build the caller**: the demo course exercises every node the way EL-003/EL-004 will, and is
   the kit's regression fixture — a kit change that breaks the demo course goes red in this repo.
6. The package is **in every gate that should see it**: all four registrations plus the lockfile
   (`a-package-in-no-gate-runs-no-tests`; `npm ci` rejects a missing lockfile registration).

## Traps

- 🔴 **Name shadowing is a precedence split**: the runtime gives a colliding *kit* priority, the
  catalog/validation gives the *built-in* priority — validation would check one node while the app
  runs another. The `nodegx.learn.*` namespace is the defence; an AC-level grep asserts no type
  name collides with the 175+ built-ins.
- 🔴 **The kit is browser-only by design, and the docs must say so**: the cloud runtime has **no
  kit loader** — a cloud function using a kit node *hangs* (CN-012, measured; timeout, not error).
  EL-007's server-side logic must not import these nodes. And do **not** declare
  `runtimes: ["cloud"]` ever — the field's only positive value removes the kit from every runtime
  (CN-012). Leave `runtimes` undeclared.
- ⚠️ **SSR/SSG is unproven for kits** (CN-013 open). Until it closes, courses deploy CSR — EL-005
  enforces this at the SCORM door; the kit README states it.
- ⚠️ **Nodes appear in the picker only after a preview has run the kit once** (D3: node lists are
  the running viewer's gift). The create-flow UX must not promise nodes at creation time; the
  first-preview moment is where they arrive.
- ⚠️ **CORS and mixed content are the real xAPI constraints** — kit JS is unsandboxed with full
  page access (measured; shipped kits already `fetch`), so failures will be browser policy, not
  ours. The LRS-endpoint docs must cover CORS headers and https.
- ⚠️ A kit's `docs` field is **prose, not a URL** (CN-008) — write the prose; don't paste links
  and expect them to render.
- ⚠️ `runOnValueChange` declares the port and wires nothing — the governed input's `set` must ask
  `shouldRunOnValueChange` (CN-012's own first kit got this wrong; the types now declare it).
- ⚠️ SCORM commit discipline: `LMSFinish`/commit on teardown must use `pagehide`/`visibilitychange`
  + `sendBeacon`-style delivery — an `unload` handler that fetches loses data silently.

## Out of scope

- SCORM *packaging* (manifest, zip, adapter injection into the page) — EL-005. This task's SCORM
  surface is the client-side transport only, driven against a fake API harness.
- Visual slide components — templates (EL-003/EL-004), per P2.
- An authoring UI for question banks — v1 banks are edited as data (Static Data node or table);
  a bank editor is a follow-on.
- LRS storage — EL-006 provides the LRS-lite; this task only needs *an* endpoint to hit.
