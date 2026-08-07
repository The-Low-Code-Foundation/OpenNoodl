import { nextTick } from 'process';
import { useModernModel } from '@noodl-hooks/useModel';
import React, { useState, useEffect, useRef } from 'react';

import { App } from '@noodl-models/app';
import { SidebarItem, SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';

import { SideNavigation, SideNavigationButton } from '@noodl-core-ui/components/app/SideNavigation';
import { ErrorBoundary } from '@noodl-core-ui/components/common/ErrorBoundary';
import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Container, ContainerDirection } from '@noodl-core-ui/components/layout/Container';
import { MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { PanelModeSlotProvider } from '@noodl-core-ui/components/sidebar/PanelHeader';

import { RAIL_WIDTH, useSidePanelLayoutContext } from '../../pages/EditorPage/useSidePanelLayout';
import { showContextMenuInPopup } from '../ShowContextMenuInPopup';
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

  const floatLabel = layout?.mode === 'floating' ? 'Dock panel' : 'Float over the canvas';
  const fullLabel = layout?.mode === 'full' ? 'Dock panel' : 'Fill the editor';

  // PNL-009: the `⋯` the mock asks for, and PNL-005 deliberately did not build.
  //
  // Under a 357px frame `PanelHeader.module.scss` hides everything tagged
  // `data-panel-chrome="secondary"`. PNL-005 left the hook but tagged nothing,
  // on the reasoning that hiding float and full without somewhere to put them is
  // a functional loss — correct, and this is the somewhere. The trade it made
  // instead ("the title absorbs the squeeze") is what rendered the Components
  // panel's title as "Co…".
  const overflowButtonRef = useRef<HTMLButtonElement>(null);

  function showModeOverflowMenu(event?: React.MouseEvent<HTMLButtonElement>) {
    if (!layout) return;
    const items: (MenuDialogItem | 'divider')[] = [
      {
        label: floatLabel,
        icon: IconName.Cards,
        isDisabled: !canDetach,
        tooltip: canDetach ? undefined : legacyReason,
        onClick: () => layout.toggleFloating(),
        testId: 'side-panel-float-menu-item'
      },
      {
        label: fullLabel,
        icon: IconName.ViewportDiagonalArrow,
        isDisabled: !canDetach,
        tooltip: canDetach ? undefined : legacyReason,
        onClick: () => layout.toggleFull(),
        testId: 'side-panel-full-menu-item'
      }
    ];

    // Anchored to the button, not to the mouse: a floating panel moves and the
    // cursor does not, and this is the one popup in the editor that is always
    // opened from inside a panel that may have been dragged anywhere.
    //
    // The clicked element first, the ref second. They are normally the same
    // button, but "normally" is doing real work: when the ref came back empty the
    // anchor silently fell through to `screen.getCursorScreenPoint()`, and under a
    // synthesised click the OS cursor has not moved — so the menu appeared in the
    // window's top-left corner instead of under the ⋯. `event.currentTarget` is
    // the element the handler is attached to, by definition, so it cannot be the
    // wrong button and cannot be unmounted while its own click is being handled.
    const anchor = event?.currentTarget ?? overflowButtonRef.current ?? undefined;

    showContextMenuInPopup({
      items,
      width: MenuDialogWidth.Default,
      attachTo: anchor,
      position: 'bottom'
    });
  }

  // PNL-003: the controls that belong to the side panel rather than to any one
  // panel. They go into `PanelHeader`'s mode slot so every `BasePanel` gets them
  // without a second header component existing; PNL-005 formalises the slot.
  const modeSlot = layout ? (
    <>
      {/* POL-003: this was the only one of the four with no wrapper, which is why
          it sat 5px above its neighbours — measured in the running editor, centres
          at y=48 against y=53 for the other three. `Tooltip` renders a
          block-level trigger div, so a bare control and a wrapped one do not land
          on the same baseline. */}
      <span className={css['ModeControl']}>
        <Tooltip content={layout.mode === 'wide' ? 'Narrow panel' : 'Widen panel'} fineType="⌘\" showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={layout.mode === 'wide' ? IconName.FoldHorizontal : IconName.UnfoldHorizontal}
            size={IconSize.Large}
            testId="side-panel-wide-toggle"
            onClick={layout.toggleWide}
          />
        </Tooltip>
      </span>
      {/* PNL-009: float and full. Demotable — under a 357px frame these two are
          hidden and the `⋯` below takes their place. The tag sits on a wrapper
          rather than on the button because `Tooltip` puts a block-level trigger
          div in between, and hiding only the button would leave that div (and
          the mode group's 2px gap) behind. Disabled for panels that host legacy
          imperative views — see `canDetach` above. */}
      <span className={css['ModeControl']} data-panel-chrome="secondary">
        <Tooltip content={canDetach ? floatLabel : legacyReason} showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.Cards}
            isDisabled={!canDetach}
            size={IconSize.Large}
            testId="side-panel-float-toggle"
            onClick={layout.toggleFloating}
          />
        </Tooltip>
      </span>
      <span className={css['ModeControl']} data-panel-chrome="secondary">
        <Tooltip content={canDetach ? fullLabel : legacyReason} showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.ViewportDiagonalArrow}
            isDisabled={!canDetach}
            size={IconSize.Large}
            testId="side-panel-full-toggle"
            onClick={layout.toggleFull}
          />
        </Tooltip>
      </span>
      <span className={css['ModeOverflow']}>
        <Tooltip content="Float, full and panel options" showAfterMs={300}>
          <IconButton
            ref={overflowButtonRef}
            variant={IconButtonVariant.Transparent}
            icon={IconName.DotsThreeHorizontal}
            size={IconSize.Large}
            testId="side-panel-mode-overflow"
            onClick={showModeOverflowMenu}
          />
        </Tooltip>
      </span>
      {/* POL-003 sized this row from the wrapper, because `size` changed no
          pixels then. POL-013 gave `Icon.module.scss` its `is-size-*` rules, so
          the size is now the prop above (Large = 20px, the box POL-003 had
          hardcoded) and the local override in `SidePanel.model.scss` is gone.
          The wrapper stays for its other job: `display: flex; align-items:
          center`, which is what centres this control against float and full —
          `Tooltip` renders a block-level trigger div in between, and only two of
          the four controls had a flex wrapper. */}
      <span className={css['HideControl']}>
        <Tooltip content="Hide panel" fineType="⌘B" showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.ArrowLineLeft}
            size={IconSize.Large}
            testId="side-panel-hide-toggle"
            onClick={layout.toggleHidden}
          />
        </Tooltip>
      </span>
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
        <>
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
                {/* PNL-009 / F28: the provider is per panel, not around all of
                    them. One provider around the whole list gave *every* mounted
                    panel — a dozen of them, all behind `display: none` — its own
                    copy of the mode buttons, so `side-panel-float-toggle` and
                    friends were a dozen non-unique ids and anything scripted had
                    to filter on a non-zero bounding box. Inactive panels now get
                    a null slot, which `PanelHeader` renders as no mode group at
                    all. Cheap, and it makes the ids mean what they say. */}
                <PanelModeSlotProvider slot={id === activeId ? modeSlot : null}>
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
                </PanelModeSlotProvider>
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
        </>
      }
    />
  );
}
