/**
 * Resolve the *fully expanded* property set of named types in a TypeScript file,
 * using the compiler's own checker.
 *
 * Why the checker rather than reading the syntax: the runtime's React port types
 * are written as `extends Omit<InputPortDefinition, 'set'>`, so their members
 * live in another package. A syntactic comparison would see three declared
 * members and call the mirror complete. The checker walks the heritage chain and
 * reports what an author actually gets, which is the thing this package claims
 * to publish.
 */
const path = require('path');
const ts = require('typescript');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * @param {string} file absolute path to a .ts or .d.ts file
 * @param {string} baseDir the package root, used for module resolution
 * @returns {(names: string[]) => Record<string, { members: Record<string, boolean>, hasStringIndex: boolean }>}
 *   maps interface name -> its members (name -> isOptional) and whether it
 *   declares a string index signature. The index signature is reported
 *   separately because it is *not* a property: a property-set comparison cannot
 *   see it, and it is the one thing this package diverges on deliberately.
 */
function analyse(file, baseDir) {
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.React,
    strict: false,
    noEmit: true,
    skipLibCheck: true,
    baseUrl: baseDir
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(file);
  if (!sourceFile) throw new Error(`could not load ${file}`);

  return function setsFor(names) {
    const out = {};
    for (const statement of sourceFile.statements) {
      if (!ts.isInterfaceDeclaration(statement)) continue;
      const name = statement.name.text;
      if (!names.includes(name)) continue;

      const type = checker.getTypeAtLocation(statement.name);
      const members = {};
      for (const symbol of checker.getPropertiesOfType(type)) {
        members[symbol.name] = (symbol.flags & ts.SymbolFlags.Optional) !== 0;
      }
      out[name] = {
        members,
        hasStringIndex: !!checker.getIndexInfoOfType(type, ts.IndexKind.String)
      };
    }
    const missing = names.filter((n) => !(n in out));
    if (missing.length) throw new Error(`${file} declares no interface named: ${missing.join(', ')}`);
    return out;
  };
}

const SOURCES = {
  /** The React authoring surface. */
  viewer: {
    file: path.join(REPO_ROOT, 'packages', 'noodl-viewer-react', 'src', 'react-component-node.ts'),
    baseDir: path.join(REPO_ROOT, 'packages', 'noodl-viewer-react')
  },
  /** Ports, dynamic ports and the logic-node definition. */
  types: {
    file: path.join(REPO_ROOT, 'packages', 'noodl-types', 'src', 'runtime', 'node-definition.d.ts'),
    baseDir: path.join(REPO_ROOT, 'packages', 'noodl-types')
  },
  /** What this package publishes. */
  published: {
    file: path.join(__dirname, '..', 'src', 'index.d.ts'),
    baseDir: path.join(__dirname, '..')
  }
};

module.exports = { analyse, SOURCES, REPO_ROOT };
