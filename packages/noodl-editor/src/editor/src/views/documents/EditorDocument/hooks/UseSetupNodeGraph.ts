import { useEffect, useRef, useState } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getDefaultComponent } from '@noodl-models/projectmodel.utils';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { NodeGraphEditor } from '../../../nodegrapheditor';

export function useSetupNodeGraph(nodeGraph: NodeGraphEditor) {
  //set nodegraph to a component when it's first created
  useSwitchToDefaultComponent(nodeGraph);

  //If the project is reloaded all the ComponentModels are new, so the node graph will have an old model as it's active component.
  //So we need to switch to the new version
  useSwitchToSameComponentAfterProjectReload(nodeGraph);

  //If the active component in the node graph is removed, switch to another component
  useSwitchComponentAfterActiveComponentDeleted(nodeGraph);

  //If the component we're showing was reloaded from disk, follow it to the new model
  useFollowComponentReloadedFromDisk(nodeGraph);
}

function useSwitchToDefaultComponent(nodeGraph: NodeGraphEditor) {
  useEffect(() => {
    const component = getDefaultComponent();
    nodeGraph.switchToComponent(component, { pushHistory: true });
  }, [nodeGraph]);
}

function useSwitchToSameComponentAfterProjectReload(nodeGraph: NodeGraphEditor) {
  useEffect(() => {
    const eventGroup = {};
    EventDispatcher.instance.on(
      'ProjectModel.instanceWillChange',
      () => {
        const activeComponentName = nodeGraph.activeComponent?.fullName;

        if (activeComponentName) {
          const hasChangedEventGroup = {};
          EventDispatcher.instance.on(
            'ProjectModel.instanceHasChanged',
            () => {
              EventDispatcher.instance.off(hasChangedEventGroup);

              // The instance can be cleared rather than replaced (routing back
              // to the launcher). Nothing to switch to in that case, and
              // throwing here unmounts the whole editor.
              const component = ProjectModel.instance?.getComponentWithName(activeComponentName);
              if (component) {
                nodeGraph.switchToComponent(component);
              }
            },
            hasChangedEventGroup
          );
        }
      },
      eventGroup
    );

    return () => EventDispatcher.instance.off(eventGroup);
  }, [nodeGraph]);
}

function useSwitchComponentAfterActiveComponentDeleted(nodeGraph: NodeGraphEditor) {
  const [project, setProject] = useState(ProjectModel.instance);

  //Track the currently active project
  useEffect(() => {
    const eventGroup = {};
    EventDispatcher.instance.on('ProjectModel.instanceHasChanged', () => setProject(ProjectModel.instance), eventGroup);
    return () => EventDispatcher.instance.off(eventGroup);
  }, []);

  useEffect(() => {
    const eventGroup = {};
    project.on(
      'componentRemoved',
      ({ model, reloadingFromDisk }: { model: ComponentModel; reloadingFromDisk?: boolean }) => {
        // REL-009b §4 U3. `reloadComponentFromDisk` swaps a component by removing
        // the old model and adding the new one, so the component the person is
        // looking at is momentarily "removed" — and this handler would answer
        // that by navigating them to the default component. The reload is not a
        // deletion and nothing here should treat it as one;
        // `useFollowComponentReloadedFromDisk` below puts the new model on the
        // canvas instead, in the same tick, with no visit to another component.
        if (reloadingFromDisk) return;

        if (nodeGraph.activeComponent === model) {
          const component = getDefaultComponent();
          nodeGraph.switchToComponent(component);
        }
      },
      eventGroup
    );

    return () => {
      project.off(eventGroup);
    };
  }, [project, nodeGraph]);
}

/**
 * REL-009b AC2 — when a component is reloaded from disk (an agent authoring over
 * MCP, a git checkout, a peer's sync), the model the canvas holds is replaced by
 * a new `ComponentModel` built from the file. A canvas still pointing at the old
 * one shows a detached graph: the nodes are there, they are just no longer the
 * nodes anyone else is talking about, and nothing on screen says so.
 *
 * So follow the swap. Only when we were showing the component that moved —
 * reloading something off-screen must not steal the person's place.
 */
function useFollowComponentReloadedFromDisk(nodeGraph: NodeGraphEditor) {
  const [project, setProject] = useState(ProjectModel.instance);
  const wasShowingReloadedComponent = useRef(false);

  useEffect(() => {
    const eventGroup = {};
    EventDispatcher.instance.on('ProjectModel.instanceHasChanged', () => setProject(ProjectModel.instance), eventGroup);
    return () => EventDispatcher.instance.off(eventGroup);
  }, []);

  useEffect(() => {
    const eventGroup = {};

    /**
     * 🔴 Answer "were we showing it?" at REMOVAL time, not at reload time.
     *
     * `reloadComponentFromDisk` fans its swap out over two event buses and
     * several listeners, and `nodeGraph.activeComponent` is live state that any
     * of them may clear before this one runs — which is exactly what happened
     * when this was first written: `EditorEventBindings`' `typeRemoved` handler
     * set it to `undefined` between the remove and the add, so a check made
     * here read "we were not showing it" and the canvas stayed blank. That
     * handler is guarded now, but reading a value some other listener may have
     * moved is the fragility, not the particular listener that moved it.
     */
    project.on(
      'componentRemoved',
      ({ model, reloadingFromDisk }: { model: ComponentModel; reloadingFromDisk?: boolean }) => {
        if (reloadingFromDisk) wasShowingReloadedComponent.current = nodeGraph.activeComponent === model;
      },
      eventGroup
    );

    project.on(
      'componentReloadedFromDisk',
      ({ component, previous }: { component: ComponentModel; previous?: ComponentModel }) => {
        const wasShowing = wasShowingReloadedComponent.current;
        wasShowingReloadedComponent.current = false;

        // No `previous` means the component was not in the project before this
        // reload, so nobody can have been looking at it.
        if (!previous || !wasShowing) return;

        nodeGraph.switchToComponent(component);
      },
      eventGroup
    );

    return () => {
      project.off(eventGroup);
    };
  }, [project, nodeGraph]);
}
