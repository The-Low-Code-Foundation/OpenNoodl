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

import { RAIL_WIDTH, useSidePanelLayoutContext } from '../../pages/EditorPage/useSidePanelLayout';
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

  /**
   * PNL-009: panels that cannot take a detached mode.
   *
   * The modes are CSS-only — the panel element never changes parent, so the
   * legacy imperative views that `propertyeditor`, `ProjectSettingsPanel` and
   * `componentports` host through `Frame` are never unmounted. This list is the
   * escape hatch if that ever stops being true for a particular panel: the
   * float/full buttons go disabled with a reason rather than breaking it.
   */
  const LEGACY_HOSTING_PANELS: string[] = [];
  const canDetach = !LEGACY_HOSTING_PANELS.includes(activeId);
  const legacyReason = 'This panel hosts a legacy view and cannot be detached';

  const isFloating = layout?.mode === 'floating';
  const isDetached = isFloating || layout?.mode === 'full';
  const activePanelName = SidebarModel.instance.getPanel(activeId)?.name ?? '';

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
      {/* PNL-009: float and full. Disabled for panels that host legacy
          imperative views — see `canFloat` below. */}
      <Tooltip
        content={layout.mode === 'floating' ? 'Dock panel' : canDetach ? 'Float over the canvas' : legacyReason}
        showAfterMs={300}
      >
        <IconButton
          variant={IconButtonVariant.Transparent}
          icon={IconName.Cards}
          isDisabled={!canDetach}
          testId="side-panel-float-toggle"
          onClick={layout.toggleFloating}
        />
      </Tooltip>
      <Tooltip
        content={layout.mode === 'full' ? 'Dock panel' : canDetach ? 'Fill the editor' : legacyReason}
        showAfterMs={300}
      >
        <IconButton
          variant={IconButtonVariant.Transparent}
          icon={IconName.ViewportDiagonalArrow}
          isDisabled={!canDetach}
          testId="side-panel-full-toggle"
          onClick={layout.toggleFull}
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
    // width — the rail stays usable while the panel is collapsed. In a detached
    // mode the rail stays live and the mode persists across the switch, which is
    // the point of full mode.
    layout?.revealIfHidden();
    sidebar.switch(item.id);
    item.onClick && item.onClick();
  }

  // PNL-009: Escape returns a detached panel to docked. Registered directly
  // rather than through `useKeyboardCommands` because the popup layer also binds
  // Escape and should keep winning while a popup is open.
  useEffect(() => {
    if (!isDetached) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // Something dismissible is open — it owns Escape first.
      if (document.querySelector('.popup-layer-popout')) return;
      layout?.dock();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isDetached, layout]);

  /** Drag the floating card by its bar; resize it by the corner grip. */
  function startFloatGesture(e: React.PointerEvent, kind: 'move' | 'resize') {
    if (!layout?.editorArea) return;
    e.preventDefault();
    const area = layout.editorArea;
    const start = layout.floatRect;
    const originX = e.clientX;
    const originY = e.clientY;
    const bounds = { width: area.width, height: area.height };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      layout.setFloatRect(
        kind === 'move'
          ? { ...start, x: start.x + dx, y: start.y + dy }
          : { ...start, width: start.width + dx, height: start.height + dy },
        bounds
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  const panelStyle: React.CSSProperties | undefined = (() => {
    if (!layout || !isDetached || !layout.editorArea) return undefined;
    const area = layout.editorArea;
    if (layout.mode === 'full') {
      return {
        left: area.x + RAIL_WIDTH,
        top: area.y,
        width: Math.max(0, area.width - RAIL_WIDTH),
        height: area.height
      };
    }
    const r = layout.floatRect;
    return { left: area.x + r.x, top: area.y + r.y, width: r.width, height: r.height };
  })();

  return (
    <SideNavigation
      onExitClick={() => App.instance.exitProject()}
      panelMode={isDetached ? (isFloating ? 'floating' : 'full') : 'docked'}
      panelStyle={panelStyle}
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
          {/* PNL-009: a detached panel gets its own bar — the thing you grab to
              move a floating card, and the close route the six hand-rolled
              full-screen overlays never had. */}
          {isDetached && (
            <div
              className={css['DetachedBar']}
              onPointerDown={isFloating ? (e) => startFloatGesture(e, 'move') : undefined}
              data-test="side-panel-detached-bar"
              style={{ cursor: isFloating ? 'grab' : 'default' }}
            >
              <span className={css['DetachedTitle']}>{activePanelName}</span>
              <IconButton
                variant={IconButtonVariant.Transparent}
                icon={IconName.Close}
                testId="side-panel-dock-button"
                onClick={() => layout?.dock()}
              />
            </div>
          )}

          <div className={css['PanelItems']}>
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

          {isFloating && (
            <div
              className={css['ResizeGrip']}
              data-test="side-panel-resize-grip"
              onPointerDown={(e) => startFloatGesture(e, 'resize')}
            />
          )}
        </PanelModeSlotProvider>
      }
    />
  );
}
