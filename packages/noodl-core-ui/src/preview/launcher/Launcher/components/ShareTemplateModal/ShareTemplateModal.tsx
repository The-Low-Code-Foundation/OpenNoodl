import React, { useId } from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Modal } from '@noodl-core-ui/components/layout/Modal';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ShareTemplateModal.module.scss';

/**
 * FB-005 T5 — the dialog that files a template submission.
 *
 * ## 🔴 It decides nothing, and that is the arrangement rather than an accident
 *
 * Every rule this dialog appears to enforce lives somewhere else. The shapes and the vocabularies
 * are `0021`'s CHECK constraints; what leaves the machine is `shareAsTemplate.ts`; the messages
 * and the enable/disable are `shareTemplateForm.ts`. **This file is markup, an `onChange` per
 * field, and nothing else** — because it cannot be graded here: it draws `Modal`, `TextInput` and
 * `TextArea`, which reach `common/Icon`, and `Icon.tsx` uses webpack's `require.context`,
 * which ts-jest rejects at type-check time. A rule written in this file would be a rule no spec in
 * this repository can load.
 *
 * ⚠️ **So it is verified by being driven**, and the scope file says why that mattered: *"a
 * five-field dialog written blind and never driven would be the appearance of a caller, and the
 * one thing worse than an unreachable mechanism is one that looks reachable."*
 *
 * ## Fully controlled, including the outcome
 *
 * No `useState`. The host owns the draft, the sending flag and the result, for the same reason
 * `useProjectTemplates` owns the shelf: the state has decisions attached to it and the decisions
 * are graded in `noodl-editor`, which this package may not import.
 */

/** The five fields, as strings. Mirrors `TemplateShareDraft` in `noodl-editor`. */
export interface ShareTemplateDraft {
  slug: string;
  title: string;
  summary: string;
  category: string;
  licence: string;
}

/** One option in the two closed vocabularies. Passed in — a copy here would be a fifth. */
export interface ShareTemplateOption {
  value: string;
  label: string;
}

/** What came back, already turned into sentences by the host. */
export interface ShareTemplateResult {
  tone: 'submitted' | 'problem' | 'refused';
  headline: string;
  detail: string;
  withheld: { path: string; why: string }[];
}

export interface ShareTemplateModalProps {
  isVisible: boolean;
  /** The project being shared, for the subtitle. */
  projectName: string;
  draft: ShareTemplateDraft;
  onChange: (draft: ShareTemplateDraft) => void;

  categories: ShareTemplateOption[];
  licences: ShareTemplateOption[];

  /** Field name → message, for fields the host has decided to show a message on. */
  problems: Partial<Record<keyof ShareTemplateDraft, string>>;

  /** Non-null when the send button is off, and it is the reason why. */
  sendDisabledBecause: string | null;
  isSending: boolean;
  result: ShareTemplateResult | null;

  onSend: () => void;
  onClose: () => void;
}

export function ShareTemplateModal({
  isVisible,
  projectName,
  draft,
  onChange,
  categories,
  licences,
  problems,
  sendDisabledBecause,
  isSending,
  result,
  onSend,
  onClose
}: ShareTemplateModalProps) {
  const set = (field: keyof ShareTemplateDraft) => (value: string) => onChange({ ...draft, [field]: value });

  return (
    <Modal
      isVisible={isVisible}
      onClose={onClose}
      title="Share as template"
      subtitle={projectName}
      hasHeaderDivider
      hasFooterDivider
      footerSlot={
        <div className={css['Footer']}>
          {/* ⚠️ The reason the button is off is drawn NEXT to it, always. A disabled button with
              no sentence beside it is the commonest way a form becomes unusable in silence. */}
          {sendDisabledBecause && (
            <Text textType={TextType.Shy} className={css['FooterNote']}>
              {sendDisabledBecause}
            </Text>
          )}
          <HStack hasSpacing UNSAFE_style={{ justifyContent: 'flex-end' }}>
            <PrimaryButton
              label="Close"
              variant={PrimaryButtonVariant.Muted}
              onClick={onClose}
              testId="share-template-close"
            />
            <PrimaryButton
              label={isSending ? 'Sending…' : 'Send for review'}
              isDisabled={Boolean(sendDisabledBecause)}
              onClick={onSend}
              testId="share-template-send"
            />
          </HStack>
        </div>
      }
    >
      <div className={css['Body']} data-test="share-template-dialog">
        {/* 🔴 THE FIRST THING IT SAYS IS THAT THIS IS NOT A PUBLICATION. The route returns
            `status: 'pending'` for the same reason; saying it only at the end would mean the
            person learns it after they have decided. */}
        <div className={css['Preamble']}>
          <Text>
            Your project is sent to the NodeGX team for review. It is not published straight away, and
            you can keep working on it in the meantime.
          </Text>
        </div>

        <Field label="Name on the shelf" problem={problems.title}>
          <TextInput
            value={draft.title}
            variant={TextInputVariant.InModal}
            onChange={(e) => set('title')(e.target.value)}
            testId="share-template-title"
          />
        </Field>

        <Field
          label="Short name"
          hint="Used in the template’s address. Lowercase letters, numbers and hyphens."
          problem={problems.slug}
        >
          <TextInput
            value={draft.slug}
            variant={TextInputVariant.InModal}
            onChange={(e) => set('slug')(e.target.value)}
            testId="share-template-slug"
          />
        </Field>

        <Field label="What is it?" problem={problems.summary}>
          <TextArea
            value={draft.summary}
            onChange={(e) => set('summary')(e.target.value)}
            UNSAFE_className={css['Summary']}
          />
        </Field>

        <Field label="Category" problem={problems.category}>
          <Choice
            name="share-template-category"
            options={categories}
            value={draft.category}
            onChange={set('category')}
            layout="row"
          />
        </Field>

        {/* ⚠️ A SELECT AND NOT A FREE-TEXT BOX, and the vocabulary is closed on purpose: a
            copyleft template would put its terms on the app somebody builds from it. */}
        <Field
          label="What may other people do with it?"
          hint="Whoever installs this template keeps a copy of your work. This is what they are allowed to do with it."
          problem={problems.licence}
        >
          <Choice
            name="share-template-licence"
            options={licences}
            value={draft.licence}
            onChange={set('licence')}
            layout="stack"
          />
        </Field>

        {result && (
          <div
            className={[css['Result'], css[`is-${result.tone}`]].join(' ')}
            data-test="share-template-result"
            role="status"
          >
            <Text textType={TextType.DefaultContrast} className={css['ResultHeadline']}>
              {result.headline}
            </Text>
            <Text>{result.detail}</Text>

            {/* 🔴 WHAT STAYED BEHIND IS SHOWN, NOT COUNTED. `.mcp.json` holds absolute paths out
                of this machine and must never travel — and a person who can see that it was
                withheld can also see the day something they wanted was. */}
            {result.withheld.length > 0 && (
              <div className={css['Withheld']} data-test="share-template-withheld">
                <Text textType={TextType.Shy}>Left on your machine:</Text>
                <ul className={css['WithheldList']}>
                  {result.withheld.map((entry) => (
                    <li key={entry.path}>
                      <code className={css['WithheldPath']}>{entry.path}</code>
                      <span className={css['WithheldWhy']}>{entry.why}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}


/**
 * A closed vocabulary, drawn in the modal itself.
 *
 * 🔴 **NOT `Select`, AND THE REASON IS MEASURED RATHER THAN STYLISTIC.** `Select` draws its
 * options through `BaseDialog`, which renders them into `dialog-layer-portal-target` — a portal
 * **outside** the modal's DOM subtree. `BaseDialog` dismisses when a gesture starts and ends
 * outside `visibleDialogRef`, and an option in that portal is outside it by that test, so picking
 * a category **closed the whole dialog** and the form could not be completed at all.
 *
 * ⚠️ Measured live on 2026-08-26, and this dialog is the FIRST `Modal` in the editor to contain a
 * `Select` — the combination had no instance, so nothing was broken until there was one. The
 * underlying defect is `BaseDialog`'s, is recorded in `FB-005-SCOPE.md`, and is deliberately not
 * fixed here: `isOutsideDialog` is the dismissal rule of every dialog in the editor.
 *
 * 🔴 **AND THE `name` IS PER-INSTANCE, WHICH IS THE SECOND DEFECT THE DRIVE FOUND HERE.** A radio
 * group's `name` is **document-global**, and `BaseDialog` renders every dialog's children TWICE —
 * once into a hidden `MeasuringContainer` and once visibly. A fixed `name` therefore put **12
 * radios into one group**: six ghosts and six real ones, each unchecking its twin, so a pick
 * appeared to take and then flapped back. Measured live, 12 inputs under one name.
 *
 * ⚠️ `useId` gives the two copies different names because they are two component instances at
 * different positions in the tree. **A name derived from a PROP cannot fix this** — both copies
 * receive the same props, which is the whole point of the measuring copy.
 *
 * ⚠️ **Selection is carried by the BORDER and the text, never by the fill alone.** FB-002's
 * selected pill measures **1.16:1** against its panel, which is a state nobody can see; the
 * cheapest real fix recorded there is to move the state to the border, and this starts there
 * rather than repeating it.
 */
function Choice({
  name,
  options,
  value,
  onChange,
  layout
}: {
  name: string;
  options: ShareTemplateOption[];
  value: string;
  onChange: (value: string) => void;
  layout: 'row' | 'stack';
}) {
  const groupName = `${name}-${useId()}`;

  return (
    <div className={[css['Choice'], css[`is-${layout}`]].join(' ')} role="radiogroup" aria-label={name} data-test={name}>
      {options.map((option) => (
        <label
          key={option.value}
          className={[css['ChoiceItem'], value === option.value && css['is-selected']].filter(Boolean).join(' ')}
          data-test={`${name}-${option.value}`}
        >
          {/* A real radio input: keyboard, screen readers and form semantics all come free, and
              nothing here is portalled anywhere. */}
          <input
            className={css['ChoiceInput']}
            type="radio"
            name={groupName}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className={css['ChoiceLabel']}>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/** A label, a control and the one message that field may carry. */
function Field({
  label,
  hint,
  problem,
  children
}: {
  label: string;
  hint?: string;
  problem?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={css['Field']}>
      <label className={css['Label']}>{label}</label>
      {hint && (
        <Text textType={TextType.Shy} className={css['Hint']}>
          {hint}
        </Text>
      )}
      {children}
      {problem && (
        <Text textType={TextType.Danger} className={css['Problem']} testId="share-template-problem">
          {problem}
        </Text>
      )}
    </div>
  );
}
