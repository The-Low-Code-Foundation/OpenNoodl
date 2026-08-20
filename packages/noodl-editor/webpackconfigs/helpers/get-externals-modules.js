const fs = require('fs');
const packageJson = require('../../package');

module.exports = function ({ production }) {
  //some modules are not packaged in the production build to reduce app size
  //make sure webpack bundles those and don't exclude them
  //skip this in dev mode since it slows down the bundling
  function getExcludedNodeModules() {
    return packageJson.build.files
      // `build.files` is not all strings: electron-builder also takes `{from, to, filter}`
      // copy directives, and three of them ship the render harness inside the asar. Those
      // can never be a `!node_modules/…` exclusion, so they are skipped rather than matched
      // — without this, `.match` throws and the PRODUCTION config fails to load at all.
      .filter((pattern) => typeof pattern === 'string')
      .map((pattern) => pattern.match(/\!node_modules\/(.+)/))
      .filter((match) => match !== null)
      .map((match) => match[1]);
  }

  // don't bundle external modules from node_modules
  let externals = [];

  if (fs.existsSync('node_modules')) {
    externals = [...externals, ...fs.readdirSync('node_modules')];
  }

  // When building normally in a monorepo
  if (fs.existsSync('../../node_modules')) {
    externals = [...externals, ...fs.readdirSync('../../node_modules')];
  }

  if (production) {
    // ..except these
    getExcludedNodeModules().forEach((m) => {
      const i = externals.indexOf(m);
      if (i !== -1) externals.splice(i, 1);
    });
  }

  return externals;
};
