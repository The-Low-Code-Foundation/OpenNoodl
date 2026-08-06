/**
 * SPR-005 — one create menu, and it says where the thing will land.
 *
 * F83: the person who commissioned the cloud function runtime could not find
 * cloud function authoring in the editor. The feature was never missing; the
 * *door* was. Two things were true at once:
 *
 *  1. The only way to reach `CloudFunctionComponentTemplate` was a right-click
 *     on empty space, on a sheet you had to have switched to already.
 *  2. On every other sheet the option was **hidden** rather than explained, so
 *     a user right-clicking in a browser folder saw a menu that quietly implied
 *     cloud functions do not exist.
 *
 * Both are answered here, in one module, because four surfaces build this menu
 * — the panel's empty space, a folder row, a component row, and the canvas
 * trail's "+" — and four surfaces that each decide what a create menu offers
 * are four surfaces that can disagree. `WorkflowDocument` learned the same
 * lesson about `plannedFunctionForStep`.
 *
 * ## The rule this module adds
 *
 * `ComponentTemplates.getTemplates` filters by `parentTypes` and `runtimeTypes`,
 * and that filtering is correct — a cloud component created in a browser folder
 * really would land in the wrong sheet. What it cannot do is *say so*. So the
 * filter stays exactly as it is, and this module puts the filtered-out cloud
 * template back as a **disabled row carrying the reason**. Telling someone why
 * an option is unavailable is strictly better than silently offering less; it is
 * also the only version of this menu from which a first-time user can learn that
 * cloud functions exist at all.
 *
 * ## Naming is not decided here
 *
 * Phase 43 owns whether "cloud function" and "workflow" survive as terms
 * (`dev-docs/tasks/phase-43-backend-authoring-clarity/README.md` §6). Every
 * string below uses the vocabulary
 * `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` mandates today, and none of
 * them argues about it.
 *
 * @module noodl-editor/views/panels/ComponentsPanelNew/createMenu
 */

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { MenuDialogItem } from '@noodl-core-ui/components/popups/MenuDialog';

import { ComponentTemplates } from './ComponentTemplates';
import { CLOUD_SHEET } from './types';

/** Which runtime the surrounding sheet authors for — `ComponentTree`'s prop. */
export type CreateRuntimeType = 'browser' | 'cloud';

/** The label `CloudFunctionComponentTemplate` carries, for the disabled stand-in. */
export const CLOUD_TEMPLATE_LABEL = 'Cloud Function Component';

/** The sheet a component lands in when no sheet is selected (the "All" view). */
export const DEFAULT_SHEET_NAME = 'Default';

export interface CreateContext {
  /**
   * `'folder'` for empty space and folder rows, `'component'` for nesting
   * inside a component. The same value `getTemplates` is filtered by, so the
   * templates' own `parentTypes` declarations stay load-bearing.
   */
  forParentType: 'folder' | 'component';
  /** `'cloud'` only on the Cloud Functions sheet. */
  runtimeType: CreateRuntimeType;
  /**
   * Display name of the sheet in force. Omitted means the "All" view, where a
   * new component lands in the Default sheet — which is exactly the fact this
   * menu exists to state, so the omission resolves to `Default` rather than to
   * "somewhere".
   */
  sheetName?: string;
  /**
   * Display path of the folder or component that will hold the new thing, as
   * the tree hands it out (sheet prefix already stripped). Undefined for the
   * root of the current sheet.
   */
  parentPath?: string;
}

export interface CreateHandlers {
  onAddComponent: (template: TSFixme, parentPath?: string) => void;
  /** Omit to leave "Create Folder" off the menu — the canvas trail has no folders. */
  onAddFolder?: (parentPath?: string) => void;
}

/**
 * Where a thing created from this menu will end up, in words a user can check
 * against the tree in front of them: `Cloud Functions`, `Default / Screens`.
 *
 * Folder segments are joined with the same ` / ` the component trail uses, so
 * the two surfaces read alike.
 */
export function destinationLabel({ sheetName, parentPath }: Pick<CreateContext, 'sheetName' | 'parentPath'>): string {
  const sheet = sheetName || DEFAULT_SHEET_NAME;
  const folders = String(parentPath || '')
    .split('/')
    .filter(Boolean);
  return folders.length ? `${sheet} / ${folders.join(' / ')}` : sheet;
}

/** The menu's title row. The whole point of scope item 3 is this one string. */
export function createMenuTitle(context: Pick<CreateContext, 'sheetName' | 'parentPath'>): string {
  return `New in ${destinationLabel(context)}`;
}

/**
 * Why the cloud function template is not on offer here, or `null` when it is.
 *
 * The two answers mirror `CloudFunctionComponentTemplate`'s own declarations
 * (`runtimeTypes: ['cloud']`, `parentTypes: ['folder']`) rather than restating a
 * policy of their own — if that template's declarations change, this goes quiet
 * on its own and the enabled row appears instead.
 *
 * The nesting reason ranks first because it is true on every sheet: a function
 * inside a component is unaddressable regardless of which runtime you are in.
 */
export function cloudFunctionUnavailableReason(
  context: Pick<CreateContext, 'forParentType' | 'runtimeType'>
): string | null {
  if (context.forParentType === 'component') {
    return (
      `A cloud function is addressed by your backend as POST /functions/<name>, so it cannot live inside ` +
      `another component. Create it at the top level of the ${CLOUD_SHEET.displayName} sheet.`
    );
  }

  if (context.runtimeType !== 'cloud') {
    return (
      `Cloud functions run on your backend, not in the browser, so they live on their own sheet. ` +
      `Choose "${CLOUD_SHEET.displayName}" in the sheet selector at the top of the Components panel, ` +
      `then create one there.`
    );
  }

  return null;
}

/**
 * The short version of the reason, for the row's end slot — the part a user
 * reads without hovering.
 */
function cloudUnavailableHint(context: Pick<CreateContext, 'forParentType' | 'runtimeType'>): string {
  return context.forParentType === 'component' ? 'Top level only' : `${CLOUD_SHEET.displayName} sheet`;
}

/**
 * The menu, for every surface that offers one.
 *
 * Enabled rows are exactly what `getTemplates` returns, in its order and with
 * its labels — this adds nothing to what can be created and removes nothing.
 * The only new row is the disabled cloud one, and it appears only when the
 * filter has just removed the real one.
 */
export function buildCreateMenuItems(
  context: CreateContext,
  { onAddComponent, onAddFolder }: CreateHandlers
): (MenuDialogItem | 'divider')[] {
  const templates = ComponentTemplates.instance.getTemplates({
    forParentType: context.forParentType,
    forRuntimeType: context.runtimeType
  });

  const items: (MenuDialogItem | 'divider')[] = templates.map((template) => ({
    icon: template.icon,
    label: `Create ${template.label}`,
    onClick: () => onAddComponent(template, context.parentPath),
    testId: `create-${template.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  }));

  const blocked = cloudFunctionUnavailableReason(context);
  if (blocked) {
    items.push({
      icon: IconName.CloudFunction,
      label: `Create ${CLOUD_TEMPLATE_LABEL}`,
      // `isDisabled`, not `disabled`: MenuDialog reads the former and ignores
      // the latter, which is how "Make Home" on the home component has been
      // rendering enabled all along.
      isDisabled: true,
      endSlot: cloudUnavailableHint(context),
      tooltip: blocked,
      tooltipShowAfterMs: 0,
      testId: 'create-cloud-function-unavailable'
    });
  }

  if (onAddFolder) {
    items.push('divider');
    items.push({
      icon: IconName.FolderClosed,
      label: 'Create Folder',
      onClick: () => onAddFolder(context.parentPath),
      testId: 'create-folder'
    });
  }

  return items;
}
