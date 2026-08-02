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

import css from '../ImportFlow.module.scss';
import { ResultSummary } from '../model/summary';

export interface ResultStageProps {
  summary: ResultSummary;
  failed: boolean;
  failureMessage?: string;
  verb: string;
  /** Export packs an archive; import mutates the open project. Changes the copy. */
  isExport?: boolean;
}

export function ResultStage({ summary, failed, failureMessage, verb, isExport = false }: ResultStageProps) {
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

      {/*
        LIB-006. Only shown when there is something to say — a clean import gets
        a `proceed` verdict and no banner, so this never becomes decoration the
        user learns to skim past. When it does appear it uses the warning
        treatment, because "complete" with eight unconvertible nodes behind it is
        not the whole truth.
      */}
      {summary.legacy && summary.legacy.recommendation !== 'proceed' && (
        <div className={classNames(css['resultNote'], css['warnNote'])} style={{ marginTop: 12 }}>
          <div>{summary.legacy.line}</div>
          {summary.legacy.placeholders > 0 && (
            <div>
              {summary.legacy.placeholders === 1 ? 'It is' : 'They are'} still on the canvas with the original type and
              settings, flagged in the Problems panel.
            </div>
          )}
          {summary.legacy.reportFiles.length > 0 && (
            <div>Written to your project: {summary.legacy.reportFiles.join(', ')}.</div>
          )}
        </div>
      )}

      {summary.modelLines.length > 0 && (
        <>
          {/* Export packs into an archive; nothing reaches the open project. */}
          <h3 className={css['blockTitle']}>{isExport ? 'Packed' : 'In your project'}</h3>
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
