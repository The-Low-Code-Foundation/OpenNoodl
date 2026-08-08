// AIX-001: provider-agnostic AI client. No spec here makes a network call —
// the HTTP providers take an injected `fetch` and the Anthropic provider takes
// an injected SDK client.
export * from './models.test';
export * from './stream-utils.test';
export * from './anthropic-provider.test';
export * from './openai-provider.test';
export * from './ollama-provider.test';
export * from './client.test';

// AIX-004: explain mode. Context assembly runs over the real project corpus;
// the one spec that drives a response stubs the client.
export * from './explain-context.test';
export * from './explain-session.test';

// AIX-002: the authoring loop. Fully offline — the chat function is a script;
// the validation gate runs against the real project corpus.
export * from './authoring-candidate.test';
export * from './authoring-validate.test';
// AIB-001: the parameter-value contract — the gate rejects a value the editor
// cannot consume, and the repair loop fixes it inside the session.
export * from './authoring-parameter-values.test';
export * from './authoring-session.test';
export * from './authoring-staging.test';
export * from './authoring-partial.test';
// AAQ-011 F6: what a streamed submission costs the main thread — publishes are
// bounded by the component, not by the stream, and the scan is resumable.
export * from './aaq011-publish-cost.test';
export * from './authoring-preview.test';
export * from './authoring-telemetry.test';

// AIX-006: the style vocabulary — export/shape, candidate lint, and the loop's
// one-shot advisory style pass. Fully offline; the chat function is a script.
export * from './authoring-style.test';

// AIX-007: token cost reduction. Request shape (where cache breakpoints land),
// cache pricing arithmetic, and the stable-first ordering the caching depends
// on. Whether the cache is hit is a live question — the harness asserts that.
export * from './aix007-cost.test';

// AIX-003: graph-native review. The change-set adapter expresses staged AI
// proposals through SUB-007's diff engine; specs diff against components
// accepted through the real staging path.
// AIX-008: the sandbox preview — what data the graph expects, and the export a
// preview window is fed (which must never touch the project).
export * from './authoring-sandbox.test';

// BEN-001: the component bench's harness — the synthetic parent that gives a
// root-mounted component's `Component Inputs` ports a source, which is the one
// thing the sandbox preview could never do.
export * from './component-bench.test';

// BEN-006 §2: the data editor's rules about values — table and JSON edit one
// value, a number typed into a text cell stays a number, unparseable text is
// kept rather than thrown away.
export * from './sandbox-data-draft.test';

// AIX-009: project context documents. The text transforms, path containment,
// context charging, the cache-stable ordering the doc blocks must keep, and the
// model's disk behaviour (including the external-edit clobber guard).
export * from './project-docs.test';

export * from './authoring-changeset.test';
export * from './authoring-review.test';
export * from './authoring-apply.test';

// AIX-011: project-scope authoring. The plan model + planning session +
// orchestrator (scripted chat, corpus graph), and the plan transaction —
// including criterion 4's byte-for-byte real-file undo comparison.
export * from './authoring-plan.test';
export * from './authoring-plan-staging.test';

// AAQ-011 F12 (editor half): what the AI write path allocates for node ids, and
// what the apply path does with them. The register row was filed as a question
// — the editor has four `rekeyAllIds()` callers — and this is the measurement
// that answers it against a real `ProjectModel`.
export * from './authoring-node-ids.test';

// AAQ-005 criterion 3: a scripted multi-component session (no model) — a page
// and two sections it instantiates, plus a design-token write, applied as one
// changeset and undone as one group.
export * from './authoring-multi-component.test';

// AIX-011 criterion 7: the doc-authoring turn (scripted chat), the
// graph-restatement lint that keeps AIX-009's design line mechanical, and the
// plan doc write path on real files.
export * from './authoring-doc-session.test';

// AIX-011 live-provider residuals: an update session must be judged against the
// component it revises — the missing-component-id structural dead end, and the
// pre-existing unknown-type errors that made an agent retype module nodes.
export * from './authoring-update-baseline.test';

// …and the write-path half of the same fix: the backfilled component id, saved
// through `project.toDirectory` and compared as bytes after one undo.
export * from './authoring-update-idless.test';
export * from './plan-doc-writer.test';

// AIX-010: project review & docs retrofit. The page map (from Router/Page node
// parameters, not the routes file), the selection rule, the coverage record the
// prompt and the panel share, the drafting turn's two advisory passes, and
// criterion 7's byte-for-byte real-file comparison after rejecting everything.
export * from './project-review.test';

// AIX-010 residuals: what the backend summary reports when a backend really
// exists (verified against a live nodegx-backend, and against credential
// disclosure), and the banner's per-instance listener context — it is mounted
// twice and the two mounts used to unsubscribe each other.
export * from './project-review-backend.test';
export * from './project-review-banner.test';

// The other consumer of the same schema read: the Read/Write Database
// templates. "No collections" and "could not read the collections" must not
// render alike — a model told the first invents names.
export * from './database-schema.test';

// AIX-012: AI project creation. The scoping conversation (scripted chat), the
// plan it derives from the agreed pages, the four documents it renders, and
// the write path on real files — including criterion 5's mechanical half:
// the CONVENTIONS.md written at creation is what the context builder hands the
// authoring loop.
export * from './project-scoping.test';

// AIB-005: the handoff the launcher makes and the editor never mentioned. One
// predicate over two homes for the same fact — the launcher's module state
// before the Build panel mounts, `PlanSessionStore` after it has taken it.
export * from './scope-plan-announcement.test';
