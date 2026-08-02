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
export * from './authoring-session.test';
export * from './authoring-staging.test';
export * from './authoring-partial.test';
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

// AIX-011 criterion 7: the doc-authoring turn (scripted chat), the
// graph-restatement lint that keeps AIX-009's design line mechanical, and the
// plan doc write path on real files.
export * from './authoring-doc-session.test';
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

// AIX-012: AI project creation. The scoping conversation (scripted chat), the
// plan it derives from the agreed pages, the four documents it renders, and
// the write path on real files — including criterion 5's mechanical half:
// the CONVENTIONS.md written at creation is what the context builder hands the
// authoring loop.
export * from './project-scoping.test';
