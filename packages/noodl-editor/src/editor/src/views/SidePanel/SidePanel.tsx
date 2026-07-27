import { nextTick } from 'process';
import { useModernModel } from '@noodl-hooks/useModel';
import React, { useState, useEffect } from 'react';

import { App } from '@noodl-models/app';
import { SidebarItem, SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { SideNavigation, SideNavigationButton } from '@noodl-core-ui/components/app/SideNavigation';
import { ErrorBoundary } from '@noodl-core-ui/components/common/ErrorBoundary';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Container, ContainerDirection } from '@noodl-core-ui/components/layout/Container';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { PanelModeSlotProvider } from '@noodl-core-ui/components/sidebar/PanelHeader';

import { useSidePanelLayoutContext } from '../../pages/EditorPage/useSidePanelLayout';
import css from './SidePanel.model.scss';

export function SidePanel() {
  const [group] = useState({});
  const layout = useSidePanelLayoutContext();

  const sidebar = useModernModel(SidebarModel.instance, [SidebarModelEvent.itemsChanged]);

  // Get all the visible toolbar icons
  const items = sidebar.getVisibleItems();

  // All the panel data
  const [activeId, setActiveId] = useState(null);
  const [panels, setPanels] = useState<Record<string, React.ReactElement>>({});

  useEffect(() => {
    // ---
    // Add the first panel
    const currentPanelId = SidebarModel.instance.ActiveId;

    setPanels((prev) => {
      const component = SidebarModel.instance.getPanelComponent(currentPanelId);
      if (component) {
        return {
          ...prev,
          [currentPanelId]: React.createElement(component)
        };
      }
      return prev;
    });

    setActiveId(currentPanelId);

    // ---
    // Listen to when a new panel is opened, also add them if they dont exist.
    SidebarModel.instance.on(
      SidebarModelEvent.activeChanged,
      (panelId) => {
        const panel = SidebarModel.instance.getPanel(panelId);

        // if transient, then always create it again
        if (panel.transient || !panels[panelId]) {
          setPanels((prev) => {
            // TODO: Clean up this inside SidebarModel, createElement can be done here instead
            const component = SidebarModel.instance.getPanelComponent(panelId);
            if (component) {
              return {
                ...prev,
                [panelId]: React.createElement(component)
              };
            }
            return prev;
          });
        }

        setActiveId(panelId);
      },
      group
    );

    // ---
    // Listen for node selection changes to force PropertyEditor recreation
    // This ensures the panel updates when switching between different nodes
    SidebarModel.instance.on(
      SidebarModelEvent.nodeSelected,
      () => {
        const panelId = 'PropertyEditor';
        setPanels((prev) => {
          const component = SidebarModel.instance.getPanelComponent(panelId);
          if (component) {
            // Force recreation with new node props - MUST return new object for React to detect change
            return {
              ...prev,
              [panelId]: React.createElement(component)
            };
          }
          return prev;
        });
      },
      group
    );

    // ---
    // Support Hot reload on all panels
    SidebarModel.instance.on(SidebarModelEvent.HotReload, () => {
      nextTick(() => {
        console.log('[hot-reload] Side Panel');

        const currentPanelId = SidebarModel.instance.ActiveId;
        const component = SidebarModel.instance.getPanelComponent(currentPanelId);

        setPanels({
          [currentPanelId]: React.createElement(component)
        });

        setActiveId(currentPanelId);
      });
    });

    return function () {
      SidebarModel.instance.off(group);
    };
  }, []);

  // PNL-003: the two controls that belong to the side panel rather than to any
  // one panel. They go into `PanelHeader`'s mode slot so every `BasePanel` gets
  // them without a second header component existing; PNL-005 formalises the slot.
  const modeSlot = layout ? (
    <>
      <Tooltip content={layout.mode === 'wide' ? 'Narrow panel' : 'Widen panel'} fineType="⌘\" showAfterMs={300}>
        <IconButton
          variant={IconButtonVariant.Transparent}
          icon={layout.mode === 'wide' ? IconName.ArrowsInLineHorizontal : IconName.ViewportHorizontalArrow}
          testId="side-panel-wide-toggle"
          onClick={layout.toggleWide}
        />
      </Tooltip>
      <Tooltip content="Hide panel" fineType="⌘B" showAfterMs={300}>
        <IconButton
          variant={IconButtonVariant.Transparent}
          icon={IconName.ArrowLineLeft}
          testId="side-panel-hide-toggle"
          onClick={layout.toggleHidden}
        />
      </Tooltip>
    </>
  ) : null;

  function onItemClick(item: SidebarItem) {
    // PNL-003: clicking any rail icon brings a hidden panel back at its last
    // width — the rail stays usable while the panel is collapsed.
    layout?.revealIfHidden();
    sidebar.switch(item.id);
    item.onClick && item.onClick();
  }

  return (
    <SideNavigation
      onExitClick={() => App.instance.exitProject()}
      toolbar={
        <>
          <Container direction={ContainerDirection.Vertical} UNSAFE_style={{ flex: '1' }}>
            {items
              .filter((x) => !x.placement || x.placement === 'top')
              .map((item) => (
                <SideNavigationButton
                  key={item.id}
                  isActive={item.id === activeId}
                  icon={item.icon}
                  onClick={() => onItemClick(item)}
                  label={item.name}
                  fineType={item.fineType}
                  isDisabled={item.isDisabled}
                  testId={item.id + '-panel'}
                />
              ))}
          </Container>
          <Container direction={ContainerDirection.Vertical}>
            {items
              .filter((x) => x.placement === 'bottom')
              .map((item) => (
                <SideNavigationButton
                  key={item.id}
                  isActive={item.id === activeId}
                  icon={item.icon}
                  onClick={() => onItemClick(item)}
                  label={item.name}
                  testId={item.id + '-panel'}
                />
              ))}
          </Container>
        </>
      }
      panel={
        <PanelModeSlotProvider slot={modeSlot}>
          <div style={{ height: '100%' }}>
            {Object.entries(panels).map(([id, panel]) => (
              <div
                key={id}
                data-panel-id={id}
                className={css['PanelItem']}
                style={{
                  display: id === activeId ? 'block' : 'none'
                }}
              >
                <ErrorBoundary
                  showTryAgain
                  onTryAgain={() => {
                    // Recreate all the panels, hopefully it will work again
                    setPanels({});

                    nextTick(() => {
                      const currentPanelId = SidebarModel.instance.ActiveId;
                      const component = SidebarModel.instance.getPanelComponent(currentPanelId);

                      setPanels({
                        [currentPanelId]: React.createElement(component)
                      });

                      setActiveId(currentPanelId);
                    });
                  }}
                >
                  {panel}
                </ErrorBoundary>
              </div>
            ))}
          </div>
        </PanelModeSlotProvider>
      }
    />
  );
}
