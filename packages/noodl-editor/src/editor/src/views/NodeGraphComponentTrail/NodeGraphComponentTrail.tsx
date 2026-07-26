import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { getComponentIconType } from '@noodl-models/nodelibrary/ComponentIcon';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';
import { getDefaultComponent } from '@noodl-models/projectmodel.utils';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { ViewerConnection } from '../../ViewerConnection';
import { ComponentTemplates } from '../panels/ComponentsPanelNew/ComponentTemplates';
import { useComponentActions } from '../panels/ComponentsPanelNew/hooks/useComponentActions';
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
  readOnly
}: NodeGraphComponentTrailProps) {
  const trailRef = useRef<HTMLDivElement>(null);
  const { handleAddComponent } = useComponentActions();

  // Change the scroll direction to horizontal.
  function onScroll(event: React.WheelEvent<HTMLDivElement>) {
    if (trailRef.current) {
      event.preventDefault();
      trailRef.current.scrollLeft += event.deltaY + event.deltaX;
    }
  }

  // Same create menu as the components panel's empty-space context menu —
  // the existing new-component action, reachable from the bar.
  function onNewComponentClick() {
    const templates = ComponentTemplates.instance.getTemplates({
      forRuntimeType: runtimeType || RuntimeType.Browser
    });

    showContextMenuInPopup({
      items: [
        ...templates.map((template) => ({
          icon: template.icon,
          label: `Create ${template.label}`,
          onClick: () => handleAddComponent(template)
        }))
      ],
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

      {!readOnly && (
        <Tooltip content="New component">
          <button className={css['NewComponentButton']} aria-label="New component" onClick={onNewComponentClick}>
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
        <Icon icon={isRootComponent ? IconName.Home : icon} UNSAFE_className={css['Icon']} />
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
