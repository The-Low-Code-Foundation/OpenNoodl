/**
 * HLS-015 — finding the deploy engine, and saying so when it is not there.
 *
 * ## 🔴 The published package cannot deploy, on purpose, and this file is where that is admitted
 *
 * `@nodegx/export` translates a project into React source you build yourself. A *deploy* is a
 * different artefact: a ready-to-host static site that carries the ~14.9 MB NodeGX interpreter and
 * runs the graph directly. Producing one needs `ProjectModel`, `NodeLibrary`, the viewer's node
 * register and that interpreter — none of which is in the tarball `npm publish` uploads
 * (`files: ["dist", "README.md"]`), and putting it there would make this package's build depend on
 * the editor's.
 *
 * So `nodegx deploy` is a **front door onto an engine that lives elsewhere**, exactly as
 * `nodegx render` is, and the honest outcome of running it from a bare `npm i -g @nodegx/export`
 * is a refusal that says where it looked. That refusal is the shipped behaviour, not an accident:
 * see {@link ./renderHarness} for the same shape and register row **C72** for what happens when a
 * path resolves in a checkout by coincidence of directory depth and is absent in the artefact.
 *
 * ⚠️ **The engine is a build artifact, so a checkout is not enough either.** It is produced by
 * `npm run build --workspace @noodl/preview` (esbuild, one command) and is gitignored, so the
 * refusal below has to distinguish "you are not in a checkout" from "you are, and have not built
 * it" — those have different fixes and a reader who is told the wrong one goes looking in the
 * wrong place.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ResolvedEngine {
  /** The engine entry point, or `null` when nothing was found. */
  entry: string | null;
  /** Every path tried, in order, whether or not it existed. Printed in the refusal. */
  probed: string[];
  /** Set when `NODEGX_DEPLOY_CLI` was given and pointed at nothing. */
  overrideMissing?: string;
  /**
   * Set when a `packages/noodl-preview` was found next to a *missing* bundle — i.e. this IS a
   * checkout and the only thing wrong is that nobody ran the build.
   */
  unbuiltPackage?: string;
}

/** The environment variable that redirects this, named once. */
export const ENGINE_ENV = 'NODEGX_DEPLOY_CLI';

/** The bundle `packages/noodl-preview/build.mjs` writes for this command. */
const ENGINE_RELATIVE = ['noodl-preview', 'dist', 'nodegx-deploy.cjs'];

/**
 * Locate `nodegx-deploy.cjs`.
 *
 * ⚠️ A `NODEGX_DEPLOY_CLI` that points at nothing is an **error**, never a fall-through to the
 * checkout candidates — the same rule `resolveHarness` follows, for the same reason: setting it is
 * a deliberate act, so a typo in it must say so rather than silently running a different engine
 * from the one the caller redirected to.
 */
export function resolveEngine(fromDir: string = __dirname, env: NodeJS.ProcessEnv = process.env): ResolvedEngine {
  const probed: string[] = [];
  const push = (candidate: string): string | null => {
    probed.push(candidate);
    return fs.existsSync(candidate) ? candidate : null;
  };

  const override = env[ENGINE_ENV];
  if (override) {
    const found = push(override);
    return found ? { entry: found, probed } : { entry: null, probed, overrideMissing: override };
  }

  // Both candidates land on `packages/`: two levels up from `dist/` (the bundle, which is what the
  // `nodegx` bin is) and three from `src/cli/` (ts-jest and `npx tsx`, which is what the specs
  // are). Neither is a fact about an install — in `node_modules/@nodegx/export/dist`, two levels
  // up is `node_modules`, which holds no `noodl-preview`.
  const packageDirs = [path.resolve(fromDir, '..', '..'), path.resolve(fromDir, '..', '..', '..')];

  for (const packages of packageDirs) {
    const found = push(path.join(packages, ...ENGINE_RELATIVE));
    if (found) return { entry: found, probed };
  }

  // Nothing built. Was there a checkout at all? The two fixes are different sentences.
  for (const packages of packageDirs) {
    const previewPackage = path.join(packages, 'noodl-preview', 'package.json');
    if (fs.existsSync(previewPackage)) {
      return { entry: null, probed, unbuiltPackage: path.dirname(previewPackage) };
    }
  }
  return { entry: null, probed };
}

/**
 * The sentence a caller with no engine gets. A refusal that cannot say where it looked sends the
 * reader to guess at a layout, and there are three layouts here.
 */
export function describeMissingEngine(resolved: ResolvedEngine): string {
  if (resolved.overrideMissing) {
    return (
      `${ENGINE_ENV} is set to ${resolved.overrideMissing}, and there is nothing there.\n` +
      "Point it at a checkout's packages/noodl-preview/dist/nodegx-deploy.cjs, or unset it.\n"
    );
  }
  if (resolved.unbuiltPackage) {
    return (
      'The deploy engine has not been built in this checkout.\n' +
      '\n' +
      `Found ${resolved.unbuiltPackage}, but not its bundle. It is a build artifact, not\n` +
      'committed. Build it with:\n' +
      '  npm run build --workspace @noodl/preview\n'
    );
  }
  return (
    'This build of nodegx cannot deploy.\n' +
    '\n' +
    'A deploy writes a ready-to-host site that carries the NodeGX interpreter, which needs the\n' +
    "editor's model engine and the viewer runtime — neither is part of the @nodegx/export package\n" +
    'and neither is installed with it. `nodegx export` needs none of it and works here.\n' +
    '\n' +
    'To deploy, either run this from a NodeGX checkout with the engine built, or set\n' +
    `  ${ENGINE_ENV}=/path/to/NodeGX/packages/noodl-preview/dist/nodegx-deploy.cjs\n` +
    '\n' +
    'Looked in:\n' +
    resolved.probed.map((candidate) => `  ${candidate}\n`).join('')
  );
}
