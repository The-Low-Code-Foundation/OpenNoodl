/**
 * LIB-005: the result stage — what actually landed, and what undo will take back.
 *
 * The honesty this stage owes the user is the split between model changes and
 * disk writes. `apply()` puts every model change in one `UndoActionGroup`; file
 * and module copies happen outside it and are not undoable. Saying so here is
 * cheaper than letting someone discover it by pressing Cmd+Z.
 *
 * @module noodl-editor/views/ImportFlow/components/ResultStage
 */

import classNames from 'classnames';
import React from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import { ResultSummary } from '../model/summary';
import css from '../ImportFlow.module.scss';

export interface ResultStageProps {
  summary: ResultSummary;
  failed: boolean;
  failureMessage?: string;
  verb: string;
}

export function ResultStage({ summary, failed, failureMessage, verb }: ResultStageProps) {
  if (failed) {
    return (
      <div className={css['reviewScroll']}>
        <div className={classNames(css['resultIcon'], css['resultIconFail'])}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Default} />
        </div>
        <h2 className={css['headline']}>{verb} failed</h2>
        <p className={css['headlineSub']}>{failureMessage ?? 'Something went wrong.'}</p>
        {summary.warnings.length > 0 && (
          <div className={classNames(css['resultNote'], css['warnNote'])}>
            {summary.warnings.map((warning, i) => (
              <div key={i}>{warning}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={css['reviewScroll']}>
      <div className={css['resultIcon']}>
        <Icon icon={IconName.Check} size={IconSize.Default} />
      </div>
      <h2 className={css['headline']}>{verb} complete</h2>
      <p className={css['headlineSub']}>{summary.undoNote}</p>

      {summary.modelLines.length > 0 && (
        <>
          <h3 className={css['blockTitle']}>In your project</h3>
          <ul className={css['resultList']}>
            {summary.modelLines.map((line) => (
              <li key={line}>
                <Icon icon={IconName.Check} size={IconSize.Tiny} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {summary.renames.length > 0 && (
        <>
          <h3 className={css['blockTitle']}>Renamed on the way in</h3>
          <ul className={css['resultList']}>
            {summary.renames.map((rename) => (
              <li key={rename.from}>
                <span>{rename.from}</span>
                <Icon icon={IconName.ArrowRight} size={IconSize.Tiny} />
                <span>{rename.to}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {summary.kept.length > 0 && (
        <>
          <h3 className={css['blockTitle']}>Kept as yours</h3>
          <ul className={css['resultList']}>
            {summary.kept.map((kept) => (
              <li key={kept}>
                <span>{kept}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {summary.diskLines.length > 0 && (
        <>
          <h3 className={css['blockTitle']}>Written to disk</h3>
          <ul className={css['resultList']}>
            {summary.diskLines.map((line) => (
              <li key={line}>
                <Icon icon={IconName.File} size={IconSize.Tiny} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <div className={css['resultNote']}>These are files on disk. Undo does not remove them.</div>
        </>
      )}

      {summary.warnings.length > 0 && (
        <div className={classNames(css['resultNote'], css['warnNote'])} style={{ marginTop: 12 }}>
          {summary.warnings.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
