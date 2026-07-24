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
