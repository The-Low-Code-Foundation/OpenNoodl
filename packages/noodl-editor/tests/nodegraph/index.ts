export * from './basicnodetype-label.spec';
export * from './canvas-characterisation.spec';
export * from './conflictwarnings';
export * from './createnewnode';
export * from './createstatus';
export * from './explain-selection.spec';
export * from './extract-to-component.spec';
export * from './export';
export * from './hierarchy';
export * from './nodegrapheditor';
export * from './nodegraphmodel';
export * from './nodelibrary-spec';
export * from './propertyeditor';
export * from './selectionactions-readonly.spec';
export * from './typechangepropagation';
export * from './warnings-model-spec';
export * from './paste-carries-labels-and-comments.spec';

// The Ports tab's live-value read-out: which ports are asked about, and what a
// `portValues` reply is allowed to put on a row.
//
// ⚠️ This barrel is the *only* thing that makes a spec file run. A file added to
// this directory and not exported here is compiled by the typecheck, passes
// review, and never executes — while the suite stays green.
export * from './port-values.spec';

// FIX-007 fix 4: ports arriving from the viewer clear a `con-no-*-port` warning
// in ~50 ms instead of ~2 s, and only when there is one to clear.
export * from './urgent-health-pass.spec';

// DEF-028 (P77 D13): the export filter settles connection health before it reads
// it, so two builds of one project cannot differ.
export * from './def-028-build-determinism.spec';
