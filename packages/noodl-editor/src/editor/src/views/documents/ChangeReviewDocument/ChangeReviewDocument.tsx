/**
 * AIX-003 — Graph-Native Review: the review document
 *
 * A staged AI proposal shown the way the product's thesis says change should
 * be shown: on the canvas. The left side is a read-only diff canvas rendering
 * the annotated review component (added, removed, modified, rewired — in
 * place), with Before / Changes / After views of the same graph; the right
 * rail is the change list, grouped and phrased as sentences, with
 * parameter-level detail for modifications. Clicking an entry centres and
 * selects its node on the canvas.
 *
 * Review is granular: each anchored change can be excluded, and exclusion is
 * closed over the change set's dependency edges in both directions —
 * excluding a node excludes the wiring that needs it; restoring a connection
 * restores the nodes it plugs into. Accepting materializes exactly the kept
 * subset (`materializeSelection`) and hands the files to the Build panel,
 * which validates them through the same gate as authoring before staging.
 *
 * The document owns no decision logic: accept and reject are callbacks from
 * the panel, which owns the session. Closing the review changes nothing.
 *
 * @module noodl-editor/views/documents/ChangeReviewDocument
 */

import React, { useEffect, useMemo, useState } from 'react';

import {
  buildReviewComponent,
  materializeSelection,
  requiredWith,
  excludedWith,
  type AuthoringChangeSet,
  type ComponentFiles
} from '@noodl-models/AiAssistant/authoring';
import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';
import { ComponentModel } from '@noodl-models/componentmodel';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { toLegacyComponent, type GraphChange, type ParamDelta } from '@noodl-versioning';
import { Frame } from '../../common/Frame';
import { NodeGraphEditor } from '../../nodegrapheditor';
import {
  ChangeGroup,
  countCosmetic,
  createDisplayNameProvider,
  describeSide,
  presentChanges,
  TONE_FEEDBACK,
  TONE_ICON
} from '../../panels/GraphDiffPanel/graphChangePresentation';
import { EditorDocumentProvider } from '../EditorDocument';
import css from './ChangeReviewDocument.module.scss';

export interface ChangeReviewDocumentProps {
  changeSet: AuthoringChangeSet;
  /** The staged proposal the change set was built from. */
  files: ComponentFiles;
  title: string;
  /** Stage the given (possibly partial) files; returns an error message or null. */
  onAcceptFiles: (files: ComponentFiles) => string | null;
  onReject: () => void;
}

type ViewMode = 'before' | 'review' | 'after';

/** Above this many changes, groups start collapsed and the walkthrough matters. */
const LARGE_CHANGE_SET = 20;

/** The node an entry centres on canvas — undefined for component-level rows. */
function anchorNodeId(change: GraphChange): string | undefined {
  switch (change.kind) {
    case 'node-recreated':
      return change.recreatedAs.id;
    case 'connection-added':
    case 'connection-removed':
      return change.connection.toId;
    case 'connection-rewired':
      return change.after.toId;
    case 'comment-added':
    case 'comment-removed':
    case 'comment-changed':
    case 'comment-moved':
    case 'component-renamed':
    case 'component-metadata-changed':
      return undefined;
    default:
      return change.node.id;
  }
}

/**
 * Parameter-level detail for rows that carry per-key deltas.
 * `component-metadata-changed` is excluded — its sentence already states the
 * delta, so a detail line would say the same thing twice.
 */
function paramDetail(change: GraphChange): ParamDelta[] {
  switch (change.kind) {
    case 'node-parameters-changed':
    case 'node-state-changed':
    case 'node-recreated':
      return change.params;
    default:
      return [];
  }
}

/** Component-level rows are the proposal's identity and cannot be excluded. */
function isExcludable(change: GraphChange): boolean {
  return change.kind !== 'component-renamed' && change.kind !== 'component-metadata-changed';
}

function summarize(changes: GraphChange[]): string {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const change of changes) {
    if (change.category === 'cosmetic') continue;
    switch (change.kind) {
      case 'node-added':
      case 'connection-added':
      case 'comment-added':
        added += 1;
        break;
      case 'node-removed':
      case 'connection-removed':
      case 'comment-removed':
        removed += 1;
        break;
      default:
        changed += 1;
    }
  }
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} addition${added === 1 ? '' : 's'}`);
  if (removed > 0) parts.push(`${removed} removal${removed === 1 ? '' : 's'}`);
  if (changed > 0) parts.push(`${changed} change${changed === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

function componentFromLegacy(legacy: Record<string, unknown>): ComponentModel {
  return ComponentModel.fromJSON(legacy as TSFixme);
}

function ChangeReviewDocument({ changeSet, files, title, onAcceptFiles, onReject }: ChangeReviewDocumentProps) {
  const [nodeGraph] = useState<NodeGraphEditor>(() => {
    const ng = new NodeGraphEditor({});
    ng.setReadOnly(true);
    ng.render();
    return ng;
  });

  const [viewMode, setViewMode] = useState<ViewMode>('review');
  const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set());
  const [applyError, setApplyError] = useState<string | null>(null);
  // Large sets start folded to their group summaries; the reader drills in.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() =>
    changeSet.changes.length > LARGE_CHANGE_SET ? new Set(Object.values(ChangeGroup)) : new Set()
  );
  /** Walkthrough position: index into the anchored changes, or -1 before start. */
  const [walkIndex, setWalkIndex] = useState(-1);

  const reviewComponent = useMemo(() => componentFromLegacy(buildReviewComponent(changeSet)), [changeSet]);
  const beforeComponent = useMemo(() => {
    const legacy = toLegacyComponent(changeSet.base);
    legacy.name = `${changeSet.componentName} (before)`;
    return componentFromLegacy(legacy);
  }, [changeSet]);
  const afterComponent = useMemo(() => {
    const legacy = toLegacyComponent(changeSet.target);
    legacy.name = `${changeSet.componentName} (proposed)`;
    return componentFromLegacy(legacy);
  }, [changeSet]);

  const activeComponent =
    viewMode === 'before' ? beforeComponent : viewMode === 'after' ? afterComponent : reviewComponent;

  useEffect(() => () => nodeGraph.dispose(), []);
  useEffect(() => {
    nodeGraph.switchToComponent(activeComponent);
  }, [activeComponent]);

  const groups = useMemo(
    () =>
      presentChanges(
        changeSet.changes.map((entry) => entry.change),
        createDisplayNameProvider()
      ),
    [changeSet]
  );
  const changeIdByObject = useMemo(
    () => new Map<GraphChange, string>(changeSet.changes.map((entry) => [entry.change, entry.id])),
    [changeSet]
  );
  const rawChanges = useMemo(() => changeSet.changes.map((entry) => entry.change), [changeSet]);
  const cosmetic = countCosmetic(rawChanges);
  const excludableCount = rawChanges.filter(isExcludable).length;
  const keptCount = excludableCount - [...rejected].length;

  const exit = () => AppRegistry.instance.openDocument(EditorDocumentProvider.ID);

  const focus = (change: GraphChange) => {
    const id = anchorNodeId(change);
    if (!id) return;
    if (viewMode !== 'review') setViewMode('review');
    nodeGraph.switchToComponent(reviewComponent, { node: { id } as never });
  };

  // The walkthrough steps through every change that has a canvas anchor, in
  // list order — the guided way through a set too large to eyeball.
  const anchored = useMemo(
    () => groups.flatMap((group) => group.changes).filter((presented) => anchorNodeId(presented.change) !== undefined),
    [groups]
  );

  const step = (direction: 1 | -1) => {
    if (anchored.length === 0) return;
    const next = Math.min(Math.max(walkIndex + direction, 0), anchored.length - 1);
    setWalkIndex(next);
    focus(anchored[next].change);
  };

  const toggleGroup = (group: string) => {
    const next = new Set(collapsed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setCollapsed(next);
  };

  const exclude = (changeId: string) => {
    setApplyError(null);
    setRejected(excludedWith(changeSet, [...rejected, changeId]));
  };

  const restore = (changeId: string) => {
    setApplyError(null);
    // Restoring a change restores everything it requires.
    const needed = requiredWith(changeSet, [changeId]);
    setRejected(new Set([...rejected].filter((id) => !needed.has(id))));
  };

  const acceptSelected = () => {
    const { files: selectedFiles } = materializeSelection(changeSet, files, rejected);
    const error = onAcceptFiles(selectedFiles);
    if (error) setApplyError(error);
    else exit();
  };

  const viewButton = (mode: ViewMode, label: string) => (
    <PrimaryButton
      label={label}
      variant={viewMode === mode ? PrimaryButtonVariant.Muted : PrimaryButtonVariant.MutedOnLowBg}
      onClick={() => setViewMode(mode)}
    />
  );

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>{title}</Label>
        <div style={{ display: 'flex', gap: 2, marginLeft: 16 }}>
          {viewButton('before', 'Before')}
          {viewButton('review', 'Changes')}
          {viewButton('after', 'After')}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <PrimaryButton
            label={rejected.size > 0 ? `Accept ${keptCount} of ${excludableCount}` : 'Accept all'}
            onClick={acceptSelected}
          />
          <PrimaryButton
            label="Reject"
            variant={PrimaryButtonVariant.Danger}
            onClick={() => {
              onReject();
              exit();
            }}
          />
          <PrimaryButton label="Close" variant={PrimaryButtonVariant.MutedOnLowBg} onClick={exit} />
        </div>
      </div>

      <div className={css.Body}>
        <div className={css.Canvas}>
          <Frame instance={nodeGraph} onResize={(bounds) => nodeGraph.resize(bounds)} />
        </div>

        <div className={css.Rail}>
          <div className={css.Summary}>
            <Text textType={TextType.Secondary}>
              {summarize(rawChanges)}
              {cosmetic > 0 ? ` · ${cosmetic} layout-only` : ''}
            </Text>
            <Text textType={TextType.Shy}>
              Click a change to see it on the canvas. Exclude what you don’t want — the rest is accepted.
            </Text>
            {anchored.length > 1 && (
              <div className={css.Walkthrough}>
                <PrimaryButton
                  label="Previous"
                  variant={PrimaryButtonVariant.MutedOnLowBg}
                  isDisabled={walkIndex <= 0}
                  onClick={() => step(-1)}
                />
                <PrimaryButton
                  label={walkIndex < 0 ? 'Walk through' : 'Next'}
                  variant={PrimaryButtonVariant.MutedOnLowBg}
                  isDisabled={walkIndex >= anchored.length - 1}
                  onClick={() => step(1)}
                />
                <Text textType={TextType.Shy}>
                  {walkIndex < 0 ? `${anchored.length} on canvas` : `${walkIndex + 1} of ${anchored.length}`}
                </Text>
              </div>
            )}
            {applyError && (
              <div className={css.ApplyError}>
                <Icon icon={IconName.WarningCircleFilled} variant={FeedbackType.Danger} size={IconSize.Small} />
                <Text textType={TextType.Secondary}>{applyError}</Text>
              </div>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {groups.map((group) => (
              <div key={group.group}>
                <button type="button" className={css.GroupHeader} onClick={() => toggleGroup(String(group.group))}>
                  <Icon
                    icon={collapsed.has(String(group.group)) ? IconName.CaretRight : IconName.CaretDown}
                    size={IconSize.Tiny}
                  />
                  <Label>{group.group}</Label>
                  <Text textType={TextType.Shy}>{`${group.changes.length}`}</Text>
                </button>
                {!collapsed.has(String(group.group)) &&
                  group.changes.map((presented) => {
                  const changeId = changeIdByObject.get(presented.change);
                  const clickable = anchorNodeId(presented.change) !== undefined;
                  const excludable = isExcludable(presented.change) && changeId !== undefined;
                  const isRejected = changeId !== undefined && rejected.has(changeId);
                  const params = paramDetail(presented.change);
                  return (
                    <div key={presented.key} className={isRejected ? css.RowRejected : undefined}>
                      <div className={css.RowLine}>
                        <button
                          type="button"
                          className={`${css.Row} ${clickable ? css.RowClickable : ''}`}
                          disabled={!clickable}
                          onClick={() => focus(presented.change)}
                        >
                          <span className={css.RowIcon}>
                            <Icon
                              icon={TONE_ICON[presented.tone]}
                              variant={TONE_FEEDBACK[presented.tone]}
                              size={IconSize.Small}
                            />
                          </span>
                          <span className={css.RowText}>
                            <Text textType={TextType.Default}>{presented.text}</Text>
                          </span>
                        </button>
                        {excludable && (
                          <button
                            type="button"
                            className={css.ExcludeButton}
                            title={isRejected ? 'Include this change again' : 'Exclude this change'}
                            aria-label={isRejected ? 'Include this change again' : 'Exclude this change'}
                            onClick={() => (isRejected ? restore(changeId) : exclude(changeId))}
                          >
                            <Icon icon={isRejected ? IconName.Reset : IconName.Close} size={IconSize.Tiny} />
                          </button>
                        )}
                      </div>
                      {params.length > 0 && (
                        <div className={css.Params}>
                          {params.map((delta) => (
                            <Text key={delta.name} textType={TextType.Shy}>
                              {delta.name}: {describeSide(delta.base)} → {describeSide(delta.target)}
                            </Text>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export class ChangeReviewDocumentProvider implements IDocumentProvider {
  public static ID = 'ChangeReviewDocumentProvider';

  getComponent() {
    return ChangeReviewDocument;
  }
}
