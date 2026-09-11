/**
 * UNI-007 slice 4 — a Learning-folder lesson, once it is open in the editor.
 *
 * 🔴 **The premise these specs pin was FALSE until this slice, and a live drive
 * had already passed over it.** Slice 3 installed lessons, showed them on cards
 * and opened them; `EditorPage` attaches the lesson layer only when
 * `ProjectModel.instance.isLesson()` — `project.lesson !== undefined` — and the
 * only code that had ever set that field is the hosted-zip path, which points a
 * `LessonModel` at an HTTP base URL. So a lesson opened from the Learning folder
 * arrived as an ordinary project: no steps, no instructions, no completion.
 *
 * The drive that "passed" was measuring the half that worked (the card opened
 * the project; recents did not grow). The half that did not was invisible until
 * something needed it — the fourth time this phase that building a caller has
 * shown what a shipped thing does not do.
 */

import {
  buildLearningLessonModel,
  LESSON_MANIFEST_FILE,
  lessonProgress,
  manifestPath,
  readLessonManifest,
  readLessonSource,
  resumeIndex
} from '../../src/editor/src/models/learninglesson';
import type { LearningLessonFs } from '../../src/editor/src/models/learninglesson';
import type { LearningEntry, LearningProgress } from '../../src/editor/src/models/learningfolder';

// ─── A filesystem with one lesson in it ─────────────────────────────────────

const manifestText = JSON.stringify({ format: 'noodl-lesson@1', title: 'State on a page', steps: [] });

function fsWith(files: Record<string, string>): LearningLessonFs {
  return {
    readTextFile: (p) => files[p],
    readJsonFile: (p) => {
      try {
        return JSON.parse(files[p]);
      } catch {
        return undefined;
      }
    },
    join: (...parts) => parts.join('/')
  };
}

const dir = '/learning/state-on-a-page';
const fs = fsWith({ [`${dir}/${LESSON_MANIFEST_FILE}`]: manifestText });

const entry: LearningEntry = {
  id: 'state-on-a-page',
  title: 'State on a page',
  provenance: 'local',
  projectDirectory: dir,
  source: { kind: 'local', path: '/bundles/state-on-a-page' },
  installedAt: '2026-08-15T09:00:00.000Z'
};

// ─── Reading ────────────────────────────────────────────────────────────────

describe('reading an installed lesson', () => {
  it('reads lesson.json from the installed directory — the same file the install gate read', () => {
    expect(manifestPath(dir, fs)).toBe(`${dir}/lesson.json`);
    expect(readLessonManifest(dir, fs)).toMatchObject({ title: 'State on a page' });
    expect(readLessonSource(dir, fs)).toBe(manifestText);
  });

  it('returns undefined rather than throwing when there is no manifest', () => {
    expect(readLessonManifest('/nowhere', fs)).toBeUndefined();
    expect(readLessonSource('/nowhere', fs)).toBeUndefined();
  });

  it('returns undefined for a manifest that is not an object', () => {
    const broken = fsWith({ [`${dir}/${LESSON_MANIFEST_FILE}`]: '"just a string"' });
    expect(readLessonManifest(dir, broken)).toBeUndefined();
  });
});

// ─── Progress ───────────────────────────────────────────────────────────────

describe('lessonProgress', () => {
  it('reports the step the learner is on, out of the counted steps', () => {
    expect(lessonProgress({ index: 2, numberOfLessons: 7 })).toEqual({ stepIndex: 2, stepCount: 7 });
  });

  it('never reports "step 3 of 0" while the steps are still loading', () => {
    expect(lessonProgress({ index: 2 })).toEqual({ stepIndex: 2, stepCount: 3 });
    expect(lessonProgress({ index: 2, numberOfLessons: 0 })).toEqual({ stepIndex: 2, stepCount: 3 });
  });

  it('floors a nonsense index rather than propagating it to the card', () => {
    expect(lessonProgress({ index: -4, numberOfLessons: 3 })).toEqual({ stepIndex: 0, stepCount: 3 });
  });
});

// ─── Attaching ──────────────────────────────────────────────────────────────

interface FakeLesson {
  args: Record<string, unknown>;
  index: number;
  numberOfLessons?: number;
  handlers: (() => void)[];
  on(event: string, cb: () => void): void;
}

function attach(project: { id?: string; lesson?: { index?: number } }, progressed: [string, LearningProgress][] = []) {
  let built: FakeLesson | undefined;

  const lesson = buildLearningLessonModel(project, entry, {
    fs,
    createLessonModel: (args) => {
      built = {
        args: args as unknown as Record<string, unknown>,
        index: args.index,
        handlers: [],
        on(event: string, cb: () => void) {
          if (event === 'instructionsChanged') this.handlers.push(cb);
        }
      };
      return built;
    },
    onProgress: (id, progress) => progressed.push([id, progress]),
    observe: (model, onChanged) => (model as FakeLesson).on('instructionsChanged', onChanged)
  }) as FakeLesson;

  return { lesson, built: built as FakeLesson };
}

describe('buildLearningLessonModel', () => {
  it('gives the lesson a reader pointed at its own directory', () => {
    const { built } = attach({ id: entry.id });

    // 🔴 A reader, not a URL. `window.fetch` will not read a `file://` path from
    // the editor's renderer, and there is no origin for the hosted path's
    // baseURL trick — but everything after the read is the one shared
    // `compileLessonSource` path rather than a second reader.
    expect(built.args.url).toBe(LESSON_MANIFEST_FILE);
    expect((built.args.read as () => string | undefined)()).toBe(manifestText);
  });

  it('carries the step index over from the saved project, never resetting it', () => {
    const { built } = attach({ id: entry.id, lesson: { index: 4 } });
    expect(built.args.index).toBe(4);
  });

  it('starts at the first step for a lesson that has never been opened', () => {
    expect(attach({ id: entry.id }).built.args.index).toBe(0);
  });

  it('🔴 resumes from the REGISTER, which the project file may lag behind', () => {
    /*
     * Driven 2026-08-15 and it failed: advance a step, leave the lesson, reopen
     * it, and it restarted at step 1. `project.lesson.index` is persisted only
     * when the project is *saved*, and a learner reading instructions has saved
     * nothing. `recordProgress` writes on every step change with no save in the
     * path, so the register is both fresher and incapable of lagging.
     */
    const withProgress = { ...entry, progress: { stepIndex: 3, stepCount: 5 } };
    expect(resumeIndex({ id: entry.id }, withProgress)).toBe(3);
    // Even when the saved project claims otherwise, because it can only be stale.
    expect(resumeIndex({ id: entry.id, lesson: { index: 0 } }, withProgress)).toBe(3);
  });

  it('falls back to the project file when nothing has been recorded', () => {
    // A bundle whose own project.json carries a `lesson` block, or an entry
    // installed before progress was ever written.
    expect(resumeIndex({ lesson: { index: 2 } }, entry)).toBe(2);
    expect(resumeIndex({ lesson: { index: 2 } }, { ...entry, progress: { stepIndex: 0, stepCount: 4 } })).toBe(2);
    expect(resumeIndex(undefined, undefined)).toBe(0);
  });

  it('records progress against the register when the learner moves on', () => {
    const progressed: [string, LearningProgress][] = [];
    const { built } = attach({ id: entry.id }, progressed);

    built.index = 2;
    built.numberOfLessons = 5;
    built.handlers.forEach((h) => h());

    expect(progressed).toEqual([[entry.id, { stepIndex: 2, stepCount: 5 }]]);
  });

  it('records progress and nothing else — progress never completes a lesson', () => {
    const progressed: [string, LearningProgress][] = [];
    const { built } = attach({ id: entry.id }, progressed);

    built.index = 4;
    built.numberOfLessons = 5;
    built.handlers.forEach((h) => h());

    // D5's two numbers: only a recorded *grade* may say a lesson is complete,
    // and this path writes no grade at all.
    expect(progressed[0][1]).toEqual({ stepIndex: 4, stepCount: 5 });
    expect(Object.keys(progressed[0][1])).toEqual(['stepIndex', 'stepCount']);
  });

  it('titles the lesson from the register entry', () => {
    expect(attach({ id: entry.id }).built.args.title).toBe('State on a page');
    expect(attach({ id: entry.id }).built.args.name).toBe(entry.id);
  });
});
