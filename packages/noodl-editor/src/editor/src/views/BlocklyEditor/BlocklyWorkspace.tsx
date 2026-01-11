/**
 * BlocklyWorkspace Component
 *
 * React wrapper for Google Blockly visual programming workspace.
 * Provides integration with Noodl's node system for visual logic building.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import React, { useEffect, useRef, useState } from 'react';

import css from './BlocklyWorkspace.module.scss';

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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Blockly workspace
  useEffect(() => {
    if (!blocklyDiv.current) return;

    console.log('🔧 [Blockly] Initializing workspace');

    // Inject Blockly
    const workspace = Blockly.inject(blocklyDiv.current, {
      toolbox: toolbox || getDefaultToolbox(),
      theme: theme,
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

    setIsInitialized(true);

    // Listen for changes
    const changeListener = () => {
      if (onChange && workspace) {
        const json = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
        const code = Blockly.JavaScript.workspaceToCode(workspace);
        onChange(workspace, json, code);
      }
    };

    workspace.addChangeListener(changeListener);

    // Cleanup
    return () => {
      console.log('🧹 [Blockly] Disposing workspace');
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
      setIsInitialized(false);
    };
  }, [toolbox, theme, readOnly]);

  // Handle initial workspace separately to avoid re-initialization
  useEffect(() => {
    if (isInitialized && initialWorkspace && workspaceRef.current) {
      try {
        const json = JSON.parse(initialWorkspace);
        Blockly.serialization.workspaces.load(json, workspaceRef.current);
      } catch (error) {
        console.error('❌ [Blockly] Failed to update workspace:', error);
      }
    }
  }, [initialWorkspace]);

  return (
    <div className={css.Root}>
      <div ref={blocklyDiv} className={css.BlocklyContainer} />
    </div>
  );
}

/**
 * Default toolbox with standard Blockly blocks
 * This will be replaced with Noodl-specific toolbox
 */
function getDefaultToolbox(): Blockly.utils.toolbox.ToolboxDefinition {
  return {
    kind: 'categoryToolbox',
    contents: [
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
