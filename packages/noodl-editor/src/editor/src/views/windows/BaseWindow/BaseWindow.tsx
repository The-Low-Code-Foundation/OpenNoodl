import React, { useCallback, useState } from 'react';
import { platform } from '@noodl/platform';

import { App } from '@noodl-models/app';
import { ProjectModel } from '@noodl-models/projectmodel';

import { TitleBar, TitleBarVariant, TitleBarState } from '@noodl-core-ui/components/app/TitleBar';
import { VStack } from '@noodl-core-ui/components/layout/Stack';

import { UpdateManager } from '../../UpdateManager';

export enum BaseWindowVariant {
  Default = 'default',
  Shallow = 'shallow'
}

export interface BaseWindowProps {
  title?: string;
  variant?: BaseWindowVariant;

  children: React.ReactNode;
}

export function BaseWindow({
  title = ProjectModel.instance.name,
  variant = BaseWindowVariant.Default,
  children
}: BaseWindowProps) {
  const [newVersionAvailable, setNewVersionAvailable] = useState<boolean>(undefined);
  const [isDialogRequested, setIsDialogRequested] = useState(false);

  // The title bar's update affordance now opens the real dialog — release
  // notes, a version to choose, and progress — instead of a confirm box that
  // could only appear *after* a silent download had already finished.
  const onNewVersionAvailableClicked = useCallback(() => setIsDialogRequested(true), []);
  const onDialogRequestHandled = useCallback(() => setIsDialogRequested(false), []);

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      <UpdateManager
        isDialogRequested={isDialogRequested}
        onDialogRequestHandled={onDialogRequestHandled}
        onAvailabilityChange={setNewVersionAvailable}
      />

      <VStack UNSAFE_style={{ height: '100%' }}>
        <TitleBar
          title={title}
          variant={variant === BaseWindowVariant.Shallow ? TitleBarVariant.Shallow : TitleBarVariant.Default}
          version={platform.getVersionWithTag()}
          state={newVersionAvailable ? TitleBarState.UpdateAvailable : TitleBarState.Default}
          isWindows={['win32', 'linux'].includes(process.platform)}
          onMinimizeClicked={() => App.instance.minimize()}
          onMaximizeClicked={() => App.instance.maximize()}
          onCloseClicked={() => App.instance.close()}
          onNewVersionAvailableClicked={onNewVersionAvailableClicked}
        />

        {children}
      </VStack>
    </div>
  );
}
