export * from './CanvasRenderer.test';
export * from './CanvasThemeNodeSchemes.test';
export * from './InteractionController.test';
export * from './NodeSelector.test';
export * from './OverlayHost.test';
export * from './CanvasViewport.test';
export * from './HitTester.test';
export * from './NodeCommentStripe.test';
export * from './WireLabels.test';

// FIX-018: the two marks that say a card is a component instance and can be
// opened — the purple header chip (overriding the hue the component inherited
// from its own root node) and the stacked-card edge bottom-right.
export * from './NodeComponentMark.test';

// BEN-004: the *preview* canvas, not the node graph — which components the
// bench may be pointed at, and what the frame width control does with the
// strings a text input hands back.
export * from './preview-scope.test';

// BEN-002: which control an input gets, what the thing you typed becomes, and
// the one rule that would break something — a bench input is addressed to one
// client and never broadcast at the app preview.
export * from './bench-inputs.test';

// BEN-003: the outputs channel's addressing — arming the trace on one client
// rather than every viewer — and the canvas following the bench.
//
// ⚠️ This barrel is the *only* thing that makes a spec file run. A file added
// to this directory and not exported here is compiled by `typecheck:editor-tests`,
// passes review, and never executes — while the suite stays green and the spec
// count is the tell. See register B18.
export * from './bench-outputs-channel.test';
export * from './bench-outputs.test';

// BEN-005: what a saved scenario is allowed to contain, and what a stale one
// does to a component whose interface has moved on since it was written.
export * from './bench-scenarios.test';

// FIX-011: the per-component default size — the second knowing exception to R5,
// and the only thing besides a scenario save that this surface writes to
// `project.json`. What reaches disk, and what survives coming back off it.
export * from './bench-frame-default.test';
