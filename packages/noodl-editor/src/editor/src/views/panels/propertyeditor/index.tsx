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
import { PortsTab } from './components/PortsTab';
import { PropertyEditor as PropertyEditorView } from './propertyeditor';

const TAB_AI_CHAT = 'AI Chat';
const TAB_PROPERTIES = 'Properties';
const TAB_PORTS = 'Ports';

/**
 * FH-020: which tab is open, remembered per *panel* rather than per node.
 *
 * It has to be module state, not `useState`. `SidebarModel.createPanel` builds a
 * brand-new function component on every node selection and `SidePanel` re-creates
 * the element from it, so the element *type* changes identity and React unmounts
 * and remounts this component every time you click a different node. A tab that
 * resets on every click is a tab nobody keeps open — and keeping it open is the
 * whole point of the "pathway helper" job, where you click a chip to travel to
 * the connected node and want to land on its ports.
 */
let rememberedTab: string = TAB_PROPERTIES;

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
      <PropertyEditorTabs {...props} instance={instance} hasAiAssistant={Boolean(aiAssistant)} />
    </BasePanel>
  );
}

/**
 * The panel body: a node header, then the tab strip.
 *
 * FH-020 slice 1 promoted this out of the AI-assistant-only path — the shape was
 * already built and mounted in the right container, and was reachable by about
 * one user in a hundred. `Properties | Ports` normally, with `AI Chat` in front
 * when the assistant is on. `NodeLabel` stays above the strip either way.
 *
 * The tab content is *not* kept alive: switching away unmounts the `Frame`, and
 * remounting re-appends the same long-lived `instance.el`. That is exactly what
 * the AI path has always done between `AI Chat` and `Properties`.
 */
function PropertyEditorTabs(props: PropertyEditorProps & { instance: PropertyEditorView; hasAiAssistant: boolean }) {
  const tabs = [
    {
      label: TAB_PROPERTIES,
      content: (
        <ScrollArea>
          <Frame instance={props.instance} isContentSize UNSAFE_style={{ flex: 1 }} />
        </ScrollArea>
      )
    },
    {
      label: TAB_PORTS,
      content: <PortsTab model={props.model} />
    }
  ];

  if (props.hasAiAssistant) {
    tabs.unshift({
      label: TAB_AI_CHAT,
      content: (
        <AiChat
          model={props.model}
          onUpdated={() => {
            // Update the property panel values
            props.instance.render();
          }}
        />
      )
    });
  }

  // A remembered `AI Chat` must not survive onto a node that has no assistant —
  // `Tabs` looks the active id up in its own list and would throw on a miss.
  const initialActiveTab = tabs.some((tab) => tab.label === rememberedTab) ? rememberedTab : TAB_PROPERTIES;

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        // PAR-002: the panel sits on bg-1 (mock `.props`); the legacy shell and
        // the header are transparent so this is the single panel ground.
        backgroundColor: 'var(--theme-color-bg-1)'
      }}
    >
      {Boolean(props.model) && <NodeLabel model={props.model} showHelp={!props.hasAiAssistant} />}

      <Tabs
        variant={TabsVariant.Sidebar}
        tabs={tabs}
        initialActiveTab={initialActiveTab}
        onChange={(activeTab) => {
          rememberedTab = activeTab;
        }}
      />
    </div>
  );
}
