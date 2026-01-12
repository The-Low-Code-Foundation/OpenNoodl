/**
 * BlocklyWorkspace Component
 *
 * React wrapper for Google Blockly visual programming workspace.
 * Provides integration with Noodl's node system for visual logic building.
 *
 * @module BlocklyEditor
 */

import DarkTheme from '@blockly/theme-dark';
import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import React, { useEffect, useRef } from 'react';

import css from './BlocklyWorkspace.module.scss';
import { initBlocklyIntegration } from './index';

export interface BlocklyWorkspaceProps {
  /** Initial workspace JSON (for loading saved state) */
  initialWorkspace?: string;
  /** Toolbox configuration */
  toolbox?: Blockly.utils.toolbox.ToolboxDefinition;
  /** Callback when workspace changes */
  onChange?: (workspace: Blockly.WorkspaceSvg, json: string, code: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Custom theme */
  theme?: Blockly.Theme;
}

/**
 * BlocklyWorkspace - React component for Blockly integration
 *
 * Handles:
 * - Blockly workspace initialization
 * - Workspace persistence (save/load)
 * - Change detection and callbacks
 * - Cleanup on unmount
 */
export function BlocklyWorkspace({
  initialWorkspace,
  toolbox,
  onChange,
  readOnly = false,
  theme
}: BlocklyWorkspaceProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const changeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Blockly workspace
  useEffect(() => {
    if (!blocklyDiv.current) return;

    // Initialize custom Noodl blocks and generators before creating workspace
    initBlocklyIntegration();

    console.log('🔧 [Blockly] Initializing workspace');

    // Inject Blockly with dark theme
    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: toolbox || getDefaultToolbox(),
      theme: theme || DarkTheme,
      readOnly: readOnly,
      trashcan: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: '#ccc',
        snap: true
      }
    });

    workspaceRef.current = workspace;

    // Load initial workspace if provided
    if (initialWorkspace) {
      try {
        const json = JSON.parse(initialWorkspace);
        Blockly.serialization.workspaces.load(json, workspace);
        console.log('✅ [Blockly] Loaded initial workspace');
      } catch (error) {
        console.error('❌ [Blockly] Failed to load initial workspace:', error);
      }
    }

    // Listen for changes - filter to only respond to finished workspace changes,
    // not UI events like dragging or moving blocks
    const changeListener = (event: Blockly.Events.Abstract) => {
      if (!onChange || !workspace) return;

      // Ignore UI events that don't change the workspace structure
      // These fire constantly during drags and can cause state corruption
      if (event.type === Blockly.Events.BLOCK_DRAG) return;
      if (event.type === Blockly.Events.BLOCK_MOVE && !event.isUiEvent) return; // Allow programmatic moves
      if (event.type === Blockly.Events.SELECTED) return;
      if (event.type === Blockly.Events.CLICK) return;
      if (event.type === Blockly.Events.VIEWPORT_CHANGE) return;
      if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) return;
      if (event.type === Blockly.Events.THEME_CHANGE) return;
      if (event.type === Blockly.Events.TRASHCAN_OPEN) return;

      // For UI events that DO change the workspace, debounce them
      const isUiEvent = event.isUiEvent;

      if (isUiEvent) {
        // Clear any pending timeout for UI events
        if (changeTimeoutRef.current) {
          clearTimeout(changeTimeoutRef.current);
        }

        // Debounce UI-initiated changes (user editing)
        changeTimeoutRef.current = setTimeout(() => {
          const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
          const code = javascriptGenerator.workspaceToCode(workspace);
          console.log('[Blockly] Generated code:', code);
          onChange(workspace, json, code);
        }, 300);
      } else {
        // Programmatic changes fire immediately (e.g., undo/redo, loading)
        const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
        const code = javascriptGenerator.workspaceToCode(workspace);
        console.log('[Blockly] Generated code:', code);
        onChange(workspace, json, code);
      }
    };

    workspace.addChangeListener(changeListener);

    // Cleanup
    return () => {
      console.log('🧹 [Blockly] Disposing workspace');

      // Clear any pending debounced calls
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
      }

      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [toolbox, theme, readOnly]);

  // NOTE: Do NOT reload workspace on initialWorkspace changes!
  // The initialWorkspace prop changes on every save, which would cause corruption.
  // Workspace is loaded ONCE on mount above, and changes are saved via onChange callback.

  return (
    <div className={css.Root}>
      <div ref={blocklyDiv} className={css.BlocklyContainer} />
    </div>
  );
}

/**
 * Default toolbox with Noodl-specific blocks
 */
function getDefaultToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
      // Noodl I/O Category
      {
        kind: 'category',
        name: 'Noodl Inputs/Outputs',
        colour: '230',
        contents: [
          { kind: 'block', type: 'noodl_define_input' },
          { kind: 'block', type: 'noodl_get_input' },
          { kind: 'block', type: 'noodl_define_output' },
          { kind: 'block', type: 'noodl_set_output' }
        ]
      },
      // Noodl Signals Category
      {
        kind: 'category',
        name: 'Noodl Signals',
        colour: '180',
        contents: [
          { kind: 'block', type: 'noodl_define_signal_input' },
          { kind: 'block', type: 'noodl_define_signal_output' },
          { kind: 'block', type: 'noodl_send_signal' }
        ]
      },
      // Noodl Variables Category
      {
        kind: 'category',
        name: 'Noodl Variables',
        colour: '330',
        contents: [
          { kind: 'block', type: 'noodl_get_variable' },
          { kind: 'block', type: 'noodl_set_variable' }
        ]
      },
      // Noodl Objects Category
      {
        kind: 'category',
        name: 'Noodl Objects',
        colour: '20',
        contents: [
          { kind: 'block', type: 'noodl_get_object' },
          { kind: 'block', type: 'noodl_get_object_property' },
          { kind: 'block', type: 'noodl_set_object_property' }
        ]
      },
      // Noodl Arrays Category
      {
        kind: 'category',
        name: 'Noodl Arrays',
        colour: '260',
        contents: [
          { kind: 'block', type: 'noodl_get_array' },
          { kind: 'block', type: 'noodl_array_length' },
          { kind: 'block', type: 'noodl_array_add' }
        ]
      },
      // Standard Logic blocks (useful for conditionals)
      {
        kind: 'category',
        name: 'Logic',
        colour: '210',
        contents: [
          { kind: 'block', type: 'controls_if' },
          { kind: 'block', type: 'logic_compare' },
          { kind: 'block', type: 'logic_operation' },
          { kind: 'block', type: 'logic_negate' },
          { kind: 'block', type: 'logic_boolean' }
        ]
      },
      // Standard Math blocks
      {
        kind: 'category',
        name: 'Math',
        colour: '230',
        contents: [
          { kind: 'block', type: 'math_number' },
          { kind: 'block', type: 'math_arithmetic' },
          { kind: 'block', type: 'math_single' }
        ]
      },
      // Standard Text blocks
      {
        kind: 'category',
        name: 'Text',
        colour: '160',
        contents: [
          { kind: 'block', type: 'text' },
          { kind: 'block', type: 'text_join' },
          { kind: 'block', type: 'text_length' }
        ]
      }
    ]
  };
}
