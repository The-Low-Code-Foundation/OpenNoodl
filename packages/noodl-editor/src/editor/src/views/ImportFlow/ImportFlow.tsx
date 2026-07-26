/**
 * LIB-005: the import flow.
 *
 * One surface for what used to be three popups (import, collisions, export) and
 * five call sites. Three stages, one modal, no second dialog:
 *
 *   Select  →  Review  →  Result
 *
 * The state machine holds four things: the requested roots, the dropped
 * heuristic links, the explicit collision resolutions, and where we are. The
 * plan is never stored — it is recomputed from those on every render, twice:
 * once with no resolutions (to discover what collides and seed the defaults),
 * then once with the effective resolutions applied. Planning is pure and
 * in-memory, so this costs nothing and buys the guarantee that what is on
 * screen is exactly what `apply()` will do.
 *
 * @module noodl-editor/views/ImportFlow/ImportFlow
 */

import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import type { ImportPlan, ImportResult } from '@noodl-utils/import-engine';

import { ClosurePane } from './components/ClosurePane';
import { ResultStage } from './components/ResultStage';
import { ReviewStage } from './components/ReviewStage';
import { SelectStage } from './components/SelectStage';
import css from './ImportFlow.module.scss';
import { FlowItem, ItemCategory } from './model/items';
import {
  EMPTY_SELECTION,
  planIndex,
  PlannedStatus,
  Resolution,
  ResolutionMap,
  SelectionState,
  suggestName,
  toggleDroppedLink,
  toggleRequested
} from './model/selection';
import { LoadedSource, loadSource, planSelection, takenComponentNames } from './model/session';
import { summarizePlan, summarizeResult } from './model/summary';
import type { TargetSnapshot } from './model/targetProject';

export type ImportFlowMode = 'import' | 'export';

export interface ImportFlowProps {
  mode: ImportFlowMode;
  /** Modal title, e.g. "Import from My Other Project". */
  title: string;
  /** Sub-line under the title — where the content comes from. */
  subtitle?: string;
  sourceDir: string;
  /** The project being imported into, named for the review headline. */
  targetName: string;
  target: TargetSnapshot;
  /**
   * What is ticked when the flow opens. `'all'` for module/prefab installs
   * (you asked for the whole thing); a category list for import-from-URL, which
   * historically pre-ticked components and files and let the closure fetch the
   * rest; omitted for import-from-project, which opens on a blank slate.
   */
  initialSelection?: 'all' | ItemCategory[];
  /**
   * Prefab semantics: a colliding non-component item defaults to "keep yours"
   * rather than overwrite. It is still SHOWN — the old silent drop becomes a
   * visible resolution the user can change.
   */
  keepExistingNonComponents?: boolean;
  onApply: (plan: ImportPlan) => Promise<ImportResult>;
  /** Called when the flow finishes successfully and the user dismisses it. */
  onDone: (result: ImportResult) => void;
  onCancel: () => void;
}

type Stage = 'loading' | 'select' | 'review' | 'applying' | 'result';

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'select', label: 'Select' },
  { stage: 'review', label: 'Review' },
  { stage: 'result', label: 'Done' }
];

function Stepper({ stage }: { stage: Stage }) {
  const order = ['loading', 'select', 'review', 'applying', 'result'];
  const current = order.indexOf(stage);
  return (
    <div className={css['steps']}>
      {STEPS.map((step, i) => {
        const index = order.indexOf(step.stage);
        const isActive = stage === step.stage || (stage === 'applying' && step.stage === 'review');
        return (
          <React.Fragment key={step.stage}>
            {i > 0 && <span className={css['stepDivider']} />}
            <span
              className={classNames(css['step'], {
                [css['stepActive']]: isActive,
                [css['stepDone']]: !isActive && index < current
              })}
            >
              {step.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * A colliding item's default resolution. Components default to overwrite (the
 * legacy behaviour, and the one the diff makes safe to offer); prefab installs
 * default their non-component collisions to "keep yours".
 */
function defaultResolutions(index: Map<string, PlannedStatus>, keepExistingNonComponents: boolean): ResolutionMap {
  const defaults: Record<string, Resolution> = {};
  for (const planned of index.values()) {
    if (!planned.collides) continue;
    defaults[planned.key] =
      keepExistingNonComponents && planned.category !== 'component' ? { kind: 'skip' } : { kind: 'overwrite' };
  }
  return defaults;
}

export function ImportFlow({
  mode,
  title,
  subtitle,
  sourceDir,
  targetName,
  target,
  initialSelection,
  keepExistingNonComponents,
  onApply,
  onDone,
  onCancel
}: ImportFlowProps) {
  const [stage, setStage] = useState<Stage>('loading');
  const [source, setSource] = useState<LoadedSource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [resolutions, setResolutions] = useState<ResolutionMap>({});
  const [query, setQuery] = useState('');
  const [closedFolders, setClosedFolders] = useState<ReadonlySet<string>>(new Set());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [appliedPlan, setAppliedPlan] = useState<ImportPlan | null>(null);

  const verb = mode === 'export' ? 'Export' : 'Import';

  useEffect(() => {
    let cancelled = false;
    loadSource(sourceDir).then(
      (loaded) => {
        if (cancelled) return;
        setSource(loaded);
        if (initialSelection) {
          const wanted =
            initialSelection === 'all'
              ? loaded.items
              : loaded.items.filter((item) => initialSelection.includes(item.category));
          setSelection({ requested: new Set(wanted.map((i) => i.key)), droppedLinks: new Set() });
        }
        setStage('select');
      },
      (err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [sourceDir, initialSelection]);

  const items: FlowItem[] = source?.items ?? [];

  // Pass 1: what collides, with nothing resolved. Seeds the defaults.
  const basePlan = useMemo(
    () => (source ? planSelection(source, target, selection) : null),
    [source, target, selection]
  );
  const baseIndex = useMemo(() => (basePlan ? planIndex(basePlan) : new Map<string, PlannedStatus>()), [basePlan]);

  const effective: ResolutionMap = useMemo(
    () => ({ ...defaultResolutions(baseIndex, Boolean(keepExistingNonComponents)), ...resolutions }),
    [baseIndex, keepExistingNonComponents, resolutions]
  );

  // Pass 2: the plan as it will actually be applied.
  const plan = useMemo(
    () => (source ? planSelection(source, target, selection, effective) : null),
    [source, target, selection, effective]
  );
  const index = useMemo(() => (plan ? planIndex(plan) : new Map<string, PlannedStatus>()), [plan]);
  const summary = useMemo(() => (plan ? summarizePlan(plan, index) : null), [plan, index]);
  /**
   * Is `name` already claimed by something other than the component called
   * `ownName`? Per-component, because a component must not be judged to collide
   * with its own pending rename.
   */
  const isNameTaken = useCallback(
    (ownName: string, name: string) => (plan ? takenComponentNames(plan, target, ownName).has(name) : false),
    [plan, target]
  );

  const setRequested = useCallback((keys: string[], select: boolean) => {
    setSelection((current) => toggleRequested(current, keys, select));
  }, []);

  const toggleLink = useCallback((linkKey: string) => {
    setSelection((current) => toggleDroppedLink(current, linkKey));
  }, []);

  const toggleFolderOpen = useCallback((path: string) => {
    setClosedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const resolve = useCallback((key: string, resolution: Resolution) => {
    setResolutions((current) => ({ ...current, [key]: resolution }));
  }, []);

  const proposeName = useCallback(
    (key: string, currentName: string) => {
      // Suggest against the set minus this component, for the same reason the
      // validation excludes it — otherwise the suggestion is measured against
      // its own previous proposal.
      const others = plan ? takenComponentNames(plan, target, currentName) : new Set<string>();
      resolve(key, { kind: 'rename', newName: suggestName(currentName, others) });
    },
    [resolve, plan, target]
  );

  const apply = useCallback(async () => {
    if (!plan) return;
    setStage('applying');
    setAppliedPlan(plan);
    try {
      const applied = await onApply(plan);
      setResult(applied);
    } catch (err) {
      setResult({
        result: 'failure',
        message: err instanceof Error ? err.message : String(err),
        componentsImported: [],
        variantsImported: [],
        stylesImported: { colors: [], text: [] },
        filesCopied: [],
        modulesCopied: [],
        warnings: []
      });
    }
    setStage('result');
  }, [plan, onApply]);

  /**
   * A rename that is blank or lands on a taken name must not be applyable. The
   * engine is the authority on the second half: `plan()` evaluates a renamed
   * component's collision against its NEW name, so `policy=rename && collides`
   * means exactly "renamed onto something that already exists".
   */
  const renameProblem = useMemo(() => {
    for (const resolution of Object.values(effective)) {
      if (resolution.kind === 'rename' && resolution.newName.trim() === '') {
        return 'Give every renamed item a name.';
      }
    }
    const clash = plan?.components.find((c) => c.policy.action === 'rename' && c.collides);
    if (clash) return `“${(clash.policy as { newName: string }).newName}” is already taken.`;
    return null;
  }, [effective, plan]);

  // ── Chrome ────────────────────────────────────────────────────────────────

  const footer = (() => {
    if (stage === 'select') {
      const count = selection.requested.size;
      const total = index.size;
      return (
        <>
          <span className={css['footerNote']}>
            {count === 0
              ? 'Nothing selected yet.'
              : `${count} selected, ${total} item${total === 1 ? '' : 's'} in total once dependencies are included.`}
          </span>
          <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={onCancel} />
          <PrimaryButton
            label="Continue"
            isDisabled={total === 0}
            onClick={() => {
              setFocusedKey(null);
              setStage('review');
            }}
          />
        </>
      );
    }

    if (stage === 'review') {
      return (
        <>
          <span className={css['footerNote']}>
            {renameProblem ?? (summary?.isEmpty ? 'Nothing to apply.' : 'Applied as one undo step.')}
          </span>
          <PrimaryButton label="Back" variant={PrimaryButtonVariant.Muted} onClick={() => setStage('select')} />
          <PrimaryButton
            label={verb}
            isDisabled={Boolean(renameProblem) || Boolean(summary?.isEmpty)}
            onClick={apply}
          />
        </>
      );
    }

    if (stage === 'applying') {
      return (
        <>
          <span className={css['footerNote']}>{verb}ing…</span>
          <PrimaryButton label={verb} isLoading isDisabled />
        </>
      );
    }

    if (stage === 'result') {
      return (
        <>
          <span className={css['footerNote']} />
          <PrimaryButton label="Close" onClick={() => (result ? onDone(result) : onCancel())} />
        </>
      );
    }

    return (
      <>
        <span className={css['footerNote']} />
        <PrimaryButton label="Cancel" variant={PrimaryButtonVariant.Muted} onClick={onCancel} />
      </>
    );
  })();

  return (
    <div className={classNames(css['root'], { [css['rootNarrow']]: stage === 'result' })}>
      <div className={css['header']}>
        <Icon icon={mode === 'export' ? IconName.ImportLeft : IconName.ImportDown} size={IconSize.Small} />
        <div style={{ minWidth: 0 }}>
          <h1 className={css['title']}>{title}</h1>
          {subtitle && <p className={css['subtitle']}>{subtitle}</p>}
        </div>
        <span className={css['headerSpacer']} />
        <Stepper stage={stage} />
      </div>

      {loadError && (
        <div className={css['centered']}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Default} />
          <div>Could not read that project.</div>
          <div>{loadError}</div>
        </div>
      )}

      {!loadError && stage === 'loading' && <div className={css['centered']}>Reading the project…</div>}

      {!loadError && stage === 'select' && source && (
        <SelectStage
          source={source}
          items={items}
          selection={selection}
          index={index}
          query={query}
          closedFolders={closedFolders}
          focusedKey={focusedKey}
          onQueryChange={setQuery}
          onToggleFolderOpen={toggleFolderOpen}
          onSetRequested={setRequested}
          onFocus={setFocusedKey}
          onToggleLink={toggleLink}
        />
      )}

      {!loadError && (stage === 'review' || stage === 'applying') && plan && summary && (
        <div className={css['body']}>
          <div className={css['leftPane']}>
            <ReviewStage
              plan={plan}
              summary={summary}
              index={index}
              items={items}
              effective={effective}
              targetName={targetName}
              isNameTaken={isNameTaken}
              onResolve={resolve}
              onSuggestName={proposeName}
            />
          </div>
          {source && (
            <ClosurePane
              source={source}
              items={items}
              selection={selection}
              index={index}
              focusedKey={focusedKey}
              onFocus={setFocusedKey}
              onToggleLink={toggleLink}
            />
          )}
        </div>
      )}

      {!loadError && stage === 'result' && result && appliedPlan && (
        <ResultStage
          summary={summarizeResult(result, appliedPlan, mode)}
          failed={result.result !== 'success'}
          failureMessage={result.message}
          verb={verb}
          isExport={mode === 'export'}
        />
      )}

      <div className={css['footer']}>{footer}</div>
    </div>
  );
}
