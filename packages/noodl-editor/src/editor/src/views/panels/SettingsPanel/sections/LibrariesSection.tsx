import React, { useCallback, useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import {
  listRegisteredLibraries,
  libraryNeedsSsrWarning,
  registerLibrary,
  removeLibrary,
  RegisteredLibrary
} from '../../../../../../shared/utils/projectmodules';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import css from './sections.module.scss';

/**
 * ERG-002 — "An app-config Libraries section that writes a noodl_modules
 * manifest, and verifies it on the way in" (spec §2).
 *
 * Deliberately not a new injection mechanism: `registerLibrary` (in
 * `shared/utils/projectmodules.ts`) only ever writes the same
 * `noodl_modules/<name>/manifest.json` shape `injectIntoHtml` already
 * consumes — this component is surface over that, exactly as the spec asks.
 *
 * The verify step runs before anything is written to disk (`registerLibrary`
 * refuses to write when `verifyLibrarySource` fails) — that ordering is the
 * whole point: a bad build never becomes a saved library an author has to
 * notice is broken later.
 */
export function LibrariesSection() {
  const [libraries, setLibraries] = useState<RegisteredLibrary[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [globalName, setGlobalName] = useState('');
  const [stylesheetUrl, setStylesheetUrl] = useState('');
  const [vendor, setVendor] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const projectDirectory = ProjectModel.instance._retainedProjectDirectory;
  // Unset means CSR — mirrors `DeployToFolderTab.getSavedRenderingMode`, the
  // one place this setting is written (there is no dedicated project-settings
  // port for it; the Deploy popup is where an author picks SSR/SSG).
  const deployRenderingMode = ProjectModel.instance.getSettings()?.['deployRenderingMode'];

  const refresh = useCallback(async () => {
    if (!projectDirectory) {
      setLibraries([]);
      return;
    }
    setLibraries(await listRegisteredLibraries(projectDirectory));
  }, [projectDirectory]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function resetForm() {
    setName('');
    setSourceUrl('');
    setGlobalName('');
    setStylesheetUrl('');
    setVendor(true);
    setError('');
    setSuccessMessage('');
    setIsAdding(false);
  }

  async function handleAdd() {
    setError('');
    setSuccessMessage('');

    if (!projectDirectory) {
      setError('No project is open.');
      return;
    }
    if (!name.trim()) {
      setError('A name is required.');
      return;
    }
    if (!sourceUrl.trim()) {
      setError('A source URL is required.');
      return;
    }
    if (!globalName.trim()) {
      setError('The global variable name this library defines is required — e.g. "PocketBase".');
      return;
    }

    setIsBusy(true);
    try {
      // `registerLibrary` does its own fetch for a `kind: 'url'` source (and
      // its own verify-before-write, per §2) — the network call happens
      // exactly once, and whether the fetched bytes get written into the
      // project or left as a remote `dependencies` entry is entirely decided
      // by `vendor`, not by which code path fetched them.
      const result = await registerLibrary(projectDirectory, {
        name: name.trim(),
        source: { kind: 'url', url: sourceUrl.trim() },
        globalName: globalName.trim(),
        stylesheetUrl: stylesheetUrl.trim() || undefined,
        vendor
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setSuccessMessage(result.message);
      await refresh();
      resetForm();
      setIsAdding(false);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove(moduleName: string) {
    if (!projectDirectory) return;
    if (!window.confirm(`Remove "${moduleName}"? This deletes its noodl_modules folder.`)) return;
    await removeLibrary(projectDirectory, moduleName);
    await refresh();
  }

  return (
    <CollapsableSection title="Libraries" hasGutter hasVisibleOverflow hasTopDivider>
      <div className={css.HelpText}>
        Register a third-party JavaScript library (PocketBase, tinyMCE, …) to make it available in Function and
        Script nodes as a global variable — no head code, no hand-written folder.
      </div>

      {libraries.length === 0 && !isAdding && <div className={css.EmptyState}>No libraries registered yet.</div>}

      {libraries.map((lib) => (
        <div key={lib.moduleName} className={css.VariableCard}>
          <div className={css.VariableHeader}>
            <div className={css.VariableIdentity}>
              <span className={css.VariableKey} title={lib.displayName}>
                {lib.displayName}
              </span>
              <span className={css.VariableType}>window.{lib.global || '?'}</span>
            </div>
            <button
              onClick={() => handleRemove(lib.moduleName)}
              title="Remove library"
              style={{
                padding: '4px 10px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: 'var(--theme-color-danger)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                minWidth: '28px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--theme-color-fg-muted)' }}>
            {lib.vendored ? 'Vendored locally (no runtime network dependency).' : lib.dependencies.join(', ')}
          </div>
          {libraryNeedsSsrWarning(lib, deployRenderingMode) && (
            <div
              style={{
                marginTop: '6px',
                padding: '8px',
                fontSize: '12px',
                color: 'var(--theme-color-warning)',
                backgroundColor: 'var(--theme-color-warning-bg)',
                border: '1px solid var(--theme-color-warning)',
                borderRadius: '4px'
              }}
            >
              This project deploys as {String(deployRenderingMode).toUpperCase()}. &quot;{lib.displayName}&quot; attaches to{' '}
              <code>window</code>, which does not exist during server rendering — any page that reads{' '}
              <code>window.{lib.global}</code> during its first render will fail server-side. Guard the reference
              (check <code>typeof window !== &apos;undefined&apos;</code>) or keep this library&apos;s use to
              client-only interactions.
            </div>
          )}
        </div>
      ))}

      {!isAdding && (
        <div className={css.ButtonRow}>
          <button
            onClick={() => setIsAdding(true)}
            style={{
              padding: '8px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: 'var(--theme-color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Library
          </button>
        </div>
      )}

      {isAdding && (
        <div
          style={{
            padding: '12px',
            marginBottom: '12px',
            backgroundColor: 'var(--theme-color-bg-2)',
            border: '1px solid var(--theme-color-border-default)',
            borderRadius: '4px'
          }}
        >
          <PanelRow label="Name *" helpText="Identity; becomes the folder name under noodl_modules/.">
            <PropertyPanelTextInput value={name} onChange={setName} />
          </PanelRow>

          <PanelRow label="Source URL *" helpText="The CDN build. Must be UMD/IIFE — a plain <script> tag, no bundler.">
            <PropertyPanelTextInput value={sourceUrl} onChange={setSourceUrl} />
          </PanelRow>

          <PanelRow
            label="Global name *"
            helpText='The window-attached name this library defines, e.g. "PocketBase". Verified before saving.'
          >
            <PropertyPanelTextInput value={globalName} onChange={setGlobalName} />
          </PanelRow>

          <PanelRow label="Stylesheet URL" helpText="Optional. Many libraries (tinyMCE) need a CSS file too.">
            <PropertyPanelTextInput value={stylesheetUrl} onChange={setStylesheetUrl} />
          </PanelRow>

          <PanelRow label="">
            <Checkbox
              label="Vendor locally (download into the project)"
              isChecked={vendor}
              onChange={(e) => setVendor(e.target.checked)}
            />
          </PanelRow>
          <div style={{ fontSize: '11px', color: 'var(--theme-color-fg-muted)', marginTop: '-8px', marginBottom: '8px' }}>
            Recommended: a deployed app otherwise depends on the CDN&apos;s uptime at runtime. noodl_modules/ ships
            verbatim on deploy, so a vendored copy needs no further work.
          </div>

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
            >
              {successMessage}
            </div>
          )}

          <div className={css.ButtonRow}>
            <button
              onClick={handleAdd}
              disabled={isBusy}
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
              {isBusy ? 'Verifying…' : 'Verify & Add'}
            </button>
            <button
              onClick={resetForm}
              disabled={isBusy}
              style={{
                padding: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: 'var(--theme-color-bg-3)',
                color: 'var(--theme-color-fg-default)',
                border: '1px solid var(--theme-color-border-default)',
                borderRadius: '4px',
                cursor: isBusy ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </CollapsableSection>
  );
}
