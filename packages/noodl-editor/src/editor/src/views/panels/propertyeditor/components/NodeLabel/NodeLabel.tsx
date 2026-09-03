import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import React, { useEffect, useRef, useState } from 'react';
import { platform } from '@noodl/platform';

import { Keybindings } from '@noodl-constants/Keybindings';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import { getNodeDocs } from '@noodl-utils/nodeDocs';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';
import { tracker } from '@noodl-utils/tracker';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { exportBadgeFor } from '@noodl-utils/codeExport/exportBadge';

import { describeKitOrigin, listNodeKits } from '../../../../../../../shared/utils/projectmodules';
import { ExportBadge } from '../../../../common/ExportBadge';
import { NodeGraphNodeDelete, NodeGraphNodeRename } from '../..';
import { getNodeProvenance } from '../../provenance';
import { getNodeTypeChipInfo } from '../../utils';

export interface NodeLabelProps {
  model: NodeGraphNode;
  showHelp?: boolean;
}

/**
 * 10px category glyph inside the header type-chip (PAR-002). Mirrors the
 * canvas painter's category glyph shapes (NodeGraphEditorNodePainter) so the
 * chip and the node card read as the same taxonomy.
 */
function CategoryGlyph({ category }: { category: string }) {
  const common = {
    width: 10,
    height: 10,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (category) {
    case 'visual':
      // Nested rectangles (frame-in-frame)
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
          <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
        </svg>
      );
    case 'data':
      // Database cylinder
      return (
        <svg {...common}>
          <ellipse cx="8" cy="4" rx="5.5" ry="2.2" />
          <path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" />
        </svg>
      );
    case 'javascript':
      // Function glyph
      return (
        <svg width={10} height={10} viewBox="0 0 16 16" fill="currentColor" stroke="none">
          <text x="8" y="8.5" textAnchor="middle" dominantBaseline="middle" fontFamily="Georgia, serif" fontStyle="italic" fontWeight={600} fontSize="13">
            ƒ
          </text>
        </svg>
      );
    case 'component':
      // Diamond
      return (
        <svg {...common}>
          <path d="M8 2.2 13.8 8 8 13.8 2.2 8 8 2.2Z" />
        </svg>
      );
    default:
      // Neutral circle
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.5" />
        </svg>
      );
  }
}

export function NodeLabel({ model, showHelp = true }: NodeLabelProps) {
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const isCancelling = useRef(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  // `model.label` resolves expression parameters at the source now (BasicNodeType.labelForNode,
  // FH-003), so this reads the same expression text the canvas card paints. The resolver call
  // stays as a belt-and-braces cast: a node type is free to return a non-string from
  // `labelForNode`, and this field must never be handed an object.
  const [label, setLabel] = useState(ParameterValueResolver.toString(model.label));

  // Listen for label changes on the model
  useEffect(() => {
    model.on(
      'labelChanged',
      () => {
        setLabel(ParameterValueResolver.toString(model.label));
      },
      this
    );

    return function () {
      model.off(this);
    };
  }, []);

  /**
   * ALPHA-006 §1. The help button used to be gated on `model.type.docs` and to
   * string-replace the legacy host out of it. Two things were wrong with that:
   * 17 node types carry no `docs` URL at all, so their button simply did not
   * exist, and 39 of the URLs that do exist point at a page that has moved or
   * was never written — a link that opens a 404.
   *
   * The bundled enriched catalog documents every node, so the button is now
   * present for all of them, its tooltip carries the node's summary (help you
   * can read without leaving the editor, and without a network), and the
   * external page is demoted to what it now is: a "read more".
   */
  const catalogDocs = getNodeDocs(model.type?.name);

  /**
   * CN-006b — ✅ **D1's provenance clause**, and ✅ **D6**'s hook: the property
   * panel is where a user finds out whose code is running.
   *
   * `module` is the kit's `manifest.json` name. It arrives on the exported node
   * type already — `nodelibraryexport.ts:406` copies `metadata.module`, which
   * `NoodlRuntime.registerModule` stamps onto every definition a kit registers,
   * and `BasicNodeType`'s constructor copies every field it is handed. Verified
   * against the recorded payload a real viewer sent (`kit-app.editor-nodelibrary.json`):
   * **2 of 177 types carry it, and both are the kit's**. Nothing needed plumbing;
   * it needed a reader.
   *
   * ⚠️ **A built-in has no `module`, so it gets no row** — which is AC2's second
   * half. There is nothing to attribute, and inventing "NodeGX" as a vendor would
   * make provenance decorative and stop it meaning "somebody else wrote this".
   */
  const { kitName, kitDocs, kitDocsUrl } = getNodeProvenance(model);

  /**
   * ✅ **CN-017 AC3 — the property panel is where a user finds out *whose* code
   * is running, and until now it said only that a kit provided the node.**
   *
   * 🔴 **Read only for a kit node.** `kitName` is absent on every built-in
   * (`getNodeProvenance` returns `{}`), so selecting an ordinary node performs no
   * read at all — the guard is what keeps a per-selection disk read off the path
   * that 175 of 177 node types take.
   *
   * ⚠️ **Joined on the manifest name, which is what this panel has.** The record
   * is keyed by folder name, so the join goes through `listNodeKits`, which
   * carries both — never by assuming the two strings are the same.
   */
  const [kitOrigin, setKitOrigin] = React.useState<{ label: string; title: string } | null>(null);
  React.useEffect(() => {
    if (!kitName) {
      setKitOrigin(null);
      return;
    }
    let cancelled = false;
    listNodeKits(ProjectModel.instance?._retainedProjectDirectory).then(
      (kits) => {
        if (cancelled) return;
        const kit = kits.find((k) => k.displayName === kitName);
        // ⚠️ A kit the list does not know is left BLANK rather than described as
        // unrecorded: "no provenance file" and "no such kit on disk" are different
        // facts, and this row can only speak to the first.
        setKitOrigin(kit ? describeKitOrigin(kit.provenance) : null);
      },
      () => {
        if (!cancelled) setKitOrigin(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [kitName]);

  /**
   * 🔴 **P1, and the spec was wrong about this field in a way that would have
   * shipped a dead link.** CN-006b says to link the node's docs because "the
   * `docs` field already exists". It exists — but it is **one field over two
   * vocabularies** (CN-008's finding, measured again here): on a shipped node
   * `docs` is a URL, and on a kit node it is the sentence the author wrote. On
   * the payload a real viewer sent, both kit nodes carry prose and **not one of
   * the 175 built-ins carries a `docs` field at all**. Rendering an author's
   * sentence as an `href` produces a link that opens nothing.
   *
   * So it is read as what it is: help text. That also closes a capability gap P1
   * forbids — `getNodeDocs` reads the enriched catalog, which is keyed by type
   * name and generated at repo-build time, so **a kit type can never be in it**
   * and until now a kit node was the one kind of node whose header had no help
   * button. Now the author's own sentence fills it, with no "read more" fine
   * type, because there is no page behind the click.
   */
  const nodeDocs: TSFixme =
    catalogDocs ||
    (kitDocs || kitDocsUrl
      ? {
          summary: kitDocs,
          path: undefined,
          // ✅ **D10.** The kit author's own page, as an ABSOLUTE url. It is a
          // separate field from `path` because the two are joined differently:
          // `path` is site-relative and gets `getDocsEndpoint()` prefixed
          // (which `useLocalDocs` may repoint at a local build), whereas this
          // is somebody else's site and must be opened exactly as written.
          // Putting a kit's URL in `path` would produce
          // `https://docs.noodl.net/https://…`.
          externalUrl: kitDocsUrl,
          typeName: model.type?.name
        }
      : undefined);

  function onOpenDocs() {
    // D10: a kit's page first — it is the only one a kit node can have, and a
    // kit type is never in the enriched catalog that fills `path`, so the two
    // branches cannot both be populated. Ordered rather than exclusive so a
    // future type carrying both still opens the author's own page.
    if (nodeDocs?.externalUrl) {
      tracker.track('Open Node Docs Clicked', { url: nodeDocs.externalUrl });
      platform.openExternal(nodeDocs.externalUrl);
      return;
    }

    // The catalog stores the page as an absolute legacy URL; `nodeDocs.path` is
    // the site-relative rewrite of it, joined here to the configured endpoint
    // (which `useLocalDocs` may point at a local docs build).
    if (!nodeDocs?.path) return;

    const docsUrl = getDocsEndpoint() + nodeDocs.path;
    tracker.track('Open Node Docs Clicked', { url: docsUrl });
    platform.openExternal(docsUrl);
  }

  function onEditLabel() {
    isCancelling.current = false;
    setIsEditingLabel(true);
    requestAnimationFrame(() => {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    });
  }

  function onSaveLabel() {
    // PNL-007: Escape reverts, and the blur that follows must not undo the
    // revert by committing whatever was in the field. A ref rather than state
    // because the blur handler's closure would still see the old state.
    if (isCancelling.current) {
      isCancelling.current = false;
      return;
    }

    // Only commit an actual edit: the input also blurs when it was never being
    // edited (opening a popout moves focus), and `setLabel` pushes an undo
    // entry unconditionally — so committing here would fill the undo queue
    // with phantom "change label" entries.
    if (isEditingLabel && label !== ParameterValueResolver.toString(model.label)) {
      NodeGraphNodeRename(model, label);
    }

    setIsEditingLabel(false);
    setLabel(ParameterValueResolver.toString(model.label));

    // Unselect text
    window.getSelection().removeAllRanges();
  }

  /** Escape: leave the model alone and put the field's text back. */
  function onCancelLabel() {
    isCancelling.current = true;
    setLabel(ParameterValueResolver.toString(model.label));
    setIsEditingLabel(false);
    window.getSelection().removeAllRanges();
  }

  useKeyboardCommands(() => [
    {
      handler: () => onOpenDocs(),
      keybinding: Keybindings.PROPERTY_PANEL_OPEN_DOCS.hash
    },
    {
      handler: () => {
        if (!isEditingLabel) {
          onEditLabel();
        }
      },
      keybinding: Keybindings.PROPERTY_PANEL_EDIT_LABEL.hash
    }
  ]);

  // PAR-002: the UIX-004b type-chip — node type + category, colored by the
  // same category metadata the canvas painter uses.
  const chip = getNodeTypeChipInfo(model);

  return (
    <div className="property-editor-label-and-buttons property-header-bar" style={{ flex: '0 0 auto' }}>
      <div className="property-header-row">
        {isEditingLabel ? (
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <TextInput
              onRefChange={(ref) => (labelInputRef.current = ref.current)}
              value={label}
              UNSAFE_textStyle={{
                color: 'var(--theme-color-fg-highlight)',
                fontSize: '14.5px',
                fontWeight: 'var(--font-weight-semibold)' as TSFixme
              }}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => onSaveLabel()}
              onEnter={() => onSaveLabel()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onCancelLabel();
                }
              }}
            />
          </div>
        ) : (
          // PNL-007: text, not a disabled field. It used to render a real
          // `TextInput` at all times with `isDisabled={!isEditingLabel}`, so at
          // rest it was a bordered box that refused the caret — "looks
          // constantly like a field you can type in but you have to click the
          // pencil". Double-click already worked; nothing said so.
          <Tooltip
            content="Double-click to rename"
            fineType={Keybindings.PROPERTY_PANEL_EDIT_LABEL.label}
            // The tooltip wraps its child in a trigger div, which is what the
            // header row actually lays out — without this the name cannot
            // shrink and a long one pushes the action rail out of the panel.
            UNSAFE_triggerClassName="property-header-name-trigger"
          >
            <span
              className="property-header-name"
              tabIndex={0}
              role="button"
              title={label}
              onDoubleClick={(e) => {
                // Stop propagation to prevent canvas double-click handler from triggering
                e.stopPropagation();
                onEditLabel();
              }}
              onKeyDown={(e) => {
                // Reachable without a mouse.
                if (e.key === 'Enter' || e.key === 'F2') {
                  e.preventDefault();
                  onEditLabel();
                }
              }}
            >
              {label}
            </span>
          </Tooltip>
        )}

        {isEditingLabel && (
          <div className="sidebar-panel-edit-bar property-panel-header-edit-bar">
            <div className="property-header-icon-button">
              <Tooltip content="Save the node label" fineType="Enter">
                <IconButton
                  icon={IconName.Check}
                  size={IconSize.Tiny}
                  variant={IconButtonVariant.OpaqueOnHover}
                  // The input's blur fires first and already commits; this is
                  // here so the gesture is discoverable, and is idempotent.
                  onClick={() => onSaveLabel()}
                />
              </Tooltip>
            </div>
            {/* Cancel has to act on mousedown: the click would arrive after
                the input's blur, which has already committed by then. */}
            <div
              className="property-header-icon-button"
              onMouseDown={(e) => {
                e.preventDefault();
                onCancelLabel();
              }}
            >
              <Tooltip content="Cancel" fineType="Esc">
                <IconButton icon={IconName.Close} size={IconSize.Tiny} variant={IconButtonVariant.OpaqueOnHover} />
              </Tooltip>
            </div>
          </div>
        )}

        {!isEditingLabel && (
          <div className="sidebar-panel-edit-bar hide-on-edit property-panel-header-edit-bar">
            {showHelp && Boolean(nodeDocs) && (
              <div className="property-header-icon-button">
                {/* The summary is the help; the fine-type line says whether
                    there is a page behind the click, so a button that opens
                    nothing is never offered as one that does. */}
                <Tooltip
                  content={nodeDocs.summary || 'Open Node Docs'}
                  fineType={
                    // D10: the fine type is the promise that a click goes
                    // somewhere. A kit's own page counts, so it is offered on
                    // either source — but still only when one of them exists,
                    // which is the rule this line was written to hold.
                    nodeDocs.path || nodeDocs.externalUrl
                      ? `Read more · ${Keybindings.PROPERTY_PANEL_OPEN_DOCS.label}`
                      : undefined
                  }
                  // A catalog summary is a full sentence, not a two-word label.
                  UNSAFE_tooltipMaxWidth="320px"
                >
                  <IconButton
                    icon={IconName.Question}
                    size={IconSize.Tiny}
                    variant={IconButtonVariant.OpaqueOnHover}
                    onClick={() => onOpenDocs()}
                  />
                </Tooltip>
              </div>
            )}

            <div className="property-header-icon-button">
              <Tooltip content="Edit the node label" fineType={Keybindings.PROPERTY_PANEL_EDIT_LABEL.label}>
                <IconButton
                  icon={IconName.Pencil}
                  size={IconSize.Tiny}
                  variant={IconButtonVariant.OpaqueOnHover}
                  onClick={() => onEditLabel()}
                />
              </Tooltip>
            </div>

            <div className="property-header-icon-button">
              <Tooltip content="Delete the node" fineType={Keybindings.PROPERTY_PANEL_DELETE.label}>
                <IconButton
                  icon={IconName.Trash}
                  size={IconSize.Tiny}
                  variant={IconButtonVariant.OpaqueOnHover}
                  onClick={() => {
                    NodeGraphNodeDelete(model);
                  }}
                />
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {chip && (
        <span
          className="property-type-chip"
          style={{
            color: `var(${chip.colorToken})`,
            backgroundColor: `color-mix(in srgb, var(${chip.colorToken}) 12%, transparent)`
          }}
        >
          <CategoryGlyph category={chip.category} />
          {chip.label}
        </span>
      )}

      {/*
        EXP-013 AC1 — the same mark the picker card carries, on the placed node. Beside the type
        chip because it is a fact about the *type*: every node of this type is left out of an
        export, and every node it fires with it. The full reason is the hover.
      */}
      <ExportBadge badge={exportBadgeFor(model.type?.name)} variant="header" />

      {/*
        CN-006b AC2 — the provenance row.
        ⚠️ **Attribution, never demotion.** The design test P1 sets for any pixel
        here is *does this help a user find the author, or does it tell them this
        node is worth less?* So this is muted body text in the same rail as the
        type chip — no warning colour, no "custom"/"third-party" badge, no icon
        that reads as a caveat. It says who wrote the node, in the same voice the
        chip says what kind of node it is.
      */}
      {kitName && (
        <span
          className="property-provenance-row"
          data-test="node-provenance"
          title={
            kitOrigin
              ? `Provided by the "${kitName}" node kit in this project. ${kitOrigin.title}`
              : `Provided by the "${kitName}" node kit in this project`
          }
        >
          from {kitName}
          {kitOrigin && (
            <span data-test="node-provenance-origin"> · {kitOrigin.label}</span>
          )}
        </span>
      )}
    </div>
  );
}
