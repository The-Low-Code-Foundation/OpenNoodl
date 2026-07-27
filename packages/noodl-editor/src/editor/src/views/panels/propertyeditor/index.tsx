import React, { useEffect, useState } from 'react';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { Frame } from '../../common/Frame';
import { ToastLayer } from '../../ToastLayer/ToastLayer';
import { AiChat } from './components/AiChat';
import { NodeLabel } from './components/NodeLabel';
import { PropertyEditor as PropertyEditorView } from './propertyeditor';

export function NodeGraphNodeRename(model: NodeGraphNode, newname: string) {
  model.setLabel(newname, { undo: true, label: 'change label' });
}

export function NodeGraphNodeDelete(model: NodeGraphNode) {
  if (!model.canBeDeleted()) {
    ToastLayer.showError('This node cannot be deleted');
    return;
  }

  const graph = model.owner;
  const undo = new UndoActionGroup({ label: 'delete node' });
  graph.removeNode(model, { undo: undo });
  UndoQueue.instance.push(undo);
}

export interface PropertyEditorProps {
  model: NodeGraphNode;
}

export function PropertyEditor(props: PropertyEditorProps) {
  const [group] = useState({});
  const [instance, setInstance] = useState<PropertyEditorView>(null);

  useEffect(() => {
    const instance = new PropertyEditorView(props);
    instance.render();
    setInstance(instance);

    SidebarModel.instance.on(
      SidebarModelEvent.receivedCommand,
      (panelId, command, args) => {
        if (panelId !== 'PropertyEditor') return;

        // Disable double click for AI Nodes
        // For now lets allow Function nodes (JavaScriptFunction)
        const aiAssistant = props.model?.metadata?.AiAssistant;
        if (aiAssistant && props.model?.typename !== 'JavaScriptFunction') return;

        switch (command) {
          case 'doubleClick': {
            instance.doubleClick(args.model);
            break;
          }
        }
      },
      group
    );

    return function () {
      SidebarModel.instance.off(group);
    };
  }, [props.model]); // FIX: Update when model changes!

  const aiAssistant = props.model?.metadata?.AiAssistant;

  // PAR-002: the panel sits on bg-1 (mock `.props`); the legacy shell and the
  // header are transparent so this is the single panel ground.
  const panelStyle: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--theme-color-bg-1)'
  };

  /*
   * PNL-005: the property editor gets the shared `PanelHeader`, like every other
   * registered panel.
   *
   * It is not a duplicate of the node header below it. That bar (PNL-007 /
   * PAR-002 own its *contents* — the node name, the type chip, rename/docs/
   * delete) names the *subject*; this one names the *panel*, and it is the only
   * thing that carries the side panel's own mode controls. Without it, selecting
   * a node switched to a panel with no widen, no hide and no float/full at all —
   * `PanelHeader`'s mode slot is where those live.
   *
   * `UNSAFE_style` keeps PAR-002's bg-1 ground; `UNSAFE_content_style` drops
   * `BasePanel`'s insets because the legacy `Frame` views underneath bring their
   * own, and `isFill` keeps the flex chain Root → Inner → ChildrenContainer →
   * ScrollArea → Frame exactly the shape it already was.
   */
  return (
    <BasePanel
      title="Properties"
      isFill
      UNSAFE_style={{ backgroundColor: 'var(--theme-color-bg-1)' }}
      UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}
    >
      {aiAssistant ? (
        <AiPropertyEditor {...props} instance={instance} />
      ) : (
        <div style={panelStyle}>
          {Boolean(props.model) && <NodeLabel {...props} />}

          <ScrollArea>
            <Frame instance={instance} isContentSize UNSAFE_style={{ flex: 1 }} />
          </ScrollArea>
        </div>
      )}
    </BasePanel>
  );
}

function AiPropertyEditor(props: PropertyEditorProps & { instance: PropertyEditorView }) {
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--theme-color-bg-1)'
      }}
    >
      <NodeLabel {...props} showHelp={false} />
      <Tabs
        variant={TabsVariant.Sidebar}
        tabs={[
          {
            label: 'AI Chat',
            content: (
              <AiChat
                model={props.model}
                onUpdated={() => {
                  // Update the property panel values
                  props.instance.render();
                }}
              />
            )
          },
          {
            label: 'Properties',
            content: (
              <ScrollArea>
                <Frame instance={props.instance} isContentSize UNSAFE_style={{ flex: 1 }} />
              </ScrollArea>
            )
          }
        ]}
      />
    </div>
  );
}
