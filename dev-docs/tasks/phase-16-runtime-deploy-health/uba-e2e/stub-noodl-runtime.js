// byob-utils requires NoodlRuntime for resolveBackend; stub with injectable metadata
const store = { backendServices: null };
module.exports = { instance: { getMetaData: (k) => store[k], __setMeta: (k, v) => { store[k] = v; } } };
