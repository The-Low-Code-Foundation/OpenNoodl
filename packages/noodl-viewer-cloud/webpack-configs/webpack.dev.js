// WF-007: see webpack.prod.js — the "viewer" (sandbox) config is retired.
const isolate = require('./webpack.isolate.dev');

module.exports = [isolate];
