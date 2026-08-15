/**
 * UNI-007 slice 4 — a Learning-folder lesson, once it is open in the editor.
 *
 * 🔴 THE PREMISE THIS FILE EXISTS TO FIX, FOUND BY BUILDING THE CALLER
 * -------------------------------------------------------------------
 * Slice 3 installed lessons and opened them, and the handover for slice 4 said
 * to put "check my work" *in the lesson layer*. **There was no lesson layer.**
 * `EditorPage` attaches one only when `ProjectModel.instance.isLesson()`, which
 * is `project.lesson !== undefined`, and the only code that had ever set that
 * field is `LessonsProjectsModel._cloneLessonIntoDirectory` — the hosted-zip
 * path, which synthesises a `LessonModel` pointing at an **HTTP** base URL.
 * A lesson opened from the Learning folder therefore arrived as an ordinary
 * project: no steps, no instructions, no completion, nothing to grade against.
 *
 * That is the third time this phase that giving a shipped thing a caller showed
 * what it did not do. It is also why the two halves land together: a "check my
 * work" button with no lesson layer to live in would have been a button in
 * search of a lesson.
 *
 * WHAT ATTACHING MEANS
 * --------------------
 *   - The manifest is read **from the installed directory**, through
 *     `LessonModel`'s injected reader (`LessonModelArgs.read`). `window.fetch`
 *     cannot read a `file://` path from the editor's renderer, and the hosted
 *     path's base-URL trick has no origin to point at here. Everything after the
 *     read — format detection, `compileLessonSource`, steps, annotations — is
 *     the one shared path.
 *   - The step index is **carried over, never reset**. `project.json` persists
 *     `lesson` on save (`ProjectModel.toJSON`), so a learner who closes the
 *     editor half way through a lesson and comes back must land where they left
 *     off. Resetting the lesson is the launcher's button and re-pulls the whole
 *     project; it is not a side effect of opening one.
 *   - Progress is written back to the register on every step change, which is
 *     what puts a number on the card.
 *
 * ⚠️ **Progress is not completion.** `recordProgress` moves the step counter and
 * nothing else. Only a recorded *grade* may say a lesson is complete — D5's two
 * numbers, and the reason the card reads them separately.
 *
 * @module noodl-editor/models/learninglesson
 */

import type { LearningEntry, LearningEntryView, LearningProgress } from './learningfolder';
import type { LessonManifest } from './lessonformat';

/** The manifest's file name inside a lesson bundle. The install gate reads the same one. */
export const LESSON_MANIFEST_FILE = 'lesson.json';

// ─── Ports ──────────────────────────────────────────────────────────────────

/**
 * The filesystem this module needs, and nothing more — the same shape
 * `LearningFolderFs` exposes, so the register's real ports satisfy it.
 * Injected for the reason every other UNI-007 module injects: `tests-unit/` is
 * a plain-Node runner and UNI-010 runs this arc with no renderer around it.
 */
export interface LearningLessonFs {
  /** Parsed JSON, or `undefined` when the file is missing or unreadable. Never throws. */
  readJsonFile(path: string): unknown;
  /** The file's text, or `undefined` when it cannot be read. Never throws. */
  readTextFile(path: string): string | undefined;
  join(...parts: string[]): string;
}

/** What a lesson-layer model looks like from here. Deliberately narrow. */
export interface LessonProgressSource {
  index: number;
  numberOfLessons?: number;
}

// ─── Reading a lesson ───────────────────────────────────────────────────────

/** The path of an installed lesson's manifest. */
export function manifestPath(projectDirectory: string, fs: LearningLessonFs): string {
  return fs.join(projectDirectory, LESSON_MANIFEST_FILE);
}

/**
 * The manifest of an installed lesson, or `undefined` when there is none.
 *
 * Read fresh on every call, on purpose. The obvious alternative — caching it at
 * open — would grade an author's bundle against the version they opened rather
 * than the one they have since written, and UNI-010's whole premise is a lesson
 * being authored on the machine that runs it.
 */
export function readLessonManifest(projectDirectory: string, fs: LearningLessonFs): LessonManifest | undefined {
  const manifest = fs.readJsonFile(manifestPath(projectDirectory, fs));
  return manifest && typeof manifest === 'object' ? (manifest as LessonManifest) : undefined;
}

/** The manifest as text, for `LessonModel`'s reader. */
export function readLessonSource(projectDirectory: string, fs: LearningLessonFs): string | undefined {
  return fs.readTextFile(manifestPath(projectDirectory, fs));
}

// ─── Progress ───────────────────────────────────────────────────────────────

/**
 * What the register records as the learner moves through a lesson.
 *
 * ⚠️ `stepCount` falls back to `stepIndex + 1` rather than to zero when the
 * lesson model has not counted its steps yet. A card rendering "step 3 of 0"
 * is worse than one rendering "step 3 of 3", and the number is corrected the
 * moment the steps land.
 */
export function lessonProgress(lesson: LessonProgressSource): LearningProgress {
  const stepIndex = Math.max(0, Math.floor(lesson?.index ?? 0));
  const counted = lesson?.numberOfLessons;
  return {
    stepIndex,
    stepCount: typeof counted === 'number' && counted > 0 ? counted : stepIndex + 1
  };
}

// ─── Attaching ──────────────────────────────────────────────────────────────

/** Just enough of `ProjectModel` to attach a lesson to it. */
export interface AttachableProject {
  id?: string;
  lesson?: { index?: number } | undefined;
}

export interface AttachLearningLessonDeps {
  fs: LearningLessonFs;
  /** Builds the lesson model. Injected so this module never imports `LessonModel`'s dependencies. */
  createLessonModel(args: {
    index: number;
    url: string;
    name: string;
    title?: string;
    read: () => string | undefined;
  }): unknown;
  /** Called on every step change with the entry id and the new progress. */
  onProgress(id: string, progress: LearningProgress): void;
  /** Subscribes to the model's step-change event. */
  observe(lesson: unknown, onChanged: () => void): void;
}

/**
 * Give an opened lesson project its lesson layer.
 *
 * Returns the attached model so the caller can hand it to the project — this
 * module does not assign it, because `ProjectModel` is the caller's dependency
 * and not this one's.
 */
export function buildLearningLessonModel(
  project: AttachableProject,
  entry: LearningEntry | LearningEntryView,
  deps: AttachLearningLessonDeps
): unknown {
  // 🔴 Carried over, never reset — see the module note. `project.lesson` is
  // whatever `project.json` persisted from the last session.
  const index = Math.max(0, Math.floor(project?.lesson?.index ?? 0));

  const lesson = deps.createLessonModel({
    index,
    // `isManifestUrl` keys on the extension, so the declarative reader is
    // selected by the same rule the hosted path uses.
    url: LESSON_MANIFEST_FILE,
    name: entry.id,
    ...(entry.title ? { title: entry.title } : {}),
    read: () => readLessonSource(entry.projectDirectory, deps.fs)
  });

  deps.observe(lesson, () => {
    deps.onProgress(entry.id, lessonProgress(lesson as LessonProgressSource));
  });

  return lesson;
}

// ─── The real ports ─────────────────────────────────────────────────────────
//
// Built with `require` inside the functions rather than module-scope `import`,
// the same trick and the same reason as `learningfolder.defaultDeps` and
// `lessonevalconditions.liveLessonEvalContext`: everything above has to import
// cleanly in a plain-Node runner, and `LessonModel`, `ProjectModel` and the
// engine-2 adapter each drag Electron in behind them.

export function defaultLearningLessonFs(): LearningLessonFs {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const nodeFs = require('node:fs');
  const nodePath = require('node:path');
  /* eslint-enable @typescript-eslint/no-var-requires */

  return {
    readJsonFile: (p: string) => {
      try {
        return JSON.parse(nodeFs.readFileSync(p, 'utf8'));
      } catch {
        return undefined;
      }
    },
    readTextFile: (p: string) => {
      try {
        return nodeFs.readFileSync(p, 'utf8');
      } catch {
        return undefined;
      }
    },
    join: (...parts: string[]) => nodePath.join(...parts)
  };
}

/**
 * Attach the lesson layer's model to a just-opened Learning-folder project.
 *
 * Called by the launcher's open path, straight after `projectFromDirectory`, so
 * that `EditorPage`'s `isLesson()` check finds a lesson to show. Returns whether
 * one was attached — a project with no register entry is an ordinary project and
 * is left exactly as it was.
 */
export function attachLearningLesson(project: AttachableProject, entry: LearningEntry | LearningEntryView): boolean {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const LessonModel = require('./lessonmodel').default;
  const { LearningFolderModel } = require('./learningfolder');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const lesson = buildLearningLessonModel(project, entry, {
    fs: defaultLearningLessonFs(),
    createLessonModel: (args) => new LessonModel(args),
    onProgress: (id, progress) => LearningFolderModel.instance.recordProgress(id, progress),
    // `instructionsChanged` is what `LessonModel.reportChanged()` fires when the
    // learner moves on, and what `LessonsProjectsModel._trackLessonProgress`
    // listens to for the hosted lessons. One event, two registers.
    observe: (model, onChanged) => (model as { on(event: string, cb: () => void): void }).on('instructionsChanged', onChanged)
  });

  (project as { lesson?: unknown }).lesson = lesson;
  return true;
}
