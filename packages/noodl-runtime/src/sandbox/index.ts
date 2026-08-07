/**
 * AIX-008 — Sandbox preview
 *
 * Serving a previewed graph fake data so a missing backend, an empty table or a
 * login wall can never hide what the AI built. The editor assembles the dataset
 * (it has the graph); the runtime serves it (it has the requests).
 *
 * @module noodl-runtime/sandbox
 */

export * from './types';
export * from './synth';
export * from './store';
export * from './responder';
export * from './install';
