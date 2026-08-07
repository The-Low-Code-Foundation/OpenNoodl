import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { getComponentIconType } from '@noodl-models/nodelibrary/ComponentIcon';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { getDefaultComponent } from '@noodl-models/projectmodel.utils';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { ViewerConnection } from '../../ViewerConnection';
import { buildCreateMenuItems, createMenuTitle, DEFAULT_SHEET_NAME } from '../panels/ComponentsPanelNew/createMenu';
import { useComponentActions } from '../panels/ComponentsPanelNew/hooks/useComponentActions';
import { CLOUD_SHEET } from '../panels/ComponentsPanelNew/types';
import { showContextMenuInPopup } from '../ShowContextMenuInPopup';
import css from './NodeGraphComponentTrail.module.scss';

export interface ComponentTrailItem {
  id?: string;
  name: string;
  fullName: string;
  component?: TSFixme; // Noodl Component object or undefined if folder
  isCurrent: boolean;
  stateText: 'Read only' | null;
}

export interface NodeGraphComponentTrailProps {
  componentTrail: ComponentTrailItem[];

  canNavigateBack: boolean;
  canNavigateForward: boolean;

  onSwitchToComponent: (component: TSFixme, args?: any) => void;
  onHistoryForward: () => void;
  onHistoryBack: () => void;

  /** PAR-003: runtime of the hosting graph — scopes the "+" new-component templates. */
  runtimeType?: RuntimeType;
  /** PAR-003: hides the "+" new-component affordance on read-only canvases. */
  readOnly?: boolean;

  /**
   * WFA-006: anything the hosting canvas wants to say about the world outside
   * this graph — today, a cloud function's callers and its deploy button.
   *
   * A slot rather than a set of props on purpose: this bar is the shared
   * navigation surface for every canvas in the editor, and the one thing it must
   * not learn is what a workflow is. Nothing is rendered when it is absent, so an
   * ordinary component's trail takes the same code path it takes today.
   */
  statusSlot?: React.ReactNode;
}

/**
 * PAR-003: the mock's bottom bar — component navigation as pill tabs, a "+"
 * bound to the existing new-component flow (same templates/popup as the
 * components panel), and an honest "Preview live" status bound to viewer
 * client presence. Navigation behavior is unchanged from the old trail.
 */
export function NodeGraphComponentTrail({
  componentTrail,

  canNavigateBack,
  canNavigateForward,

  onSwitchToComponent,
  onHistoryBack,
  onHistoryForward,

  runtimeType,
  readOnly,
  statusSlot
}: NodeGraphComponentTrailProps) {
  const trailRef = useRef<HTMLDivElement>(null);

  /**
   * SPR-005 — which sheet this bar's "+" creates into.
   *
   * It used to call `useComponentActions()` with no options, so `sheetPrefix`
   * was `''` and every component it created was named `/<name>`. On a cloud
   * function's canvas the menu offers **Cloud Function Component**, so that
   * produced a component with `noodl.cloud.request`/`response` roots sitting
   * *outside* `#__cloud__` — which `isCloudFunctionComponent` does not match, so
   * no backend would ever be sent it and no `call-function` step could resolve
   * it. It looked like a cloud function in the tree and was not one. The prefix
   * is the same string `ComponentsPanel` computes from the selected sheet.
   */
  const isCloudCanvas = runtimeType === RuntimeType.Cloud;
  const { handleAddComponent } = useComponentActions({
    sheetPrefix: isCloudCanvas ? '/' + CLOUD_SHEET.folderName : ''
  });

  /**
   * A workflow is not a component and is not stored in the project, so no
   * component template declares `runtimeTypes: ['workflow']` — the "+" opened an
   * empty menu on a workflow canvas. It is not rendered there now. That removes
   * a control that did nothing; what a workflow canvas *should* offer instead is
   * phase 43's (canvas identity and first-run), not this task's.
   */
  const canCreateComponents = runtimeType !== RuntimeType.Workflow;

  // Change the scroll direction to horizontal.
  function onScroll(event: React.WheelEvent<HTMLDivElement>) {
    if (trailRef.current) {
      event.preventDefault();
      trailRef.current.scrollLeft += event.deltaY + event.deltaX;
    }
  }

  // Same create menu as the components panel's empty-space context menu —
  // the existing new-component action, reachable from the bar. SPR-005 made
  // that literally the same builder rather than a second copy of it, so the
  // bar and the panel cannot offer different things or land them differently.
  const createContext = {
    // The bar creates at the root of the sheet the canvas belongs to, which is
    // a folder context — the same one the panel's empty space declares.
    forParentType: 'folder' as const,
    runtimeType: (isCloudCanvas ? 'cloud' : 'browser') as 'browser' | 'cloud',
    sheetName: isCloudCanvas ? CLOUD_SHEET.displayName : DEFAULT_SHEET_NAME
  };

  function onNewComponentClick() {
    showContextMenuInPopup({
      title: createMenuTitle(createContext),
      // No `onAddFolder`: this bar has no folder tree to put one in.
      items: buildCreateMenuItems(createContext, { onAddComponent: handleAddComponent }),
      width: MenuDialogWidth.Default
    });
  }

  return (
    <div className={css['Root']}>
      <div className={css['HistoryControls']}>
        <IconButton
          icon={IconName.CaretLeft}
          onClick={onHistoryBack}
          variant={IconButtonVariant.OpaqueOnHover}
          isDisabled={!canNavigateBack}
          UNSAFE_className={css['HistoryButton']}
        />
        <IconButton
          icon={IconName.CaretRight}
          onClick={onHistoryForward}
          variant={IconButtonVariant.OpaqueOnHover}
          isDisabled={!canNavigateForward}
          UNSAFE_className={css['HistoryButton']}
        />
      </div>

      <div className={css['TrailContainer']}>
        <div ref={trailRef} className={css['Trail']} onWheel={onScroll}>
          {componentTrail.map((item) => {
            if (item.component)
              return <Item key={item.fullName} item={item} onSwitchToComponent={onSwitchToComponent} />;

            return (
              <Tooltip
                UNSAFE_triggerClassName={css['ItemTrigger']}
                content={'Has no graph'}
                key={item.fullName}
                isNotHiddenOnClick
              >
                <Item item={item} onSwitchToComponent={onSwitchToComponent} />
              </Tooltip>
            );
          })}
        </div>
      </div>

      {!readOnly && canCreateComponents && (
        /* SPR-005: the tooltip names the destination, so a "+" on a cloud
           function's canvas says it creates into Cloud Functions before it is
           clicked. */
        <Tooltip content={createMenuTitle(createContext)}>
          <button
            className={css['NewComponentButton']}
            aria-label={createMenuTitle(createContext)}
            title={createMenuTitle(createContext)}
            data-test="trail-new-component"
            onClick={onNewComponentClick}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
        </Tooltip>
      )}

      <div className={css['Spacer']} />

      {statusSlot}

      <PreviewLiveStatus />
    </div>
  );
}

/**
 * "Preview live" (mock `.status`): shown only while at least one viewer client
 * is connected — bound to ViewerConnection client presence, updated on its
 * `viewerClientsChanged` notifications. Nothing is rendered otherwise.
 */
function PreviewLiveStatus() {
  const [isLive, setIsLive] = useState(() => Boolean(ViewerConnection.instance?.hasConnectedViewer));

  useEffect(() => {
    const connection = ViewerConnection.instance;
    if (!connection) return;

    const group = {};
    connection.on(
      'viewerClientsChanged',
      () => {
        setIsLive(connection.hasConnectedViewer);
      },
      group
    );

    return () => {
      connection.off(group);
    };
  }, []);

  if (!isLive) return null;

  return (
    <span className={css['Status']} data-test="preview-live-status">
      <i aria-hidden="true" />
      Preview live
    </span>
  );
}

interface ItemProps {
  item: ComponentTrailItem;
  onSwitchToComponent: NodeGraphComponentTrailProps['onSwitchToComponent'];
}

function Item({ item, onSwitchToComponent }: ItemProps) {
  let icon = getIconFromItem(item);
  const itemRef = useRef<HTMLDivElement>(null);

  // change a visual component icon to be a regular component icon in the trail
  // @ts-expect-error fix this when we refactor the component sidebar to not use the old HTML templates
  if (icon === 2) {
    icon = IconName.Component;
  }

  useEffect(() => {
    if (!itemRef.current || !item.isCurrent) return;

    itemRef.current.scrollIntoView();
  }, [itemRef.current, item.isCurrent]);

  const name = item.name;
  let isSheet = false;

  if (!item.component) {
    if (name.substring(1, -1) === '#') {
      isSheet = true;
    }
  }

  if (name === '#__cloud__') return null;

  const rootComponent = getDefaultComponent();
  let isRootComponent = false;

  if (rootComponent.id) {
    isRootComponent = rootComponent.id === item.id;
  } else {
    isRootComponent = rootComponent.name === item.fullName;
  }

  return (
    <div
      ref={itemRef}
      className={classNames(
        css['Item'],
        item.component ? css['is-component'] : css['is-folder'],
        item.isCurrent && css['is-current']
      )}
      aria-current={item.isCurrent ? 'page' : undefined}
      onClick={() => {
        if (!item.component || item.isCurrent) return;
        onSwitchToComponent(item.component, { pushHistory: true });
      }}
    >
      {/* Mock: only the current tab carries the component glyph. */}
      {icon && !isSheet && item.isCurrent && (
        <Icon icon={isRootComponent ? IconName.Home : icon} size={IconSize.Tiny} UNSAFE_className={css['Icon']} />
      )}
      <span className={css['Label']}>{name}</span>
      {item.component && Boolean(item.stateText) && <span className={css['StateText']}>({item.stateText})</span>}
    </div>
  );
}

function getIconFromItem(item: TSFixme): IconName {
  if (!item.component) return IconName.FolderClosed;

  const iconType = getComponentIconType(item.component);
  if (iconType) {
    // TODO: Typescript, ugly typings, is there a better way?
    return iconType as unknown as IconName;
  }

  return IconName.Component;
}
