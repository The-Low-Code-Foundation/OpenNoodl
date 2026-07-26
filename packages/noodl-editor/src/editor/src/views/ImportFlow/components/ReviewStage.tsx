/**
 * LIB-005: the review stage — understand the impact before committing.
 *
 * Three things, in the order the question is actually asked:
 *
 * 1. **What lands.** Counts by category and the folders that gain something.
 * 2. **What collides.** Every collision is resolved *here*, inline, with three
 *    explicit choices — skip / overwrite / rename. There is no second popup.
 *    An overwrite leads with SUB-007's one-line roll-up ("changes 4 nodes,
 *    removes 1 connection") and puts the full `ComponentDiffView` one
 *    disclosure behind it, which is AIX-003's register: the summary answers the
 *    non-technical reader, the detail is there for the one who wants it.
 * 3. **What else comes along**, so nothing arrives unannounced.
 *
 * Prefab installs used to drop colliding styles silently. They now arrive here
 * pre-resolved to `skip`, labelled "kept yours" — a visible decision the user
 * can change, not a silent one.
 *
 * @module noodl-editor/views/ImportFlow/components/ReviewStage
 */

import classNames from 'classnames';
import React, { useState } from 'react';

import { Chip, ChipVariant } from '@noodl-core-ui/components/common/Chip';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';

import type { ImportPlan } from '@noodl-utils/import-engine';

import { ComponentDiffView } from '../../panels/GraphDiffPanel';
import { summarizeChanges } from '../../panels/GraphDiffPanel/graphChangePresentation';
import { CATEGORY_LABEL, CATEGORY_NOUN, FlowItem, itemKey } from '../model/items';
import { PlannedStatus, Resolution, ResolutionMap } from '../model/selection';
import { describeCounts, PlanSummary, plural } from '../model/summary';
import css from '../ImportFlow.module.scss';

export interface ReviewStageProps {
  plan: ImportPlan;
  summary: PlanSummary;
  index: Map<string, PlannedStatus>;
  items: FlowItem[];
  /** The effective resolution for every colliding item (defaults merged in). */
  effective: ResolutionMap;
  targetName: string;
  /** Names a rename must avoid — target's components plus this import's. */
  isNameTaken: (ownName: string, name: string) => boolean;
  onResolve: (key: string, resolution: Resolution) => void;
  onSuggestName: (key: string, currentName: string) => void;
}

const RESOLUTION_LABEL: Record<Resolution['kind'], string> = {
  skip: 'Keep mine',
  overwrite: 'Overwrite',
  rename: 'Rename'
};

function Segmented({
  value,
  options,
  onChange
}: {
  value: Resolution['kind'];
  options: Resolution['kind'][];
  onChange: (kind: Resolution['kind']) => void;
}) {
  return (
    <div className={css['segmented']}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={classNames(css['segment'], { [css['segmentActive']]: value === option })}
          onClick={() => onChange(option)}
        >
          {RESOLUTION_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

function CollisionRow({
  planned,
  resolution,
  isNameTaken,
  onResolve,
  onSuggestName
}: {
  planned: PlannedStatus;
  resolution: Resolution;
  isNameTaken: (ownName: string, name: string) => boolean;
  onResolve: (key: string, resolution: Resolution) => void;
  onSuggestName: (key: string, currentName: string) => void;
}) {
  const [showDiff, setShowDiff] = useState(false);

  // Rename re-points references within the imported set, which the engine only
  // does for components — so it is only offered for components.
  const options: Resolution['kind'][] =
    planned.category === 'component' ? ['skip', 'overwrite', 'rename'] : ['skip', 'overwrite'];

  const renameValue = resolution.kind === 'rename' ? resolution.newName : '';
  // Judged against every other name, never this component's own pending
  // rename — otherwise the field reports itself as taken and can never clear.
  const renameCollides =
    resolution.kind === 'rename' && renameValue.trim() !== '' && isNameTaken(planned.name, renameValue.trim());
  const renameEmpty = resolution.kind === 'rename' && renameValue.trim() === '';

  return (
    <div className={classNames(css['collision'], { [css['collisionKept']]: resolution.kind === 'skip' })}>
      <div className={css['collisionHead']}>
        <span className={css['collisionName']}>{planned.name}</span>
        <Chip label={CATEGORY_NOUN[planned.category]} variant={ChipVariant.Neutral} />
        {resolution.kind === 'skip' && <Chip label="kept yours" variant={ChipVariant.Neutral} />}
        <span className={css['collisionSpacer']} />
        <Segmented
          value={resolution.kind}
          options={options}
          onChange={(kind) => {
            if (kind === 'rename') onSuggestName(planned.key, planned.name);
            else onResolve(planned.key, { kind } as Resolution);
          }}
        />
      </div>

      {resolution.kind === 'overwrite' && (
        <div className={css['collisionDetail']}>
          {planned.diff ? (
            <>
              <button type="button" className={css['collisionSummary']} onClick={() => setShowDiff(!showDiff)}>
                <Icon icon={showDiff ? IconName.CaretDown : IconName.CaretRight} size={IconSize.Tiny} />
                <span>
                  Your version changes: {summarizeChanges(planned.diff.changes, 'nothing but node positions')}
                </span>
              </button>
              {showDiff && (
                <div className={css['diffHost']}>
                  <ComponentDiffView diff={planned.diff} />
                </div>
              )}
            </>
          ) : (
            <div className={css['blockHint']} style={{ margin: 0 }}>
              Your version will be replaced. A node-level diff is not available for this item.
            </div>
          )}
        </div>
      )}

      {resolution.kind === 'rename' && (
        <div className={css['renameRow']}>
          <TextInput
            value={renameValue}
            label="Import as"
            onChange={(e) => onResolve(planned.key, { kind: 'rename', newName: e.currentTarget.value })}
          />
          {renameCollides && <div className={css['renameError']}>That name is already taken.</div>}
          {renameEmpty && <div className={css['renameError']}>Give the imported copy a name.</div>}
        </div>
      )}
    </div>
  );
}

export function ReviewStage({
  plan,
  summary,
  index,
  items,
  effective,
  targetName,
  isNameTaken,
  onResolve,
  onSuggestName
}: ReviewStageProps) {
  const collisions = summary.collisions.filter((planned) => planned.collides || effective[planned.key] !== undefined);
  // A renamed item has `collides: false` (its new name is free) but is still a
  // collision row — it must not also appear under "arriving new".
  const collisionKeys = new Set(collisions.map((planned) => planned.key));
  const landing = [...index.values()].filter(
    (planned) => planned.policy.action !== 'skip' && !planned.collides && !collisionKeys.has(planned.key)
  );
  const byKey = new Map(items.map((item) => [item.key, item] as const));

  return (
    <div className={css['reviewScroll']}>
      <h2 className={css['headline']}>
        {describeCounts(summary.counts)} into {targetName}
      </h2>
      <p className={css['headlineSub']}>
        {summary.folders.length > 0
          ? `Components land in ${summary.folders.join(', ')}.`
          : 'No components in this selection.'}{' '}
        Everything here is applied as one undo step.
      </p>

      <div className={css['countGrid']}>
        {summary.counts.map((count) => (
          <div className={css['countCard']} key={count.category}>
            <div className={css['countValue']}>{count.landing}</div>
            <div className={css['countLabel']}>{CATEGORY_LABEL[count.category]}</div>
            {count.overwritten > 0 && <div className={css['countNote']}>{count.overwritten} overwritten</div>}
            {count.renamed > 0 && <div className={css['countNote']}>{count.renamed} renamed</div>}
            {count.kept > 0 && <div className={css['countNote']}>{count.kept} kept as yours</div>}
          </div>
        ))}
      </div>

      {collisions.length > 0 && (
        <>
          <h3 className={css['blockTitle']}>{plural(collisions.length, 'collision')}</h3>
          <p className={css['blockHint']}>
            Your project already has these. Decide each one — nothing is overwritten until you apply.
          </p>
          {collisions.map((planned) => (
            <CollisionRow
              key={planned.key}
              planned={planned}
              resolution={effective[planned.key] ?? { kind: 'overwrite' }}
              isNameTaken={isNameTaken}
              onResolve={onResolve}
              onSuggestName={onSuggestName}
            />
          ))}
        </>
      )}

      {landing.length > 0 && (
        <>
          <h3 className={css['blockTitle']} style={{ marginTop: collisions.length > 0 ? 24 : 0 }}>
            Arriving new
          </h3>
          <p className={css['blockHint']}>Nothing in your project has these names.</p>
          <div className={css['landingList']}>
            {landing.map((planned) => {
              const item = byKey.get(itemKey(planned.category, planned.name, planned.typename));
              return (
                <div className={css['landingRow']} key={planned.key}>
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>{planned.name}</span>
                  {item?.nodeCount ? <span className={css['landingWhy']}>{item.nodeCount} nodes</span> : null}
                  <span className={css['landingWhy']}>
                    {planned.reason === 'requested'
                      ? CATEGORY_NOUN[planned.category]
                      : `needed by ${planned.requiredBy.join(', ')}`}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {Object.keys(plan.renames).length > 0 && (
        <>
          <h3 className={css['blockTitle']} style={{ marginTop: 24 }}>
            Renames
          </h3>
          <p className={css['blockHint']}>
            References between the imported components follow the new names automatically.
          </p>
          <div className={css['landingList']}>
            {Object.entries(plan.renames).map(([from, to]) => (
              <div className={css['landingRow']} key={from}>
                <span>{from}</span>
                <Icon icon={IconName.ArrowRight} size={IconSize.Tiny} />
                <span>{to}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {summary.isEmpty && (
        <div className={css['centered']}>Nothing would be imported. Go back and pick something.</div>
      )}
    </div>
  );
}
