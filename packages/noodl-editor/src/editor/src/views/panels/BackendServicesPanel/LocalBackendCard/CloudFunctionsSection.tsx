/**
 * WFA-001 — what the backend is actually serving.
 *
 * The push happens on save, which is the best feel and the worst failure mode:
 * a function whose graph you have just broken replaces a working one without
 * anyone saying so. This section is the answer to that — it reads the *backend's*
 * own `GET /admin/workflows` (proxied by `backend:workflow-status`), not the
 * editor's idea of what it sent, so a function that failed to deploy is visibly
 * absent rather than assumed present.
 *
 * @module BackendServicesPanel/LocalBackendCard/CloudFunctionsSection
 */

import { ipcInvoke } from '@noodl-utils/ipc';
import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import {
  CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED,
  CloudDeployState,
  CloudFunctionDeployer
} from '../../../../services/CloudFunctionDeployer';
import css from './LocalBackendCard.module.scss';

interface WorkflowStatus {
  initialized: boolean;
  workflowCount: number;
  functions: { name: string; workflow: string }[];
}

export interface CloudFunctionsSectionProps {
  backendId: string;
  isRunning: boolean;
  onDeploy: () => Promise<boolean>;
}

function formatPushedAt(timestamp?: number): string {
  if (!timestamp) return 'not pushed yet';
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'pushed just now';
  if (seconds < 60) return `pushed ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `pushed ${minutes}m ago`;
  return `pushed at ${new Date(timestamp).toLocaleTimeString()}`;
}

export function CloudFunctionsSection({ backendId, isRunning, onDeploy }: CloudFunctionsSectionProps) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [deployState, setDeployState] = useState<CloudDeployState>(() => CloudFunctionDeployer.getState());
  const [isDeploying, setIsDeploying] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!isRunning) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await ipcInvoke<WorkflowStatus>('backend:workflow-status', backendId));
    } catch {
      setStatus(null);
    }
  }, [backendId, isRunning]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Re-read the backend after every push, successful or not — that is exactly
  // when what it is serving can have changed.
  useEffect(() => {
    const group = { id: `CloudFunctionsSection.${backendId}` };
    EventDispatcher.instance.on(
      CLOUD_FUNCTIONS_DEPLOY_STATE_CHANGED,
      (state: CloudDeployState) => {
        setDeployState(state);
        if (!state.isPushing) refreshStatus();
      },
      group
    );
    return () => {
      EventDispatcher.instance.off(group);
    };
  }, [backendId, refreshStatus]);

  const handleDeploy = useCallback(async () => {
    setIsDeploying(true);
    try {
      await onDeploy();
    } finally {
      setIsDeploying(false);
    }
  }, [onDeploy]);

  const cloudComponents = deployState.cloudComponents;
  const backendFunctions = (status?.functions || []).map((f) => f.name);
  const error = deployState.lastError[backendId];

  /**
   * DEF-015 — **only endpoints are diffed against the backend.**
   *
   * This list used to be every `/#__cloud__/` component, and the backend's list
   * is only the ones holding a Request node, so every helper in the project sat
   * under a warning triangle saying it was "in the project, not on this backend"
   * — permanently, on a healthy system, immediately after a successful deploy.
   * The site-builder template ships three: two `RunTasks` task templates and one
   * component instance. A signal that is always on is not a signal.
   */
  const endpoints = cloudComponents.filter((c) => c.role === 'endpoint').map((c) => c.name);
  const workers = cloudComponents.filter((c) => c.role === 'worker');
  const unreachable = cloudComponents.filter((c) => c.role === 'unreachable');

  // A project with no cloud functions gets no section at all: the point of the
  // browser-only experience being unchanged.
  if (cloudComponents.length === 0 && backendFunctions.length === 0) {
    return null;
  }

  const missing = endpoints.filter((name) => !backendFunctions.includes(name));
  const stale = backendFunctions.filter((name) => !endpoints.includes(name));

  return (
    <div className={css.CloudFunctions} data-test={`cloud-functions-${backendId}`}>
      <div className={css.CloudFunctionsHeader}>
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          Cloud functions
        </Text>
        <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
          {isRunning ? formatPushedAt(deployState.lastPushedAt[backendId]) : 'backend stopped'}
        </Text>
      </div>

      {isRunning ? (
        <ul className={css.CloudFunctionsList}>
          {backendFunctions.map((name) => (
            <li key={name} data-test={`cloud-function-live-${name}`}>
              <Icon
                icon={IconName.Check}
                size={IconSize.Tiny}
                UNSAFE_style={{ color: 'var(--theme-color-success)' }}
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
                {name}
              </Text>
            </li>
          ))}
          {missing.map((name) => (
            <li key={name} data-test={`cloud-function-missing-${name}`}>
              <Icon
                icon={IconName.WarningTriangle}
                size={IconSize.Tiny}
                UNSAFE_style={{ color: 'var(--theme-color-notice)' }}
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
                {name} — in the project, not on this backend
              </Text>
            </li>
          ))}
          {stale.map((name) => (
            <li key={name} data-test={`cloud-function-stale-${name}`}>
              <Icon
                icon={IconName.WarningTriangle}
                size={IconSize.Tiny}
                UNSAFE_style={{ color: 'var(--theme-color-notice)' }}
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
                {name} — on this backend, not in the project
              </Text>
            </li>
          ))}
          {/*
            Counted rather than silenced. A worker has no endpoint to be absent
            from, so it can never be "missing" — but one that has genuinely been
            deleted from the project is worth noticing, and a number that drops
            is how you notice.
          */}
          {workers.length > 0 && (
            <li data-test={`cloud-workers-${backendId}`}>
              <Icon icon={IconName.Play} size={IconSize.Tiny} UNSAFE_style={{ color: 'var(--theme-color-fg-muted)' }} />
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
                {workers.length} {workers.length === 1 ? 'worker' : 'workers'}, run in-process by these functions
              </Text>
            </li>
          )}
          {/*
            The total classification's third bucket. Nothing can start these —
            no route, and no endpoint reaches them — so this is the one case in
            the section where a warning is the honest answer.
          */}
          {unreachable.map((c) => (
            <li key={c.componentName} data-test={`cloud-component-unreachable-${c.name}`}>
              <Icon
                icon={IconName.WarningTriangle}
                size={IconSize.Tiny}
                UNSAFE_style={{ color: 'var(--theme-color-notice)' }}
              />
              <Text textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
                {c.name} — in the project, but nothing calls it and it has no endpoint
              </Text>
            </li>
          ))}
        </ul>
      ) : (
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          {endpoints.length} in the project. Start the backend to deploy them.
        </Text>
      )}

      {error && (
        <Text textType={TextType.Shy} style={{ fontSize: '11px', color: 'var(--theme-color-danger)' }}>
          Last push failed: {error}
        </Text>
      )}

      {isRunning && (
        <PrimaryButton
          label={isDeploying || deployState.isPushing ? 'Deploying…' : 'Deploy functions'}
          size={PrimaryButtonSize.Small}
          variant={PrimaryButtonVariant.Muted}
          onClick={handleDeploy}
          isDisabled={isDeploying || deployState.isPushing}
          isGrowing
          testId={`deploy-cloud-functions-${backendId}`}
        />
      )}
    </div>
  );
}
