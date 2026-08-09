/**
 * BEN-006 — Your own sample data, in the preview
 *
 * > *"It would be cool if we could extend the 'set your own static data' to the
 * > AI preview with the dummy data existing option, so users can set their own
 * > data ideas and see what they render like."* — Richard, 2026-08-08
 *
 * The dataset a preview runs on is assembled from three sources and every one
 * of them is an inference: what the agent imagined, what the wires say, what
 * the code reads. The missing source is the person looking at the screen — so
 * nobody could ever ask the preview *"show me this with a 60-character product
 * name"*, or *"with one row"*, or *"with my actual copy"*. Those are the
 * questions that decide whether a component is any good, and until now the
 * preview could not answer a single one of them.
 *
 * This is the editor for the fourth layer `sandboxData` gained in BEN-006 §1.
 * It edits **preview state, and only preview state** (R5): nothing here writes
 * to `project.json`, nothing seeds a backend, and the records exist for exactly
 * as long as the preview does. The panel says so out loud, because a data
 * editor that looks like it might be writing somewhere is one people use once.
 *
 * ## Two views, one value
 *
 * A table for flat records and raw JSON as the escape hatch, and they must edit
 * the same thing or the escape hatch is a second dialect. So each class holds
 * `records` *and* the JSON text: table edits rewrite both, JSON edits rewrite
 * the text and re-parse into `records` when they can. Text that does not parse
 * is kept, with its error, rather than discarded — losing what someone typed
 * because they were mid-keystroke is how an editor teaches you not to use it.
 *
 * ## Apply, not keystroke
 *
 * ⚠️ The dataset rides in the export's **metadata**, so changing it is a changed
 * export, so the runtime calls `location.reload()`. That is acceptable here and
 * would not be for BEN-002's inputs: a data change is a deliberate act, not
 * typing. Hence one **Apply** button, and the panel stays open across the
 * reload so the round trip is visible rather than a white flash.
 *
 * @module noodl-editor/views/documents/AuthoringPreviewDocument/SandboxDataEditor
 */

import React, { useMemo, useState } from 'react';

import type { AgentSampleData } from '@noodl-models/AiAssistant/authoring';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { SandboxDataset } from '@noodl/runtime/src/sandbox/types';

import css from './SandboxDataEditor.module.scss';
import {
  INTERNAL_FIELDS,
  ROW_COUNTS,
  cellText,
  draftFrom,
  parseCell,
  visibleFields,
  withJson,
  withRecords,
  withRowCount,
  type ClassDraft
} from './sandboxDataDraft';

export interface SandboxDataEditorProps {
  /** The dataset the preview is currently serving. Prefills every field. */
  dataset: SandboxDataset;
  /** Records the user has already applied, so reopening shows their edits and not the originals. */
  userData?: AgentSampleData;
  /** Apply — the one thing in this panel that changes what is on screen. */
  onApply: (userData: AgentSampleData | undefined) => void;
  onClose: () => void;
}

export function SandboxDataEditor({ dataset, userData, onApply, onClose }: SandboxDataEditorProps) {
  const classNames = useMemo(() => Object.keys(dataset.classes).sort(), [dataset]);
  const unknownShape = useMemo(() => new Set(dataset.unknownShape ?? []), [dataset]);

  // Prefilled with what is being served, not with an empty box: the user is
  // editing what they are looking at, which is what makes the round trip
  // obvious. `dataset` already reflects any applied `userData`, so the flag is
  // all that has to be carried separately.
  const [drafts, setDrafts] = useState<Record<string, ClassDraft>>(() => {
    const initial: Record<string, ClassDraft> = {};
    for (const name of Object.keys(dataset.classes)) {
      initial[name] = draftFrom(dataset.classes[name].records, Boolean(userData?.[name]));
    }
    return initial;
  });

  const revise = (name: string, next: (draft: ClassDraft) => ClassDraft) =>
    setDrafts((current) => ({ ...current, [name]: next(current[name]) }));

  function reset(name: string) {
    setDrafts((current) => ({ ...current, [name]: draftFrom(dataset.classes[name].records, false) }));
  }

  const firstError = classNames.find((name) => drafts[name]?.error);

  function apply() {
    if (firstError) return;
    const next: AgentSampleData = {};
    for (const name of classNames) {
      if (drafts[name]?.edited) next[name] = drafts[name].records;
    }
    onApply(Object.keys(next).length > 0 ? next : undefined);
  }

  return (
    <div className={css.Root}>
      <div className={css.Head}>
        <Text>Sample data</Text>
        <div className={css.HeadNote}>
          <Text textType={TextType.Secondary}>
            Preview only — these records live as long as this preview does. Nothing is written to your project or your
            backend.
          </Text>
        </div>
        <PrimaryButton
          label="Close"
          size={PrimaryButtonSize.Small}
          variant={PrimaryButtonVariant.Ghost}
          onClick={onClose}
        />
      </div>

      <div className={css.Classes}>
        {classNames.length === 0 && (
          <div className={css.Empty}>
            <Text textType={TextType.Secondary}>
              This preview reads no collections, so there is no data to stand in for.
            </Text>
          </div>
        )}

        {classNames.map((name) => {
          const draft = drafts[name];
          const klass = dataset.classes[name];
          const fields = visibleFields(klass.fields, draft.records);
          // `?? klass.fields` for a dataset built before `inferred` existed:
          // with nothing supplied the two are the same set, which is exactly
          // the case an older dataset can be in.
          const inferred = (klass.inferred ?? klass.fields).filter((field) => !INTERNAL_FIELDS.has(field));
          const completed = new Set(klass.completed ?? []);

          return (
            <div className={css.Class} key={name}>
              <div className={css.ClassHead}>
                <Text>{name}</Text>
                <Text textType={TextType.Secondary}>
                  {draft.records.length === 1 ? '1 row' : `${draft.records.length} rows`}
                </Text>
                {/*
                  §3 — `unknownShape` already drives the "Fields unknown" chip in
                  the toolbar. Here it is the opposite of a warning: this is
                  precisely the class where inference failed and a human knows
                  the answer, so it is the one they are invited to fill in.
                */}
                {unknownShape.has(name) && !draft.edited && (
                  <div className={css.Invite}>
                    <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
                    <Text textType={FeedbackType.Notice}>
                      Nothing here could be inferred from the graph — write a row and it will render.
                    </Text>
                  </div>
                )}
                <div className={css.ClassActions}>
                  {ROW_COUNTS.map((count) => (
                    <PrimaryButton
                      key={count}
                      label={String(count)}
                      size={PrimaryButtonSize.Small}
                      // Selected/unselected exactly as the Sample data ⁄ Real
                      // backend pair above already does it. `Muted` is not a
                      // control variant — it measured 1.00:1 across 143 call
                      // sites, and `border-*` cannot carry 3:1 on its own.
                      variant={draft.records.length === count ? undefined : PrimaryButtonVariant.MutedOnLowBg}
                      onClick={() => revise(name, (draft) => withRowCount(draft, count))}
                    />
                  ))}
                  <PrimaryButton
                    label={draft.raw ? 'Table' : 'JSON'}
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.MutedOnLowBg}
                    onClick={() => revise(name, (current) => ({ ...current, raw: !current.raw }))}
                  />
                  <PrimaryButton
                    label="Reset"
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Ghost}
                    isDisabled={!draft.edited}
                    onClick={() => reset(name)}
                  />
                </div>
              </div>

              {/*
                The field list is worth showing on its own: it is what the
                component will actually look at, which is not a thing any other
                surface in the editor tells you.
              */}
              {/*
                ⚠️ Sourced from `inferred`, never from `fields`. `fields` is
                what the dataset *serves* — inference plus whatever the records
                carry — so captioning it "read by the graph" states something
                nobody established: on a class whose shape could not be inferred
                it named the sandbox's own bookkeeping keys, and on one the user
                typed by hand it named the user's keys back at them. The columns
                below are still everything, because everything is editable.
              */}
              <div className={css.Fields}>
                <Text textType={TextType.Secondary}>
                  Read by the graph: {inferred.length > 0 ? inferred.join(', ') : '— nothing inferable'}
                </Text>
                {completed.size > 0 && (
                  <Text textType={TextType.Secondary}>
                    Filled in for you: {Array.from(completed).join(', ')}
                  </Text>
                )}
              </div>

              {draft.raw ? (
                <textarea
                  className={css.Json}
                  spellCheck={false}
                  value={draft.json}
                  onChange={(event) => revise(name, (current) => withJson(current, event.target.value))}
                />
              ) : (
                <div className={css.TableScroll}>
                  <table className={css.Table}>
                    <thead>
                      <tr>
                        <th className={css.RowNumber} />
                        {fields.map((field) => (
                          <th key={field}>{field}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.records.map((record, index) => (
                        <tr key={index}>
                          <td className={css.RowNumber}>{index + 1}</td>
                          {fields.map((field) => (
                            <td key={field}>
                              <input
                                className={css.Cell}
                                value={cellText(record[field])}
                                onChange={(event) => {
                                  const text = event.target.value;
                                  revise(name, (current) =>
                                    withRecords(
                                      current,
                                      current.records.map((row, at) =>
                                        at === index ? { ...row, [field]: parseCell(text, row[field]) } : row
                                      )
                                    )
                                  );
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {draft.records.length === 0 && (
                    <div className={css.NoRows}>
                      <Text textType={TextType.Secondary}>
                        No rows — this is the empty state your component will render.
                      </Text>
                    </div>
                  )}
                  {/*
                    A table with no columns has nothing to type into, so the
                    invitation above has to say where to go instead. This is the
                    §3 case in full: nothing was inferred, so there is no column
                    to offer until the user names one, and JSON is the only
                    place a *new* key can be written.
                  */}
                  {fields.length === 0 && draft.records.length > 0 && (
                    <div className={css.NoRows}>
                      <Text textType={TextType.Secondary}>
                        No columns yet — switch to JSON and write a row like {'{ "name": "…" }'}. What you name there
                        becomes the columns here.
                      </Text>
                    </div>
                  )}
                </div>
              )}

              {draft.error && (
                <div className={css.Error}>
                  <Icon icon={IconName.WarningTriangle} size={IconSize.Small} />
                  <Text textType={FeedbackType.Danger}>{draft.error}</Text>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={css.Foot}>
        {/*
          One Apply, never per keystroke: applying rebuilds the export, and a
          changed export reloads the preview window. Deliberate act, deliberate
          button.
        */}
        {firstError ? (
          <Text textType={FeedbackType.Danger}>{firstError} will not parse — fix it before applying.</Text>
        ) : (
          <Text textType={TextType.Secondary}>Applying re-renders the preview with these records.</Text>
        )}
        <PrimaryButton
          label="Apply"
          size={PrimaryButtonSize.Small}
          isDisabled={Boolean(firstError)}
          onClick={apply}
        />
      </div>
    </div>
  );
}
