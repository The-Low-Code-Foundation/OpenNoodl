/**
 * Collection permissions, as a matrix (SPR-001 §3 / F85).
 *
 * The five CLP operations used to be five text boxes per collection, over a
 * closed vocabulary. Typing `nobdy` was a silently different policy, `role:`
 * had to be spelled by hand for a role declared thirty lines further down the
 * same panel, and a role name containing a comma round-tripped into two rules
 * that grant nothing.
 *
 * **The layout, and why this one.** A rule is a SET (`ruleAllows` ORs the
 * atoms), and a set of audiences across five operations is a grid — so this is
 * a grid: audiences down, operations across, one checkbox per intersection.
 * Everything a rule can say is then a click, every role the user has created is
 * a row of its own, and "who can delete from this collection" is answered by
 * reading across instead of by parsing five strings. Collapsed, each collection
 * keeps a one-line summary of all five rules in words, which is strictly more
 * than the text boxes showed.
 *
 * **The three states of a column**, kept distinct because the model keeps them
 * distinct:
 *
 * - *Use default* — no rule of this collection's own; `defaults.permissions`
 *   decides. Drawn as the default's own ticks, dimmed.
 * - *Nobody* — the empty set. It has a row of its own precisely because
 *   Richard had to type the word to get it.
 * - anything else — `Anyone`, `Anyone signed in`, and/or roles.
 *
 * ⚠️ Clicking a grant on a column that is inheriting TAKES THE COLUMN OVER with
 * exactly what was clicked, rather than adding to the default's atoms. The
 * alternative reads worse: with a default of `authenticated`, ticking a role
 * would produce `['authenticated','role:x']`, which the backend evaluates as
 * plain `authenticated` — a click that appears to narrow and does nothing.
 *
 * @module panels/permissions/CollectionPermissions
 */

import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './PermissionsPanel.module.scss';
import {
  CLP_OPS,
  ClpOp,
  RuleSelection,
  RuleValue,
  describeSelection,
  isNobody,
  parseRule,
  redundantRoles,
  roleAtom,
  rolesToOffer,
  selectionToRule,
  withAnyone,
  withInherit,
  withNobody,
  withRole,
  withSignedIn,
  withoutUnknown
} from './ruleVocabulary';

/** Just the shape this control reads — structurally the panel's config. */
export interface CollectionConfigLike {
  defaults: { permissions: Record<ClpOp, RuleValue>; creatorOwns: boolean };
  collections: Record<string, { permissions?: Partial<Record<ClpOp, RuleValue>>; creatorOwns?: boolean }>;
}

export interface CollectionPermissionsProps {
  tables: string[];
  config: CollectionConfigLike | null;
  /** Role names as the backend has them, in `_Role` order. */
  roleNames: string[];
  /** `undefined` removes this operation's rule, so the default decides again. */
  onSetRule: (collection: string, op: ClpOp, rule: RuleValue | undefined) => void;
  onToggleCreatorOwns: (collection: string, next: boolean) => void;
  /** Create a role without leaving the matrix; it becomes a row on reload. */
  onCreateRole: (name: string) => void;
}

/** What a column currently says, and whether it says it for itself. */
interface ColumnState {
  selection: RuleSelection;
  inherited: boolean;
}

function columnState(config: CollectionConfigLike | null, collection: string, op: ClpOp): ColumnState {
  if (!config) return { selection: parseRule(undefined), inherited: true };
  const own = config.collections[collection] && config.collections[collection].permissions?.[op];
  if (own !== undefined) return { selection: parseRule(own), inherited: false };
  return { selection: parseRule(config.defaults.permissions[op]), inherited: true };
}

export function CollectionPermissions({
  tables,
  config,
  roleNames,
  onSetRule,
  onToggleCreatorOwns,
  onCreateRole
}: CollectionPermissionsProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Per collection, because two matrices can be open at once and one shared
  // string would have them typing over each other.
  const [newRoleName, setNewRoleName] = useState<Record<string, string>>({});

  const toggle = (table: string) => setExpanded((state) => ({ ...state, [table]: !state[table] }));

  const addRole = (table: string) => {
    const name = (newRoleName[table] || '').trim();
    if (!name) return;
    onCreateRole(name);
    setNewRoleName((state) => ({ ...state, [table]: '' }));
  };

  return (
    <>
      <Text textType={TextType.Shy} style={{ fontSize: '11px', marginBottom: '10px' }}>
        Who may do what, per collection. Tick as many audiences as you like for an operation — they are ORed, so any
        one of them is enough. <em>Anyone</em> covers everyone by itself, and <em>Nobody</em> is an empty row of ticks,
        so both clear the rest. <em>Use default</em> means this collection has no rule of its own; ticking anything
        else on that operation takes it over with exactly what you tick. An operation whose answer is{' '}
        <em>dimmed and italic</em> is showing the default&apos;s answer, not one of its own.
      </Text>
      {tables.length === 0 && (
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          No collections yet — create one in the Schema panel.
        </Text>
      )}
      {tables.map((table) => {
        const entry = config?.collections[table];
        const creatorOwns = entry?.creatorOwns ?? config?.defaults.creatorOwns ?? true;
        const columns = CLP_OPS.map((op) => columnState(config, table, op));
        const isOpen = !!expanded[table];

        // Every role that must have a row: the ones that exist, plus any a rule
        // here already names. A role can be deleted while a rule still names
        // it, and a control that cannot draw `role:ghost` deletes it silently.
        const roles = rolesToOffer(
          roleNames,
          CLP_OPS.map((op) => selectionToRule(columnState(config, table, op).selection))
        );
        const unknownAtoms: string[] = [];
        for (const column of columns) {
          for (const atom of column.selection.unknown) if (!unknownAtoms.includes(atom)) unknownAtoms.push(atom);
        }
        const hasRedundancy = columns.some((column) => !column.inherited && redundantRoles(column.selection).length > 0);

        /** Write one cell. Exclusions live in `ruleVocabulary`, not here. */
        const set = (op: ClpOp, next: RuleSelection) => onSetRule(table, op, selectionToRule(next));

        return (
          <div key={table} className={css.CollectionRow} data-test={`permission-collection-${table}`}>
            <div className={css.CollectionName}>
              <button
                type="button"
                className={css.Disclosure}
                aria-expanded={isOpen}
                data-test={`permission-expand-${table}`}
                onClick={() => toggle(table)}
              >
                <Icon icon={isOpen ? IconName.CaretDown : IconName.CaretRight} size={IconSize.Tiny} />
                <Text textType={TextType.DefaultContrast}>{table}</Text>
              </button>
              <label className={css.CreatorOwns}>
                <input
                  type="checkbox"
                  checked={creatorOwns}
                  onChange={(e) => onToggleCreatorOwns(table, e.target.checked)}
                />
                <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                  creator-owns
                </Text>
              </label>
            </div>

            {/* The summary strip: all five rules, in words, always visible. */}
            <div className={css.OpGrid}>
              {CLP_OPS.map((op, index) => {
                const column = columns[index];
                return (
                  <button
                    type="button"
                    key={op}
                    className={css.OpSummary}
                    data-inherited={column.inherited ? 'true' : undefined}
                    data-test={`permission-summary-${table}-${op}`}
                    title={`${op}: ${describeSelection(column.selection)}${column.inherited ? ' (the default)' : ''}`}
                    onClick={() => toggle(table)}
                  >
                    <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                      {op}
                    </Text>
                    <span className={css.OpSummaryValue}>{describeSelection(column.selection)}</span>
                  </button>
                );
              })}
            </div>

            {isOpen && (
              <div className={css.Matrix} data-test={`permission-matrix-${table}`}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col" className={css.MatrixCorner}>
                        who may
                      </th>
                      {CLP_OPS.map((op) => (
                        <th scope="col" key={op}>
                          {op}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <MatrixRow
                      label="Use default"
                      hint="no rule of its own"
                      table={table}
                      rowKey="default"
                      checkedFor={(index) => columns[index].inherited}
                      dimmedFor={() => false}
                      onToggle={(op, index) => {
                        if (columns[index].inherited) return; // already the state
                        onSetRule(table, op, undefined);
                      }}
                    />
                    <MatrixRow
                      label="Nobody"
                      hint="not even an admin app user"
                      table={table}
                      rowKey="nobody"
                      checkedFor={(index) => isNobody(columns[index].selection)}
                      dimmedFor={(index) => columns[index].inherited}
                      onToggle={(op, index) => {
                        if (!columns[index].inherited && isNobody(columns[index].selection)) return;
                        set(op, withNobody());
                      }}
                    />
                    <MatrixRow
                      label="Anyone"
                      hint="public — no sign-in at all"
                      table={table}
                      rowKey="public"
                      checkedFor={(index) => columns[index].selection.anyone}
                      dimmedFor={(index) => columns[index].inherited}
                      onToggle={(op, index) => {
                        if (!columns[index].inherited && columns[index].selection.anyone) return;
                        set(op, withAnyone());
                      }}
                    />
                    <MatrixRow
                      label="Anyone signed in"
                      hint="authenticated"
                      table={table}
                      rowKey="authenticated"
                      checkedFor={(index) => columns[index].selection.signedIn}
                      dimmedFor={(index) => columns[index].inherited}
                      onToggle={(op, index) => {
                        const column = columns[index];
                        // Taking over an inherited column means granting what
                        // was clicked, not toggling the default's own tick off.
                        if (column.inherited) set(op, withSignedIn(withNobody(), true));
                        else set(op, withSignedIn(column.selection, !column.selection.signedIn));
                      }}
                    />
                    {roles.map((role) => (
                      <MatrixRow
                        key={role}
                        label={roleAtom(role)}
                        hint={roleNames.includes(role) ? undefined : 'no such role on this backend'}
                        missing={!roleNames.includes(role)}
                        table={table}
                        rowKey={`role-${role}`}
                        checkedFor={(index) => columns[index].selection.roles.includes(role)}
                        dimmedFor={(index) =>
                          columns[index].inherited || redundantRoles(columns[index].selection).includes(role)
                        }
                        titleFor={(index) =>
                          redundantRoles(columns[index].selection).includes(role)
                            ? 'This role changes nothing here — everyone who holds it is already covered.'
                            : undefined
                        }
                        onToggle={(op, index) => {
                          const column = columns[index];
                          if (column.inherited) set(op, withRole(withNobody(), role, true));
                          else set(op, withRole(column.selection, role, !column.selection.roles.includes(role)));
                        }}
                      />
                    ))}
                    {unknownAtoms.map((atom) => (
                      <MatrixRow
                        key={atom}
                        label={atom}
                        hint="this panel does not understand this rule — untick to remove it"
                        missing
                        table={table}
                        rowKey={`unknown-${atom}`}
                        checkedFor={(index) => columns[index].selection.unknown.includes(atom)}
                        dimmedFor={(index) => columns[index].inherited}
                        onToggle={(op, index) => {
                          const column = columns[index];
                          if (column.inherited || !column.selection.unknown.includes(atom)) return;
                          set(op, withoutUnknown(column.selection, atom));
                        }}
                      />
                    ))}
                  </tbody>
                </table>

                <div className={css.MatrixFooter}>
                  <input
                    className={css.MemberInput}
                    placeholder="new role name"
                    value={newRoleName[table] || ''}
                    data-test={`permission-new-role-${table}`}
                    onChange={(e) => setNewRoleName((state) => ({ ...state, [table]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addRole(table)}
                  />
                  <PrimaryButton
                    label="Add role"
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={() => addRole(table)}
                  />
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    a role added here becomes a row on every collection
                  </Text>
                </div>
                {hasRedundancy && (
                  <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                    A dimmed role tick cannot change the answer: <em>Anyone signed in</em> already covers everyone who
                    could hold it.
                  </Text>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

interface MatrixRowProps {
  label: string;
  hint?: string;
  /** Named by a rule but absent from the backend — drawn as a warning. */
  missing?: boolean;
  table: string;
  rowKey: string;
  checkedFor: (index: number) => boolean;
  /** Shown, but not this column's own doing: an inherited or redundant tick. */
  dimmedFor: (index: number) => boolean;
  titleFor?: (index: number) => string | undefined;
  onToggle: (op: ClpOp, index: number) => void;
}

function MatrixRow({ label, hint, missing, table, rowKey, checkedFor, dimmedFor, titleFor, onToggle }: MatrixRowProps) {
  return (
    <tr className={css.MatrixRow} data-missing={missing ? 'true' : undefined}>
      <th scope="row">
        <span className={css.MatrixRowLabel}>
          {missing && <Icon icon={IconName.WarningTriangle} size={IconSize.Tiny} />}
          {label}
        </span>
        {hint && (
          <span className={css.MatrixRowHint} title={hint}>
            {hint}
          </span>
        )}
      </th>
      {CLP_OPS.map((op, index) => (
        <td key={op}>
          <input
            type="checkbox"
            checked={checkedFor(index)}
            data-dimmed={dimmedFor(index) ? 'true' : undefined}
            data-test={`permission-cell-${table}-${op}-${rowKey}`}
            aria-label={`${label} may ${op} in ${table}`}
            title={(titleFor && titleFor(index)) || `${label} may ${op}`}
            onChange={() => onToggle(op, index)}
          />
        </td>
      ))}
    </tr>
  );
}
