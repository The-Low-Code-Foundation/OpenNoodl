// `cloudstore.js` requires the runtime singleton for three pieces of project
// metadata — `cloudservices`, `dbVersionMajor` and the collection schema cache.
// BCN-002's driver stubs it so the REAL `CloudStore` and the REAL `records.js`
// can run headless against a live backend.
//
// Separate from `stub-noodl-runtime.js`, which serves `byob-utils`'
// `backendServices` and would answer `undefined` for everything this needs.
const store = {
  cloudservices: undefined,
  dbVersionMajor: undefined,
  dbCollections: [],
  systemCollections: []
};

module.exports = {
  instance: {
    getMetaData: (k) => store[k],
    __setMeta: (k, v) => {
      store[k] = v;
    }
  }
};
