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
