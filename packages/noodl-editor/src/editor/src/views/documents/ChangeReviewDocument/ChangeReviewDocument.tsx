/**
 * AIX-003 — Graph-Native Review: the review document
 *
 * A staged AI proposal shown the way the product's thesis says change should
 * be shown: on the canvas. The left side is a read-only diff canvas rendering
 * the annotated review component (added, removed, modified, rewired — in
 * place); the right rail is the change list, grouped and phrased as
 * sentences, with parameter-level detail for modifications. Clicking an entry
 * centres and selects its node on the canvas.
 *
 * The document owns no decision logic: Accept and Reject are callbacks from
 * the Build panel, which owns the session. Exiting the review changes
 * nothing — the candidate stays staged and the panel keeps offering it.
 *
 * @module noodl-editor/views/documents/ChangeReviewDocument
 */

import React, { useEffect, useMemo, useState } from 'react';

import { buildReviewComponent, type AuthoringChangeSet } from '@noodl-models/AiAssistant/authoring';
import { AppRegistry, IDocumentProvider } from '@noodl-models/app_registry';
import { ComponentModel } from '@noodl-models/componentmodel';

import { Icon, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Label } from '@noodl-core-ui/components/typography/Label';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { GraphChange, ParamDelta } from '@noodl-versioning';
import { Frame } from '../../common/Frame';
import { NodeGraphEditor } from '../../nodegrapheditor';
import {
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
  title: string;
  onAccept: () => void;
  onReject: () => void;
}

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

function ChangeReviewDocument({ changeSet, title, onAccept, onReject }: ChangeReviewDocumentProps) {
  const [nodeGraph] = useState<NodeGraphEditor>(() => {
    const ng = new NodeGraphEditor({});
    ng.setReadOnly(true);
    ng.render();
    return ng;
  });

  const component = useMemo(
    () => ComponentModel.fromJSON(buildReviewComponent(changeSet) as TSFixme),
    [changeSet]
  );

  useEffect(() => () => nodeGraph.dispose(), []);
  useEffect(() => {
    nodeGraph.switchToComponent(component);
  }, [component]);

  const groups = useMemo(
    () =>
      presentChanges(
        changeSet.changes.map((entry) => entry.change),
        createDisplayNameProvider()
      ),
    [changeSet]
  );
  const rawChanges = useMemo(() => changeSet.changes.map((entry) => entry.change), [changeSet]);
  const cosmetic = countCosmetic(rawChanges);

  const exit = () => AppRegistry.instance.openDocument(EditorDocumentProvider.ID);

  const focus = (change: GraphChange) => {
    const id = anchorNodeId(change);
    if (id) nodeGraph.switchToComponent(component, { node: { id } as never });
  };

  return (
    <div className={css.Root}>
      <div className={css.Topbar}>
        <Label hasLeftSpacing>{title}</Label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <PrimaryButton
            label="Accept all"
            onClick={() => {
              onAccept();
              exit();
            }}
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
            <Text textType={TextType.Shy}>Click a change to see it on the canvas.</Text>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {groups.map((group) => (
              <div key={group.group}>
                <div className={css.GroupHeader}>
                  <Label>{group.group}</Label>
                </div>
                {group.changes.map((presented) => {
                  const clickable = anchorNodeId(presented.change) !== undefined;
                  const params = paramDetail(presented.change);
                  return (
                    <div key={presented.key}>
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
                        <Text textType={TextType.Default}>{presented.text}</Text>
                      </button>
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
