/**
 * HLS-015 — the deploy engine, headless.
 *
 * `nodegx deploy` is a front door; this is the room behind it. It calls the editor's **real**
 * `deployToFolder` — the same function the editor's *Deploy to folder* dialog calls — in a plain
 * Node process, and then reads the folder it wrote to decide whether that folder is an app.
 *
 * ## 🔴 Why this lives in `noodl-preview` and not in `@nodegx/export`
 *
 * `@nodegx/export` translates a project into React source and is a pure-format program: it has no
 * `ProjectModel`, no `NodeLibrary`, no viewer. A deploy needs all three plus the ~14.9 MB
 * interpreter, and HLS-013 measured what happens when the editor's model graph is pulled into
 * another package's type program — **201 type errors and a renderer view module in a server
 * bundle**. So the `nodegx` binary keeps one front door and dispatches into this bundle, which is
 * built exactly the way `nodegx serve`'s preview harness is and already carries every shim that
 * makes the editor's export path Electron-free.
 *
 * ## 🔴 The failure this file exists to prevent
 *
 * Register row **C67**: with an unpopulated `NodeLibrary`, `exportComponent` pushes a component
 * root only `if (n.type.allowAsChild)`, so **every `roots` array exports empty** — and
 * `ComponentInstanceNode.render()` returns `null` when `roots` is empty. `deployToFolder`
 * resolves, writes all eight files and logs `copied 0 project file(s)` **identically to a good
 * run**. The person gets a blank page and a success message.
 *
 * Two different instruments answer that here, deliberately, because they fail in different
 * directions:
 *
 *   1. **The cause.** {@link bootstrapNodeLibrary} throws when the register comes back empty. That
 *      catches the one way C67 is known to happen and catches it before a byte is written.
 *   2. **The consequence.** {@link readDeployedRoots} reads the folder that was actually written
 *      and counts the components that carry a root. That catches *any* cause, including the next
 *      one, and it is a reading of the artefact rather than of the code that made it.
 *
 * ⚠️ **Do not grade this with a connection count.** HLS-010 measured **93/93 in both arms**:
 * 21 components, 375 nodes, byte-comparable everywhere except `roots`. `dev-docs/tasks/
 * phase-83-behind-a-click/hls010-spike/measure-deploy.js` keeps its own independent copy of the
 * `roots` read for exactly that reason — it is the control this file is graded against, so the
 * duplication is the point rather than an oversight.
 *
 * @module noodl-preview/deploy
 */

// Must be first, and in this order: binds `@noodl/platform` to the Node implementation and
// populates the node register before any editor module is touched. See headless.ts.
//
// 🔴 **The bare import is load-bearing and the named one does not replace it.** `./headless`'s
// value is mostly its side effects — it imports the dom shim and `@noodl/platform-node`, and
// several editor modules read `platform.getUserDataPath()` at module scope. esbuild drops an
// import whose bindings are all unused, so with only the named form, the day somebody stops
// calling `bootstrapNodeLibrary()` the platform binding leaves the bundle with it. Measured, not
// feared: writing HLS-015 AC2's mutant did exactly that, and the bundle died at module load with
// `Cannot read properties of undefined (reading 'join')` from an `EditorSettings` static
// initialiser — a sentence that names neither the platform nor the import that was dropped.
import './headless';
import * as fs from 'fs';
import * as path from 'path';

import { ProjectModel } from '@noodl-models/projectmodel';
import { setExternalFolderPath } from '@noodl-utils/compilation/build/deploy-index';
import { deployToFolder } from '@noodl-utils/compilation/build/deployer';

import { gradeRoots, readDeployedRoots, type RootsReading } from './deployReading';
import { bootstrapNodeLibrary } from './headless';
import { readProjectForDeploy, resolveTarget, type ProjectFormat } from './loader';
import { describeDevelopmentEngine, readViewerBuild, type ViewerBuildReading } from './viewerBuild';

/**
 * The editor's runtime folder, addressed from **this file** rather than from the working
 * directory — register row C68.
 *
 * `getExternalFolderPath()` is `platform.getAppPath() + 'src/external'`, and `@noodl/platform-node`
 * resolves `getAppPath()` to `process.cwd()` when that folder holds a `package.json`. So the same
 * binary deploying the same project completes from `packages/noodl-editor` and throws
 * `ENOENT … /src/external/deploy/index.json` from anywhere else. Since this bundle's location on
 * disk is a fact about the install and the caller's working directory is not, the path is computed
 * here and handed to the editor through {@link setExternalFolderPath}.
 *
 * ⚠️ `../..` from `dist/` and from `src/` both land on `packages/`, which is why one expression
 * serves the bundle and the specs. That is a coincidence of depth of exactly the kind C72 was —
 * and it is safe here only because both are inside the checkout. A published package resolves it
 * to somewhere that does not exist, {@link assertDeployRuntime} says so, and the refusal is the
 * shipped behaviour rather than a crash.
 */
export { gradeRoots, readDeployedRoots } from './deployReading';
export type { RootsReading } from './deployReading';
export { classifyViewerBuild, readViewerBuild, summariseViewerBuild } from './viewerBuild';
export type { ViewerBuildReading } from './viewerBuild';

export const EXTERNAL_DIR = path.resolve(__dirname, '../../noodl-editor/src/external');

/** The deploy runtime's own manifest. Its absence is what "this build cannot deploy" means. */
export const DEPLOY_INDEX = path.join(EXTERNAL_DIR, 'deploy', 'index.json');

/**
 * Whether the viewer runtime this deploy copies is present.
 *
 * It is a **build artifact** (`npm run build:editor:_viewer`) and gitignored, so a fresh checkout
 * has none — which is a different sentence from "your project is broken" and gets a different one.
 */
export function assertDeployRuntime(): void {
  if (!fs.existsSync(DEPLOY_INDEX)) {
    throw new Error(
      `The deployed viewer runtime is missing from ${EXTERNAL_DIR} (deploy/index.json).\n` +
        'It is a build artifact, not committed. Build it with:\n' +
        '  npm run build:editor:_viewer'
    );
  }
}

/**
 * EXP-017 — the viewer bundle a deploy copies verbatim into the folder somebody uploads.
 *
 * Addressed from {@link EXTERNAL_DIR}, which is this bundle's own location, so it is the file this
 * engine would actually publish — including when `NODEGX_DEPLOY_CLI` pointed the command at a
 * different checkout's engine, whose bundle this is and whose history the calling process has no
 * way to read.
 */
export const VIEWER_BUNDLE = path.join(EXTERNAL_DIR, 'deploy', 'noodl.deploy.js');

/**
 * EXP-017 AC3 — what kind of build the viewer bundle on disk is, read from the bundle.
 *
 * Separate from {@link deployProject} so the front door can report it on every run without a
 * deploy having happened, and so a spec can point it at a fixture.
 */
export function readDeployEngine(bundlePath: string = VIEWER_BUNDLE): ViewerBuildReading {
  return readViewerBuild(bundlePath);
}

/**
 * EXP-017 AC2 — thrown before a byte is written when the engine on disk is a development build.
 *
 * 🔴 **Before the write, not after it.** The whole defect is a folder that is fit to upload in
 * every respect a person checks and carries 9.88 MB of NodeGX source in the one file nobody opens.
 * A refusal that arrives after the folder exists has already produced the artefact it is warning
 * about, and the next thing that happens to a folder full of a working site is that somebody
 * uploads it.
 *
 * Carries the reading rather than only a sentence: the front door prints the same three readings
 * on a refusal that it prints on a success, and re-deriving them from the message is how those two
 * drift apart.
 */
export class DevelopmentEngineError extends Error {
  constructor(readonly engine: ViewerBuildReading, flag: string) {
    super(describeDevelopmentEngine(engine, flag));
    this.name = 'DevelopmentEngineError';
  }
}

/** The flag that ships a development engine knowingly. Named once; the refusal quotes it. */
export const ALLOW_DEV_ENGINE_FLAG = '--allow-development-engine';

/** Everything `nodegx deploy` needs to know about a run that finished. */
export interface DeployOutcome {
  outDir: string;
  projectName: string;
  format: ProjectFormat;
  /** Node types the register supplied. Zero is impossible — `bootstrapNodeLibrary` throws first. */
  nodeTypes: number;
  /** Project files copied verbatim into the output (`noodl_modules`, images, anything unignored). */
  copied: number;
  /** Paths the copy step deliberately left behind, with the rule that excluded each. */
  excluded: { path: string; rule: string; reason?: string }[];
  /** Entries written at the top level of the output folder. */
  files: string[];
  /**
   * HLS-014 — every out-dir-relative path this deploy wrote, from the deployer itself.
   *
   * 🔴 Not a listing of the folder. On a second deploy into the same folder the listing holds this
   * run's files AND the previous run's, under different content-hashed names, and nothing in a
   * listing says which is which. This is what lets `nodegx deploy` remove what its own previous
   * deploy left rather than either leaving it served or guessing.
   */
  written: string[];
  roots: RootsReading;
  /** The refusal, when the folder that was written would render nothing. */
  blank: string | null;
  /** EXP-017 AC1 — which build of the viewer this deploy copied, read from the file it copied. */
  engine: ViewerBuildReading;
  warnings: string[];
}

/**
 * Deploy one project directory into one output folder.
 *
 * Throws a plain `Error` with a sentence for every cause the caller can fix. The caller turns
 * that into an exit code; this never calls `process.exit`.
 */
export async function deployProject(options: {
  projectDir: string;
  outDir: string;
  baseUrl?: string;
  /**
   * EXP-017 AC2 — publish a development viewer build anyway. Off by default, and the default is
   * the point: the dev build is what is on disk in every checkout where `npm run dev` has run.
   */
  allowDevelopmentEngine?: boolean;
}): Promise<DeployOutcome> {
  assertDeployRuntime();

  // 🔴 EXP-017 AC2 — FIRST, before `resolveTarget`, before the node library, and above all before
  // anything writes. Reading 15 MB costs milliseconds; a folder that exists costs an upload.
  const engine = readDeployEngine();
  if (engine.kind === 'development' && !options.allowDevelopmentEngine) {
    throw new DevelopmentEngineError(engine, ALLOW_DEV_ENGINE_FLAG);
  }

  // 🔴 C68. Stated before anything reads it, and stated from this file's own location — see
  // EXTERNAL_DIR. Without this line the run below depends on the caller's working directory.
  setExternalFolderPath(EXTERNAL_DIR);

  const { dir, format } = resolveTarget(options.projectDir);
  const nodeTypes = bootstrapNodeLibrary();

  const { project, warnings } = readProjectForDeploy(dir, format);

  // 🔴 C69. `doWriteProjectToDisk` short-circuits on this flag, and without it *reading* a project
  // in order to deploy it can rewrite every component file on disk from a process the author never
  // opened — which is what C63 was on the cloud path. This path mutates no model today and so
  // schedules no save; that is a property of what it happens not to do, not a guarantee, and one
  // line is cheaper than finding out when it changes.
  project._isReadOnly = true;

  let copyReport;
  let written: string[];
  try {
    ({ copyReport, written } = await deployToFolder({
      project,
      direntry: options.outDir,
      environment: undefined,
      baseUrl: options.baseUrl ?? '/'
    }));
  } catch (error) {
    // 🔴 `deployToFolder` rejects TWO ways and they do not share a type. Its own refusals are
    // plain objects (`{ result: 'failure', message: 'Cannot deploy to a project folder.' }`) and
    // everything underneath is an `Error`. A caller that only reads `.stack` gets `undefined` for
    // the refusal that a person is most likely to provoke.
    const message =
      error instanceof Error ? error.message : (error as { message?: string })?.message ?? JSON.stringify(error);
    throw new Error(message);
  }

  const roots = readDeployedRoots(options.outDir);
  return {
    outDir: options.outDir,
    projectName: project.name ?? path.basename(dir),
    format,
    nodeTypes,
    copied: copyReport.copiedCount,
    excluded: copyReport.excluded.map((file) => ({
      path: file.path,
      rule: file.rule,
      reason: file.reason
    })),
    files: fs.readdirSync(options.outDir).sort(),
    written: written.slice().sort(),
    roots,
    blank: gradeRoots(roots),
    engine,
    // EXP-017 AC4 — a duplicate the copy step could not leave out reaches the person through the
    // same channel every other deploy warning does, rather than only the editor's console.
    warnings: [
      ...warnings,
      ...copyReport.duplicatesKept.map(
        (kept) =>
          `${kept.path} (${kept.bytes} B) is the same file as ${kept.keep} and both were published — ` +
          `${kept.reason}. Point that reference at ${kept.keep} to stop shipping it twice.`
      )
    ]
  };
}
