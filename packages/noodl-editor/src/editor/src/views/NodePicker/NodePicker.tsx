import classNames from 'classnames';
import React, { CSSProperties } from 'react';

import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';

import { Kbd, NodePickerFooter } from './components/NodePickerFooter';
import { NodePickerSize } from './NodePicker.constants';
import { NodePickerContextProvider, useNodePickerContext } from './NodePicker.context';
import css from './NodePicker.module.scss';
import { ImportFromProject } from './tabs/ImportFromProject/ImportFromProject';
import { NodeLibrary, NodeLibraryProps } from './tabs/NodeLibrary/NodeLibrary';
import { NodePickerSearchView } from './tabs/NodePickerSearchView';

type NodePickerProps = NodeLibraryProps;

const NODE_LIBRARY_LABEL = 'Nodes';
const PREFAB_LIBRARY_LABEL = 'Prefabs';
const MODULE_LIBRARY_LABEL = 'Modules';
const PROJECT_IMPORT_LABEL = 'Import from project';

/**
 * The picker shell (UIX-013).
 *
 * Owns the chrome every tab shares — the segmented tab row, the "esc to close"
 * affordance and the footer hint bar — and nothing else. Panel geometry comes
 * from the context (one derivation, see `NodePicker.constants.ts`), which is
 * how the size stopped being stated once in JavaScript and again in SCSS.
 */
function NodePickerWithoutContext({ model, parentModel, pos, attachToRoot, runtimeType }: NodePickerProps) {
  const context = useNodePickerContext();

  const tabs = [
    {
      label: NODE_LIBRARY_LABEL,
      content: (
        <NodeLibrary
          model={model}
          parentModel={parentModel}
          pos={pos}
          attachToRoot={attachToRoot}
          runtimeType={runtimeType}
        />
      )
    },
    {
      label: PREFAB_LIBRARY_LABEL,
      content: <NodePickerSearchView key="prefabs" itemType="prefab" searchInputPlaceholder="Search for a prefab" />
    },
    {
      label: MODULE_LIBRARY_LABEL,
      content: (
        <NodePickerSearchView key="modules" itemType="module" searchInputPlaceholder="Search for an external library" />
      )
    },
    {
      label: PROJECT_IMPORT_LABEL,
      content: <ImportFromProject />
    }
  ];

  return (
    <div
      className={css['Root']}
      style={{ width: context.size.width, height: context.size.height } as CSSProperties}
    >
      <Tabs
        UNSAFE_className={css['Tabs']}
        UNSAFE_style={{ '--tabs-row-padding': '12px 16px 0' } as CSSProperties}
        variant={TabsVariant.Segmented}
        tabs={tabs}
        activeTab={context.activeTab}
        onChange={(activeTab) => context.setActiveTab(activeTab)}
        slotEnd={
          <span className={css['EscHint']}>
            <Kbd>esc</Kbd> to close
          </span>
        }
      />

      <NodePickerFooter hints={context.footer.hints} status={context.footer.status} />

      <div className={classNames(css['Blocker'], context.isBlocked && css['is-visible'])} />
    </div>
  );
}

export function NodePicker({ size, ...props }: NodePickerProps & { size?: NodePickerSize }) {
  return (
    <NodePickerContextProvider size={size}>
      <NodePickerWithoutContext {...(props as NodePickerProps)} />
    </NodePickerContextProvider>
  );
}
