export * from './CanvasRenderer.test';
export * from './CanvasThemeNodeSchemes.test';
export * from './InteractionController.test';
export * from './NodeSelector.test';
export * from './OverlayHost.test';
export * from './CanvasViewport.test';
export * from './HitTester.test';
export * from './NodeCommentStripe.test';
export * from './WireLabels.test';

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
