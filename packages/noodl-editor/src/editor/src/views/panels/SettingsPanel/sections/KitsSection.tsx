import React, { useCallback, useEffect, useState } from 'react';

import { platform } from '@noodl/platform';

import { NodeLibrary } from '@noodl-models/nodelibrary';
import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';
import { ProjectModel } from '@noodl-models/projectmodel';

import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { DOCS_PAGES } from '@noodl-core-ui/constants/externalLinks';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { PanelRow } from '@noodl-core-ui/components/sidebar/PanelRow';

import {
  createNodeKit,
  describeKitOrigin,
  joinKitNodes,
  listNodeKits,
  removeNodeKit,
  ProjectNodeKit
} from '../../../../../../shared/utils/projectmodules';
import { openCodeFile } from '../../../documents/CodeFileDocument';
import css from './sections.module.scss';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { kitDiagnostics, effectiveKitRuntimes, declaredKitRuntimes } = require('@nodegx/kit-catalog');
import type { KitHealthDiagnostic } from '@nodegx/kit-catalog';

/**
 * CN-006 — ✅ **D1's "New node kit" create command.**
 *
 * Sits beside `LibrariesSection` because it is the same kind of thing and writes
 * to the same place: both add a folder under `noodl_modules/`. The difference is
 * what the folder contains — a library is somebody else's script made reachable
 * as a global; a kit is *your own node*, with ports, that appears in the picker.
 *
 * ✅ **CN-006b landed the list here** (2026-08-17), which is where that task said
 * its natural home was — beside `LibrariesSection`, on the same card patterns.
 * The note that used to stand here reserving it for CN-006b is discharged.
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
  const [kits, setKits] = useState<Array<ProjectNodeKit & { nodes: string[] }>>([]);
  const [orphans, setOrphans] = useState<Array<{ name: string; nodes: string[] }>>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [failures, setFailures] = useState<KitHealthDiagnostic[]>([]);

  const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;

  /**
   * CN-006b AC1. Disk says which kits are installed; the running runtime says
   * which nodes each one registered — ✅ **D3**, and neither half can answer the
   * other's question. `joinKitNodes` puts them together and keeps the two states
   * distinguishable: a kit with no nodes is *not yet loaded*, not empty.
   *
   * ⚠️ **Read-only, deliberately.** ["Opening a project already writes three
   * files"] is a live complaint; listing kits must not become a fourth write, so
   * nothing here caches to disk, stamps a manifest or touches `toJSON`.
   */
  const refresh = useCallback(async () => {
    const onDisk = await listNodeKits(projectDirectory);
    const moduleNodes = NodeLibrary.instance?.library?.nodeIndex?.moduleNodes;
    const joined = joinKitNodes(onDisk, moduleNodes);
    setKits(joined.kits);
    setOrphans(joined.orphans);

    /*
     * 🔴 **CN-015 AC1 — the state this list could not previously show at all.**
     *
     * A kit whose `index.js` throws registers nothing, so it lands in the row
     * above as *"Installed. Reload the preview to load its nodes"* — which is
     * the one sentence guaranteed to send its author to reload a preview that
     * will fail again in exactly the same way. Disk cannot tell the difference
     * (the folder is perfectly fine) and the node library cannot either (the
     * kit is simply absent from it). Only the page that ran the script knows,
     * and CN-015 is the channel that carries what it saw.
     *
     * ⚠️ `assumeLoaded: false` because this caller genuinely cannot tell
     * "registered nothing" from "not loaded yet" — CN-006b keeps those two
     * apart deliberately and a zero-node warning here would collapse them.
     * The messages are `kitDiagnostics`' own, not re-worded, so the panel and
     * `validate:project` cannot drift into describing one failure two ways.
     */
    const reported = NodeLibraryImporter.instance.getModuleFailures();
    setFailures(
      kitDiagnostics(
        {
          kits: onDisk.map((kit) => ({
            kitModule: kit.displayName,
            dirPath: `noodl_modules/${kit.dirName}`,
            // CN-012 — `kit-loads-nowhere`. Derived from the manifest, not from
            // what loaded: a kit no runtime loads contributes no nodes, so
            // reading this off the payload would be blind in exactly that case.
            availableIn: effectiveKitRuntimes(kit.runtimes),
            declaredRuntimes: declaredKitRuntimes(kit.runtimes)
          })),
          // Passed so a half-registered kit is described as such: a kit that
          // threw *after* registering some nodes is the alarming case, and
          // `kitDiagnostics` can only see it if it knows what did register.
          nodes: joined.kits.flatMap((kit) =>
            kit.nodes.map((typeName) => ({ typeName, kitModule: kit.displayName }))
          ),
          failures: reported.map((failure) => ({ kitModule: failure.module, message: failure.message }))
        },
        { assumeLoaded: false }
      )
    );
  }, [projectDirectory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * The node counts come from the library, so they have to move when it does.
   * ✅ **CN-014 (s20)** is what makes this worth listening to: until the frozen
   * definition was fixed, `libraryUpdated` did not fire when a kit's contents
   * changed, so a listener here would have been dead half the time.
   */
  useEffect(() => {
    const group = {};
    NodeLibrary.instance.on('libraryUpdated', () => void refresh(), group);
    return () => {
      NodeLibrary.instance.off(group);
    };
  }, [refresh]);

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
      await refresh();

      // D1's other clause. Last, so a failure to open a document can never cost
      // the author the kit that was already written successfully.
      if (result.indexPath) openCodeFile(result.indexPath);
    } finally {
      setIsBusy(false);
    }
  }, [projectDirectory, name, refresh]);

  const handleRemove = useCallback(
    async (kit: ProjectNodeKit & { nodes: string[] }) => {
      /*
       * The confirmation names the consequence that is *not* obvious from the
       * button: the folder goes now, and its nodes stay in the picker until a
       * runtime restarts without them. Saying nothing here would make the
       * leftover nodes read as a failed delete.
       */
      const nodeLine = kit.nodes.length
        ? ` Its ${kit.nodes.length} node${kit.nodes.length === 1 ? '' : 's'} will stay in the picker until you reload the preview.`
        : '';
      if (!window.confirm(`Remove "${kit.displayName}"? This deletes noodl_modules/${kit.dirName}.${nodeLine}`)) return;

      setError('');
      setSuccessMessage('');
      const result = await removeNodeKit(projectDirectory, kit.dirName);
      if (!result.ok) setError(result.message);
      else setSuccessMessage(result.message);

      // The model's module list is populated once at project load (see the
      // comment in `handleCreate`) — a removal leaves it just as stale as a
      // creation does, and for the same reason.
      await new Promise<void>((resolve) => ProjectModel.instance.readModules(() => resolve()));
      await refresh();
    },
    [projectDirectory, refresh]
  );

  /** The diagnostics naming this kit. Keyed on the manifest name, which is the
   *  join key everywhere else in this feature (`displayName`, the injector's
   *  marker, and `metadata.module` in the node library all carry it). */
  const failuresFor = (displayName: string) => failures.filter((d) => d.kitModule === displayName);

  /* A failure whose kit is not in the on-disk list. It should not happen — a
   * script only gets injected because its manifest scanned — but reporting the
   * message somewhere beats dropping it, which is the failure mode this whole
   * task exists to end. */
  const unmatchedFailures = failures.filter((d) => !kits.some((kit) => kit.displayName === d.kitModule));

  return (
    <CollapsableSection title="Node kits" hasGutter hasVisibleOverflow hasTopDivider>
      <div className={css.HelpText}>
        Create your own node. A kit is a folder under noodl_modules/ with one example node whose every visual
        decision is a port — colour, spacing and size default to design tokens, so it looks like the rest of the
        app from the first render.
      </div>

      {/*
        CN-007 AC4. A docs page nobody finds is the failure mode that produced this
        whole task: the mechanism existed the entire time and was invisible, so people
        went on following a 2.7 guide that could not work. This is the entry point that
        makes it reachable without already knowing it exists.
      */}
      <div className={css.ButtonRow}>
        <button
          onClick={() => platform.openExternal(DOCS_PAGES.customNodes)}
          data-test="kits-docs-link"
          style={{
            padding: '6px 0',
            fontSize: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--theme-color-primary)',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          Read: writing your own nodes →
        </button>
      </div>

      {/* ── CN-006b AC1: the list ─────────────────────────────────────────── */}

      {kits.length === 0 && <div className={css.EmptyState}>No node kits in this project yet.</div>}

      {kits.map((kit) => (
        <div key={kit.dirName} className={css.VariableCard} data-test={`kit-card-${kit.dirName}`}>
          <div className={css.VariableHeader}>
            <div className={css.VariableIdentity}>
              <span className={css.VariableKey} title={kit.displayName}>
                {kit.displayName}
              </span>
              {/*
                Version only when the kit declares one. 🔴 No kit in any of the 29
                real projects does, so this is dormant until CN-016 defines what a
                kit version means — and a hardcoded "v1.0.0" here would be a number
                nothing on disk ever said.
              */}
              <span className={css.VariableType}>{kit.version ? `v${kit.version}` : `noodl_modules/${kit.dirName}`}</span>
            </div>
            <button
              onClick={() => void handleRemove(kit)}
              title="Remove kit"
              data-test={`kit-remove-${kit.dirName}`}
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

          {/*
            ✅ **CN-017 AC3 — where this kit came from, on the list that decides
            whether to remove it.**

            🔴 Rendered from `describeKitOrigin`, the same function the property
            panel byline uses, so the two surfaces cannot describe one kit two
            ways. ⚠️ A kit with no record says so; it is NOT drawn as locally
            authored, because "we have no record" and "you wrote it" are different
            facts, and only one of them is evidence.
          */}
          <div
            style={{ marginTop: '2px', fontSize: '11px', color: 'var(--theme-color-fg-muted)' }}
            data-test={`kit-origin-${kit.dirName}`}
            title={describeKitOrigin(kit.provenance).title}
          >
            {describeKitOrigin(kit.provenance).label}
          </div>

          {/*
            ✅ **D3 in one sentence of UI.** A kit that has never been executed
            registers nothing, and the honest report of that is "not loaded yet",
            not "0 nodes" — the second reads like a broken kit and would send an
            author looking for a bug in code that is fine.
          */}
          {/*
            🔴 The failure comes FIRST and displaces the line below it. Showing
            both would be worse than showing neither: "installed, reload the
            preview" beside "this kit threw" invites the author to do the one
            thing that cannot help.
          */}
          {failuresFor(kit.displayName).map((diagnostic) => (
            <div
              key={diagnostic.code}
              data-test={`kit-failure-${kit.dirName}`}
              style={{
                marginTop: '4px',
                padding: '6px 8px',
                fontSize: '11px',
                color: 'var(--theme-color-error)',
                backgroundColor: 'var(--theme-color-error-bg)',
                border: '1px solid var(--theme-color-error)',
                borderRadius: '4px'
              }}
            >
              {diagnostic.message}
            </div>
          ))}

          {failuresFor(kit.displayName).length > 0 ? null : kit.nodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'var(--theme-color-fg-muted)' }} data-test="kit-not-loaded">
              Installed. Reload the preview to load its nodes — the picker lists what a running runtime has
              registered.
            </div>
          ) : (
            <button
              onClick={() => setExpanded((e) => ({ ...e, [kit.dirName]: !e[kit.dirName] }))}
              data-test={`kit-nodes-${kit.dirName}`}
              style={{
                padding: 0,
                fontSize: '11px',
                background: 'none',
                border: 'none',
                color: 'var(--theme-color-fg-muted)',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {expanded[kit.dirName] ? '▾' : '▸'} {kit.nodes.length} node{kit.nodes.length === 1 ? '' : 's'}
            </button>
          )}

          {expanded[kit.dirName] && kit.nodes.length > 0 && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--theme-color-fg-default)' }}>
              {kit.nodes.map((node) => (
                <div key={node} style={{ padding: '1px 0' }}>
                  {node}
                </div>
              ))}
            </div>
          )}

          {kit.nodeKitTypes && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--theme-color-fg-muted)' }}>
              Types {kit.nodeKitTypes}
            </div>
          )}
        </div>
      ))}

      {/*
        A kit whose folder is gone while its runtime is still live. Named rather
        than hidden: its nodes are still in the picker, and an author who has just
        deleted it is owed the reason they are still there.
      */}
      {orphans.map((orphan) => (
        <div key={orphan.name} className={css.VariableCard} data-test={`kit-orphan-${orphan.name}`}>
          <div className={css.VariableHeader}>
            <div className={css.VariableIdentity}>
              <span className={css.VariableKey}>{orphan.name}</span>
              <span className={css.VariableType}>not on disk</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--theme-color-fg-muted)' }}>
            The running preview still has {orphan.nodes.length} node{orphan.nodes.length === 1 ? '' : 's'} from this
            kit registered. Reload the preview to take them out of the picker.
          </div>
        </div>
      ))}

      {unmatchedFailures.map((diagnostic) => (
        <div
          key={diagnostic.kitModule}
          className={css.VariableCard}
          data-test={`kit-failure-unmatched-${diagnostic.kitModule}`}
        >
          <div className={css.VariableHeader}>
            <div className={css.VariableIdentity}>
              <span className={css.VariableKey}>{diagnostic.kitModule}</span>
              <span className={css.VariableType}>failed to load</span>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--theme-color-error)' }}>{diagnostic.message}</div>
        </div>
      ))}

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
