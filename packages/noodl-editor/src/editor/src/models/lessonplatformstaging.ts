/**
 * Where a platform lesson is staged on this machine, and the filesystem it is staged with.
 *
 * ## Why this is its own module
 *
 * FIX-027 §20 gave `lessonplatforminstall.resetLessonFromPlatform` its first caller, and that
 * caller is the **launcher** (`ProjectsPage.performLessonReset`) rather than the community
 * panel that installs. Both need the identical staging root and the identical `StagingFs`, and
 * the second copy is the one that goes wrong: these two functions decide *where files are
 * written and deleted on a learner's disk*, so a root that drifted by one path segment would
 * leave the other surface's staging directories behind forever, and a root that drifted **into**
 * the Learning folder would show half-installed lessons in the launcher (see below).
 *
 * `lessonplatforminstall` deliberately takes both as injected dependencies so it can be specced
 * against an in-memory filesystem, which is right and is why they cannot live there. They live
 * here instead, and every real caller gets them from one place.
 *
 * ⚠️ `require` rather than `import` for the Node built-ins, matching the call site this was
 * lifted from: this module is reachable from the renderer bundle and the two are not
 * interchangeable there.
 *
 * @module noodl-editor/models/lessonplatformstaging
 */

import type { StagingFs } from './lessonplatforminstall';

/**
 * The staging root.
 *
 * ⚠️ **Beside the Learning folder and never inside it.** `LearningFolderModel.list` reads every
 * directory under its root as a lesson, so a staging directory in there would appear in the
 * launcher as a half-installed lesson for as long as an install took — and permanently if one
 * crashed.
 */
export function stagingRoot(): string {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { platform } = require('@noodl/platform');
  const nodePath = require('path');
  /* eslint-enable @typescript-eslint/no-var-requires */
  return nodePath.join(platform.getUserDataPath(), 'LearningStaging');
}

/** The real filesystem, in the shape `lessonplatforminstall` asks for. */
export function stagingFs(): StagingFs {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const nodeFs = require('node:fs');
  const nodePath = require('path');
  /* eslint-enable @typescript-eslint/no-var-requires */
  return {
    exists: (p: string) => nodeFs.existsSync(p),
    makeDirectory: (p: string) => nodeFs.mkdirSync(p, { recursive: true }),
    removeDirectoryRecursive: (p: string) => nodeFs.rmSync(p, { recursive: true, force: true }),
    writeFile: (p: string, contents: string) => nodeFs.writeFileSync(p, contents, 'utf8'),
    join: (...parts: string[]) => nodePath.join(...parts),
    dirname: (p: string) => nodePath.dirname(p)
  };
}
