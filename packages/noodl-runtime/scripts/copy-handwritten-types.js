/**
 * Copies this package's hand-written `.d.ts` files into `dist-types/`.
 *
 * `tsc --emitDeclarationOnly` emits declarations for `.ts`/`.js` *inputs*; a file that is
 * already a `.d.ts` is an input it has nothing to emit *from*, so it is simply absent from
 * the output tree. Every generated declaration that imports one — `node.d.ts` and
 * `nodecontext.d.ts` both `import type … from './internal'` — is then dangling, and a
 * consumer resolving this package through `dist-types` gets `TS2307`.
 *
 * That failure is invisible to any program with `skipLibCheck: true` (the repo root has
 * it; `noodl-viewer-react` does not), which is why `npm run typecheck` stayed green while
 * `npm run typecheck:viewer` reported 45 errors. Run both.
 *
 * Ambient files (`globals.d.ts`) are copied too. They carry no imports or exports by rule,
 * so they are global declarations — a consumer that pulls one in gets the runtime's
 * ambients, which is exactly right for anything compiling against this package.
 */
const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..');
const sourceRoot = path.join(packageRoot, 'src');
const outputRoot = path.join(packageRoot, 'dist-types', 'src');

/** Every `.d.ts` under `src/`, relative to `src/`. */
function findDeclarations(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      found.push(...findDeclarations(full));
    } else if (entry.name.endsWith('.d.ts')) {
      found.push(path.relative(sourceRoot, full));
    }
  }
  return found;
}

const declarations = findDeclarations(sourceRoot);
for (const relative of declarations) {
  const destination = path.join(outputRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, relative), destination);
}

console.log(`Copied ${declarations.length} hand-written declaration file(s) into dist-types/src.`);
