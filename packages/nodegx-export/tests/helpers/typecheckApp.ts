/**
 * Typechecks an emitted app, rather than merely parsing it.
 *
 * ## Why this exists (EXP-011 §24.3)
 *
 * Every other emitted-code assertion in this package is a **parse**: `ts.createSourceFile` and a
 * look at `parseDiagnostics`. An undeclared identifier is perfectly good *syntax*, so a component
 * emitting `lastLinkError.set(helpError)` with no `useState` above it parsed cleanly and **all
 * 1054 rows passed**. The defect was found only by building the exported app.
 *
 * This builds a real `ts.Program` over the emitted files and asks for semantic diagnostics, which
 * closes that class — a name that is read and never declared — for the whole package.
 *
 * ## What resolves, and what is declared here instead
 *
 * The program compiles the emitted `src/**` with the `compilerOptions` the scaffold writes into
 * the app's own `tsconfig.json` (`src/emit/scaffold.ts`) — `strict`, `jsx: react-jsx`, bundler
 * resolution — so this is not a laxer dialect than the one `tsc -b` uses on the real app.
 *
 * ⚠️ Two deliberate differences, so this comment is not read as claiming more than it does:
 * `baseUrl`/`paths` are added to reach the types described below, and the scaffold's
 * `types: ['vite/client']` is dropped because Vite is not installed in this repo — what that
 * package would contribute is declared in `AMBIENT_ENV` instead.
 *
 * - **`react`, `react-dom`, `react-dom/client`** resolve for real, against the `@types/react` and
 *   `@types/react-dom` already installed at the repo root.
 * - **`@nodegx/core`** is mapped to `packages/nodegx-core/src`, the **committed source** — not to
 *   its `dist`, which is gitignored and would make this suite's reach depend on whether somebody
 *   had run a build.
 * - **`react-router-dom` and `vite/client`** are declared by `AMBIENT_ENV` below, because the
 *   version the emitted app depends on (`react-router-dom@^7`) is not installed in this repo — the
 *   root has v5, whose API is a different one, and Vite is not installed at all. The
 *   `*.module.css` declaration there is the same loose index signature `vite/client` ships, so it
 *   is not a weakening: Vite does not check class names against the emitted stylesheet either.
 *
 * 🔴 **That last point is this checker's blind spot, and it is deliberate.** Router prop misuse and
 * a wrong `import.meta.env` shape are checked against the declarations below rather than against
 * the real packages, so a drift between them and `react-router-dom@7` would not be caught here.
 * The emitted router surface is seven names wide and scaffold-generated identically for every app;
 * building an exported app remains the instrument that grades it against the real library.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

/** The package root — the virtual files live under it so `node_modules` walk-up finds the real types. */
const PKG_ROOT = path.join(__dirname, '..', '..');
/** A directory that deliberately does not exist on disk: every emitted file is held in memory. */
const VIRTUAL_ROOT = path.join(PKG_ROOT, '__typecheck__');
const CORE_SRC = path.join(PKG_ROOT, '..', 'nodegx-core', 'src');

/**
 * Ambient declarations for the two modules that cannot be resolved for real in this repo.
 *
 * These are typed rather than shorthand-`any` on purpose: `useParams()` answering
 * `string | undefined` per segment is a fact the generator reasons about (`src/emit/component.ts`
 * has a comment about exactly that), so an emission that forgot it should go red here. A
 * shorthand ambient module would make all of it `any` and grade nothing.
 */
const AMBIENT_ENV = `
declare module 'react-router-dom' {
  import type { ComponentType, ReactNode } from 'react';
  export const BrowserRouter: ComponentType<{ children?: ReactNode }>;
  export const Routes: ComponentType<{ children?: ReactNode }>;
  export const Route: ComponentType<{ path?: string; index?: boolean; element?: ReactNode }>;
  export const Navigate: ComponentType<{ to: string; replace?: boolean }>;
  export function useNavigate(): (to: string | number, options?: { replace?: boolean; state?: unknown }) => void;
  export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T;
  export function useSearchParams(): [
    URLSearchParams,
    (next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void
  ];
}

interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.css' {}
`;

/**
 * The scaffold's own `compilerOptions`, in the API's enum form.
 *
 * ⚠️ Keep this in step with `tsConfig()` in `src/emit/scaffold.ts`. `tests/scaffold.test.ts`
 * asserts the emitted JSON; this is the same settings expressed for `ts.createProgram`, and a
 * divergence would mean this suite grades a dialect the app is never compiled in.
 */
const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  useDefineForClassFields: true,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  isolatedModules: true,
  baseUrl: VIRTUAL_ROOT,
  paths: {
    '@nodegx/core': [path.join(CORE_SRC, 'index.ts')],
    '@nodegx/core/react': [path.join(CORE_SRC, 'react.ts')]
  }
};

const AMBIENT_FILE = path.join(VIRTUAL_ROOT, '__env__.d.ts');

/** A formatted diagnostic: `TS2304 src/App.tsx:12: Cannot find name 'helpError'.` */
export type TypecheckDiagnostic = string;

/**
 * Runs the compiler over an emitted app's `src/**` TypeScript and returns its diagnostics.
 *
 * Only files under `src/` are compiled, because that is exactly what the emitted
 * `tsconfig.json` includes — `vite.config.ts` sits outside it and is built by Vite's own pass.
 *
 * `overrides` replaces or adds file contents after emission, which is how the suite's own control
 * arm injects a defect: a checker that never goes red is not a checker, and there is a row that
 * proves this one does.
 */
export function typecheckEmittedApp(
  app: { files: Record<string, string> },
  overrides: Record<string, string> = {}
): TypecheckDiagnostic[] {
  const files: Record<string, string> = { [AMBIENT_FILE]: AMBIENT_ENV };
  for (const [name, source] of Object.entries(app.files)) {
    if (!name.startsWith('src/')) continue;
    if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue;
    files[path.join(VIRTUAL_ROOT, name)] = source;
  }
  for (const [name, source] of Object.entries(overrides)) {
    files[path.join(VIRTUAL_ROOT, name)] = source;
  }

  const libDir = path.dirname(ts.getDefaultLibFilePath(OPTIONS));
  const inMemory = (f: string) => Object.prototype.hasOwnProperty.call(files, f);
  const read = (f: string) => (inMemory(f) ? files[f] : fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined);

  const host: ts.CompilerHost = {
    fileExists: (f) => inMemory(f) || fs.existsSync(f),
    readFile: read,
    getSourceFile: (f, languageVersion) => {
      const source = read(f);
      if (source === undefined) return undefined;
      return ts.createSourceFile(f, source, languageVersion, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : undefined);
    },
    getDefaultLibFileName: () => path.join(libDir, 'lib.es2020.d.ts'),
    getDefaultLibLocation: () => libDir,
    writeFile: () => {},
    getCurrentDirectory: () => VIRTUAL_ROOT,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    // 🔴 Both of these must know about the in-memory tree. Module resolution prunes a directory it
    // believes does not exist *before* it ever asks `fileExists`, so leaving these to read only
    // from disk reports `TS2307 Cannot find module './client'` for a file that was emitted — a
    // finding about the checker rather than about the emission.
    directoryExists: (dir) => {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      return Object.keys(files).some((f) => f.startsWith(prefix)) || fs.existsSync(dir);
    },
    getDirectories: (dir) => {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      const names = new Set<string>();
      for (const f of Object.keys(files)) {
        if (!f.startsWith(prefix)) continue;
        const rest = f.slice(prefix.length);
        if (rest.includes(path.sep)) names.add(rest.split(path.sep)[0]);
      }
      if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory()) names.add(entry.name);
      }
      return [...names];
    }
  };

  const program = ts.createProgram(Object.keys(files), OPTIONS, host);
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...program.getGlobalDiagnostics()
  ];

  return diagnostics.map((d) => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    if (!d.file || d.start === undefined) return `TS${d.code}: ${message}`;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    const where = path.relative(VIRTUAL_ROOT, d.file.fileName);
    return `TS${d.code} ${where}:${line + 1}: ${message}`;
  });
}
