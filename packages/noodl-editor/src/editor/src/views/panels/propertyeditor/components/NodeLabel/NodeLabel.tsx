import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import React, { useEffect, useRef, useState } from 'react';
import { platform } from '@noodl/platform';

import { Keybindings } from '@noodl-constants/Keybindings';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import { getNodeDocs } from '@noodl-utils/nodeDocs';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';
import { tracker } from '@noodl-utils/tracker';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { NodeGraphNodeDelete, NodeGraphNodeRename } from '../..';
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
  // Defensive: convert label to string (handles expression parameter objects)
  const [label, setLabel] = useState(ParameterValueResolver.toString(model.label));

  // Listen for label changes on the model
  useEffect(() => {
    model.on(
      'labelChanged',
      () => {
        // Defensive: convert label to string (handles expression parameter objects)
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
  const nodeDocs = getNodeDocs(model.type?.name);

  function onOpenDocs() {
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
                    nodeDocs.path
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
    </div>
  );
}
