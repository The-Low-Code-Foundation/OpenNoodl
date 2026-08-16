import React, { useCallback, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import { createNodeKit } from '../../../../../../shared/utils/projectmodules';
import { openCodeFile } from '../../../documents/CodeFileDocument';
import css from './sections.module.scss';

/**
 * CN-006 — ✅ **D1's "New node kit" create command.**
 *
 * Sits beside `LibrariesSection` because it is the same kind of thing and writes
 * to the same place: both add a folder under `noodl_modules/`. The difference is
 * what the folder contains — a library is somebody else's script made reachable
 * as a global; a kit is *your own node*, with ports, that appears in the picker.
 *
 * ⚠️ **The kits list is CN-006b, not this.** This section creates; it does not
 * enumerate, show provenance, or remove. Adding a list here would duplicate the
 * surface that task is scoped to build.
 *
 * ## The three things this does after writing the files
 *
 * Writing four files is the easy part and is not the feature. The feature is
 * that the node *arrives*, which needs all three:
 *
 * 1. **`ProjectModel.readModules`** — the editor's module list is populated once
 *    at project load. This is the editor twin of the hole CN-006 found on the
 *    MCP side, where a kit scaffolded mid-session was invisible to the very
 *    server that had just written it.
 * 2. **The author is told to reload the preview.** ✅ D3 puts node definitions in
 *    the viewer's gift: the editor's picker shows what a *running runtime*
 *    registered and sent over `sendNodeLibrary`, so a kit that has never been
 *    executed cannot be in it. Saying so is honest; silently doing nothing is
 *    how AC1 turns into a bug report.
 * 3. **`index.js` opens in the code editor** — D1's clause, in the surface
 *    `CodeFileDocument` exists to provide.
 */
export function KitsSection() {
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;

  const handleCreate = useCallback(async () => {
    setError('');
    setSuccessMessage('');

    if (!projectDirectory) {
      setError('No project is open.');
      return;
    }
    if (!name.trim()) {
      setError('A kit name is required.');
      return;
    }

    setIsBusy(true);
    try {
      const result = await createNodeKit(projectDirectory, name.trim());
      if (!result.ok) {
        setError(result.message);
        return;
      }

      /*
       * 🔴 The editor twin of CN-006's second hole, closed at the one door that
       * knows the kit set changed.
       *
       * `ProjectModel.modules` is filled by `readProjectModules` once, when the
       * project loads. A kit written after that is on disk and absent from the
       * model — and, exactly as on the MCP side, nothing breaks and nothing
       * logs, because the success payload is perfectly accurate about the files.
       * Deliberately a single re-read here rather than a poll or an mtime
       * sweep, which ✅ D3 argues against.
       */
      await new Promise<void>((resolve) => ProjectModel.instance.readModules(() => resolve()));

      setSuccessMessage(
        `${result.message} Reload the preview to place "${result.nodeType}" — the picker lists what a running ` +
          'runtime has registered.'
      );
      setName('');

      // D1's other clause. Last, so a failure to open a document can never cost
      // the author the kit that was already written successfully.
      if (result.indexPath) openCodeFile(result.indexPath);
    } finally {
      setIsBusy(false);
    }
  }, [projectDirectory, name]);

  return (
    <CollapsableSection title="Node kits" hasGutter hasVisibleOverflow hasTopDivider>
      <div className={css.HelpText}>
        Create your own node. A kit is a folder under noodl_modules/ with one example node whose every visual
        decision is a port — colour, spacing and size default to design tokens, so it looks like the rest of the
        app from the first render.
      </div>

      <PanelRow label="Kit name *" helpText="Becomes the folder name under noodl_modules/. Existing kits are never overwritten.">
        <PropertyPanelTextInput value={name} onChange={setName} />
      </PanelRow>

      {error && (
        <div
          style={{
            padding: '8px',
            marginBottom: '8px',
            fontSize: '12px',
            color: 'var(--theme-color-error)',
            backgroundColor: 'var(--theme-color-error-bg)',
            border: '1px solid var(--theme-color-error)',
            borderRadius: '4px'
          }}
          data-test="kits-error"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: '8px',
            marginBottom: '8px',
            fontSize: '12px',
            color: 'var(--theme-color-success)',
            backgroundColor: 'var(--theme-color-success-bg)',
            border: '1px solid var(--theme-color-success)',
            borderRadius: '4px'
          }}
          data-test="kits-success"
        >
          {successMessage}
        </div>
      )}

      <div className={css.ButtonRow}>
        <button
          onClick={() => void handleCreate()}
          disabled={isBusy}
          data-test="kits-create"
          style={{
            padding: '8px',
            fontSize: '13px',
            fontWeight: 500,
            backgroundColor: isBusy ? 'var(--theme-color-bg-3)' : 'var(--theme-color-primary)',
            color: isBusy ? 'var(--theme-color-fg-muted)' : 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isBusy ? 'not-allowed' : 'pointer'
          }}
        >
          {isBusy ? 'Creating…' : '+ New node kit'}
        </button>
      </div>
    </CollapsableSection>
  );
}
