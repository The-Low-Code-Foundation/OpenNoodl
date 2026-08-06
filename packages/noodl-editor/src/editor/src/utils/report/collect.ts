/**
 * ALPHA-007 — the impure half: reading the running editor.
 *
 * Everything that touches a model, a store, Node or Electron lives here, and
 * nothing else does. `compose.ts` takes the result as plain data, which is what
 * lets the redaction be *demonstrated* against a hostile fixture rather than
 * argued about (criterion 4).
 *
 * Every read is defensive. This runs at the moment something has already gone
 * wrong — that is the definition of the feature — so a half-initialised model
 * is the expected case, not the exceptional one. A diagnostics field that is
 * missing a value is a small loss; a "Report a problem" dialog that throws
 * while the app is already broken loses the report entirely.
 *
 * @module utils/report/collect
 */

import os from 'os';

import { platform } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';

import { NodeLibrary } from '../../models/nodelibrary';
import { AiConfigStore } from '../../store/AiAssistantStore';
import { ComposeReportInput } from './compose';
import { getErrorTail } from './errorTail';
import { SURFACE_OPTIONS, SurfaceOption } from './issueForm';
import { RedactorOptions } from './redact';

function safe<T>(read: () => T, fallback: T): T {
  try {
    const value = read();
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
}

/**
 * The directories the redactor needs to recognise.
 *
 * `os.homedir()` rather than `platform.getUserDataPath()`: the user data path
 * is a *subdirectory* of home on every platform, and using it would leave the
 * home prefix unmatched everywhere else.
 */
export function machinePaths(): RedactorOptions {
  return {
    homeDir: safe(() => os.homedir(), undefined),
    appDir: safe(() => platform.getAppPath(), undefined),
    projectDir: safe(() => ProjectModel.instance && ProjectModel.instance._retainedProjectDirectory, undefined)
  };
}

/**
 * Node type names the library has resolved.
 *
 * Anything not in this set is bucketed as `<unknown>` rather than published:
 * an unresolved type name can be a node from the user's own module, and a
 * module named after their client is exactly the leak §3 forbids.
 */
function knownTypeNames(): Set<string> | null {
  return safe(() => {
    const types = NodeLibrary.instance.getNodeTypes() || [];
    const names = new Set<string>();
    for (const type of types) {
      if (type && type.name) names.add(type.name);
    }
    // An empty set would bucket *everything* as unknown, which is safe but
    // useless; null means "the library has nothing to say", which is honest.
    return names.size ? names : null;
  }, null);
}

/**
 * A default for the `surface` dropdown.
 *
 * §2 asks for it to be "guessed from focus". Guessed, not decided — the
 * reporter can change it, and a wrong guess costs a click while an absent one
 * costs a required field. The guess is deliberately coarse: the one distinction
 * worth making automatically is editor-versus-preview, because that is the one
 * a reporter genuinely gets wrong.
 */
export function guessSurface(): SurfaceOption {
  if (!ProjectModel.instance) return 'Not sure';

  const focused = safe(() => document.activeElement, null) as Element | null;
  if (focused && focused.tagName === 'IFRAME') return 'Preview (the live app inside the editor)';

  const inViewer = safe(
    () => Boolean(focused && focused.closest && focused.closest('.viewer, #viewer-frame, .preview-frame')),
    false
  );
  if (inViewer) return 'Preview (the live app inside the editor)';

  return 'The editor (canvas, panels, menus)';
}

/** Everything `composeReport` needs except the reporter's own answers. */
export function collectContext(): Omit<ComposeReportInput, 'reportId' | 'capturedAt' | 'user'> {
  const project = safe(() => ProjectModel.instance, null);

  return {
    app: {
      version: safe(() => platform.getVersion(), '0.0.0'),
      buildNumber: safe(() => platform.getBuildNumber(), undefined),
      // `Config.devMode` is what turns the on-disk log off; a report from a
      // source build means something different from one from a packaged app,
      // and triage should not have to guess which it is reading.
      packaged: safe(() => !process.env.devMode, true)
    },
    os: {
      platform: safe(() => process.platform, 'unknown'),
      arch: safe(() => process.arch, 'unknown'),
      release: safe(() => os.release(), undefined)
    },
    editor: {
      route: project ? 'editor' : 'projects'
    },
    project,
    projectFormat: safe(() => (project as TSFixme)?._projectFormat, undefined),
    knownTypes: knownTypeNames(),
    ai: {
      configured: safe(() => AiConfigStore.isEnabled(), false),
      provider: safe(() => AiConfigStore.getActiveProvider() || undefined, undefined)
    },
    errors: getErrorTail(),
    paths: machinePaths()
  };
}

/** The `surface` options, for the dialog's dropdown. */
export const surfaceOptions = SURFACE_OPTIONS;
