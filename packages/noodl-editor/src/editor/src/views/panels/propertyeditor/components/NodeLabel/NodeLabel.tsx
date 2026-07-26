import { useKeyboardCommands } from '@noodl-hooks/useKeyboardCommands';
import React, { useEffect, useRef, useState } from 'react';
import { platform } from '@noodl/platform';

import { Keybindings } from '@noodl-constants/Keybindings';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';
import { tracker } from '@noodl-utils/tracker';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
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

  function onOpenDocs() {
    if (!model.type.docs) return;

    // Update no version tag with version tag (and potentially switch to local docs)
    const docsUrl = model.type.docs.replace('https://docs.noodl.net', getDocsEndpoint());
    tracker.track('Open Node Docs Clicked', { url: docsUrl });
    platform.openExternal(docsUrl);
  }

  function onEditLabel() {
    setIsEditingLabel(true);
    requestAnimationFrame(() => {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    });
  }

  function onSaveLabel() {
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
        <div
          style={{ flexGrow: 1, overflow: 'hidden' }}
          onDoubleClick={(e) => {
            // Stop propagation to prevent canvas double-click handler from triggering
            e.stopPropagation();
            if (!isEditingLabel) {
              onEditLabel();
            }
          }}
        >
          <TextInput
            onRefChange={(ref) => (labelInputRef.current = ref.current)}
            value={label}
            isDisabled={!isEditingLabel}
            UNSAFE_textStyle={{
              color: 'var(--theme-color-fg-highlight)',
              fontSize: '14.5px',
              fontWeight: 'var(--font-weight-semibold)' as TSFixme
            }}
            variant={TextInputVariant.Transparent}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => onSaveLabel()}
            onEnter={() => onSaveLabel()}
          />
        </div>

        {!isEditingLabel && (
          <div className="sidebar-panel-edit-bar hide-on-edit property-panel-header-edit-bar">
            {showHelp && Boolean(model.type.docs) && (
              <div className="property-header-icon-button">
                <Tooltip content="Open Node Docs" fineType={Keybindings.PROPERTY_PANEL_OPEN_DOCS.label}>
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
