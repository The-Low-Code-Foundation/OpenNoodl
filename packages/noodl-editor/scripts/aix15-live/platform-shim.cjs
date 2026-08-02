/**
 * A `@noodl/platform` that works in a terminal.
 *
 * The other modes of this harness never touch the platform layer, so it was
 * stubbed with a noop Proxy. The `sandbox` mode does: it constructs a real
 * `ProjectModel` to build the preview export from, and `ProjectModel`'s import
 * graph reaches `BugTracker`, which computes a log path from
 * `platform.getUserDataPath()` and appends to it **at module scope**. A Proxy
 * cannot stand in for that, for a reason worth recording: esbuild's
 * `__toESM` interop copies a CJS module's *own enumerable keys*, and a Proxy
 * whose only trap is `get` has none — so every named import from a proxied
 * module arrives as `undefined`.
 *
 * So this is a real module with real values, deliberately small: enough for the
 * editor code that runs headlessly, and nothing that would let a harness run
 * quietly write somewhere it should not. Everything unlisted answers as a noop
 * function, which is what the proxy was for.
 */

const nodePath = require('path');
const os = require('os');
const fs = require('fs');

const noop = () => undefined;

/** A scratch directory of our own — never the editor's real user data. */
const USER_DATA = nodePath.join(os.tmpdir(), 'nodegx-aix15-live');
fs.mkdirSync(nodePath.join(USER_DATA, 'debug'), { recursive: true });

const filesystem = {
  join: (...parts) => nodePath.join(...parts),
  dirname: (p) => nodePath.dirname(p),
  basename: (p) => nodePath.basename(p),
  resolve: (...parts) => nodePath.resolve(...parts),
  exists: async (p) => fs.existsSync(p),
  existsSync: (p) => fs.existsSync(p),
  isDirectory: async () => false,
  makeDirectory: async (p) => fs.mkdirSync(p, { recursive: true }),
  readFile: async (p) => fs.readFileSync(p, 'utf8'),
  readFileSync: (p) => fs.readFileSync(p, 'utf8'),
  readJson: async (p) => JSON.parse(fs.readFileSync(p, 'utf8')),
  writeFile: async () => undefined,
  writeFileSync: noop,
  appendFile: async () => undefined,
  removeDirRecursive: async () => undefined,
  listDirectory: async () => []
};

const platform = {
  name: 'node',
  os: process.platform === 'darwin' ? 'darwin' : process.platform,
  getUserDataPath: () => USER_DATA,
  getDocumentsPath: () => USER_DATA,
  getAppPath: () => USER_DATA,
  getTempPath: () => USER_DATA,
  getVersion: () => '0.0.0',
  getVersionWithTag: () => '0.0.0',
  getBuildNumber: () => '0',
  isRunningLocally: () => true,
  openExternal: noop,
  copyToClipboard: noop
};

/**
 * Answers `{}` rather than `undefined`: `EditorSettings.fetch()` reads
 * `local.settings` off whatever comes back, and an undefined there is an
 * unhandled rejection that takes the process down after the run has finished.
 */
const JSONStorage = {
  get: async () => ({}),
  set: async () => undefined,
  remove: async () => undefined
};

module.exports = new Proxy(
  { platform, filesystem, JSONStorage, setPlatform: noop, setFileSystem: noop, setStorage: noop },
  {
    get: (target, prop) => (prop in target ? target[prop] : function shimmed() {}),
    has: () => true
  }
);
