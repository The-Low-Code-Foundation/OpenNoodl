/**
 * LIB-005: opening the import flow.
 *
 * The imperative seam. All five entry points — import from project, import from
 * URL, module install, prefab install, export — call one of the two helpers
 * here, so the modal plumbing, the viewer-watch suspension and the post-import
 * events are written once instead of five times (they were, and they had
 * drifted: one path emitted `importComplete` before `viewer-refresh`, another
 * after, and the URL path silently ignored the user's collision choices).
 *
 * Hosting: `PopupLayer.showModal` with a React root, the same mechanism the old
 * popup used. A side panel was considered and rejected — every entry point is
 * already a modal interruption, the flow is transactional (you finish it or you
 * abandon it), and re-homing it in the NodePicker would mean redesigning the
 * NodePicker, which the spec calls out as the scope-balloon risk.
 *
 * @module noodl-editor/views/ImportFlow/openImportFlow
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ProjectModel } from '@noodl-models/projectmodel';

import { apply as applyPlan } from '@noodl-utils/import-engine';
import type { ImportOrigin, ImportPlan, ImportResult } from '@noodl-utils/import-engine';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ViewerConnection } from '../../ViewerConnection';
import PopupLayer from '../popuplayer';
import { ImportFlow, ImportFlowProps } from './ImportFlow';
import { createTargetProject, emptyTargetProject, TargetSnapshot } from './model/targetProject';

/** Raised when the user closes the flow without applying. */
export class ImportFlowCancelled extends Error {
  constructor() {
    super('Cancelled import');
    this.name = 'ImportFlowCancelled';
  }
}

type FlowProps = Omit<ImportFlowProps, 'onDone' | 'onCancel'>;

/**
 * Mount the flow in a modal and resolve with its `ImportResult`. Rejects with
 * {@link ImportFlowCancelled} if the user backs out — callers that treat cancel
 * as ordinary should catch it rather than surfacing an error.
 */
function showFlow(props: FlowProps, hooks: { onOpen?: () => void; onClose?: () => void } = {}): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('div');
    const root: Root = createRoot(el);
    let settled = false;

    const teardown = () => {
      PopupLayer.instance.hideModal(modal);
      hooks.onClose?.();
      // Unmount on the next tick: React forbids unmounting from inside a render
      // or an event handler that is still on the stack.
      setTimeout(() => root.unmount(), 0);
    };

    const done = (result: ImportResult) => {
      if (settled) return;
      settled = true;
      teardown();
      resolve(result);
    };

    const cancel = () => {
      if (settled) return;
      settled = true;
      teardown();
      reject(new ImportFlowCancelled());
    };

    root.render(React.createElement(ImportFlow, { ...props, onDone: done, onCancel: cancel }));

    hooks.onOpen?.();
    const modal = PopupLayer.instance.showModal({
      content: { el },
      onClose: () => {
        // Dismissed by clicking outside / Escape rather than by a button.
        if (settled) return;
        settled = true;
        hooks.onClose?.();
        setTimeout(() => root.unmount(), 0);
        reject(new ImportFlowCancelled());
      }
    });
  });
}

/** Apply a plan to a live project with the sequencing every call site needs. */
export async function applyToProject(plan: ImportPlan, target: ProjectModel): Promise<ImportResult> {
  ViewerConnection.instance.setWatchModelChangesEnabled(false);
  try {
    return await applyPlan(plan, target);
  } finally {
    ViewerConnection.instance.setWatchModelChangesEnabled(true);
    EventDispatcher.instance.emit('ProjectModel.importComplete');
    EventDispatcher.instance.emit('viewer-refresh');
  }
}

export interface OpenImportFlowOptions {
  title: string;
  subtitle?: string;
  sourceDir: string;
  /**
   * ✅ **CN-017: required.** Where `sourceDir` came from. Threaded onto every
   * plan the flow builds and read by `apply()`'s module copy loop — an entry
   * point that has not decided what it is will not compile.
   */
  origin: ImportOrigin;
  /** Defaults to the open project. */
  targetProject?: ProjectModel;
  initialSelection?: ImportFlowProps['initialSelection'];
  keepExistingNonComponents?: boolean;
  /** Legacy hooks a couple of call sites use to hide their own chrome. */
  onBeforePopup?: () => void;
  onAfterPopup?: () => void;
}

export async function openImportFlow(options: OpenImportFlowOptions): Promise<ImportResult> {
  const target = options.targetProject ?? ProjectModel.instance;
  if (!target) throw new Error('No project loaded, cannot import.');

  const snapshot: TargetSnapshot = await createTargetProject(target);

  return showFlow(
    {
      mode: 'import',
      title: options.title,
      subtitle: options.subtitle,
      sourceDir: options.sourceDir,
      origin: options.origin,
      targetName: target.name || 'your project',
      target: snapshot,
      initialSelection: options.initialSelection,
      keepExistingNonComponents: options.keepExistingNonComponents,
      onApply: (plan) => applyToProject(plan, target)
    },
    { onOpen: options.onBeforePopup, onClose: options.onAfterPopup }
  );
}

export interface OpenExportFlowOptions {
  title: string;
  subtitle?: string;
  /** The project being exported FROM — its directory is the source. */
  sourceDir: string;
  /**
   * Performs the export once the user commits: the flow hands over the plan and
   * expects an `ImportResult` back. Export stages into a throwaway project and
   * zips it, which is the caller's business, not the flow's.
   */
  onExport: (plan: ImportPlan) => Promise<ImportResult>;
}

/**
 * Export reuses the selection surface exactly — dependency closure matters
 * identically when you are packing something up. The target is empty, so
 * nothing collides and the review stage has no decisions to offer, only the
 * "here is what you are taking" summary.
 */
export function openExportFlow(options: OpenExportFlowOptions): Promise<ImportResult> {
  return showFlow({
    mode: 'export',
    title: options.title,
    subtitle: options.subtitle,
    sourceDir: options.sourceDir,
    // An export reads the OPEN project and writes a staging copy that becomes a
    // zip. No download to consent to — and nothing to record, because the record
    // would ship inside somebody else's archive. See `ImportOrigin`.
    origin: { kind: 'export-staging' },
    targetName: 'the export',
    target: emptyTargetProject(),
    onApply: options.onExport
  });
}
