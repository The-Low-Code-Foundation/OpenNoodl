/**
 * SPR-005 — the create menu says what it offers, and why it doesn't offer the rest.
 *
 * F83's mechanism was that `ComponentTemplates.getTemplates` filters the cloud
 * template out of every menu except one, and says nothing when it does. These
 * specs pin the two halves of the fix that a screenshot cannot: that the
 * enabled rows are still exactly what the templates declare (nothing was added
 * to what can be created), and that the row put back in their place is really
 * disabled and really carries a reason.
 *
 * Jasmine, not Jest. `createMenu` imports `ComponentTemplates`, which imports
 * React and `PopupLayer`, so the plain-Node runner in `tests-unit/` refuses it —
 * that boundary working, not a problem to route around.
 */

import { MenuDialogItem } from '@noodl-core-ui/components/popups/MenuDialog';

import { ComponentTemplates } from '../../src/editor/src/views/panels/ComponentsPanelNew/ComponentTemplates';
import {
  buildCreateMenuItems,
  cloudFunctionUnavailableReason,
  CLOUD_TEMPLATE_LABEL,
  createMenuTitle,
  destinationLabel
} from '../../src/editor/src/views/panels/ComponentsPanelNew/createMenu';
import { CLOUD_SHEET } from '../../src/editor/src/views/panels/ComponentsPanelNew/types';

const NOOP = { onAddComponent: () => undefined, onAddFolder: () => undefined };

function rows(items: (MenuDialogItem | 'divider')[]): MenuDialogItem[] {
  return items.filter((i): i is MenuDialogItem => i !== 'divider');
}

function labelled(items: (MenuDialogItem | 'divider')[], label: string): MenuDialogItem | undefined {
  return rows(items).find((i) => i.label === label);
}

describe('SPR-005 — where a new component will land', () => {
  it('names the sheet when there is no folder', () => {
    expect(destinationLabel({ sheetName: CLOUD_SHEET.displayName })).toBe('Cloud Functions');
  });

  it('falls back to Default, because that is where the "All" view really puts things', () => {
    // Not "somewhere" and not the empty string: with no sheet selected
    // `sheetPrefix` is '' and a new component is named `/Name`, i.e. the
    // Default sheet. Stating it is the whole of scope item 3.
    expect(destinationLabel({})).toBe('Default');
  });

  it('appends the folder path, in the trail\'s own separator', () => {
    expect(destinationLabel({ sheetName: 'Pages', parentPath: '/Screens/Admin/' })).toBe('Pages / Screens / Admin');
  });

  it('is what the menu title says', () => {
    expect(createMenuTitle({ sheetName: 'Pages' })).toBe('New in Pages');
  });
});

describe('SPR-005 — why the cloud function template is not on offer', () => {
  it('is on offer at the root of the cloud sheet, and says nothing', () => {
    expect(cloudFunctionUnavailableReason({ forParentType: 'folder', runtimeType: 'cloud' })).toBeNull();
  });

  it('names the sheet to switch to when you are on a browser one', () => {
    const reason = cloudFunctionUnavailableReason({ forParentType: 'folder', runtimeType: 'browser' });
    expect(reason).toContain(CLOUD_SHEET.displayName);
    expect(reason).toContain('sheet selector');
  });

  it('explains the nesting rule from the route it protects', () => {
    // The reason a function cannot be nested is that the backend addresses it
    // as a single path segment. A message that only said "not allowed here"
    // would leave the author with nowhere to go.
    const reason = cloudFunctionUnavailableReason({ forParentType: 'component', runtimeType: 'cloud' });
    expect(reason).toContain('/functions/<name>');
  });

  it('ranks the nesting rule above the sheet rule — it is true on every sheet', () => {
    const reason = cloudFunctionUnavailableReason({ forParentType: 'component', runtimeType: 'browser' });
    expect(reason).toContain('/functions/<name>');
  });
});

describe('SPR-005 — the create menu itself', () => {
  it('offers exactly the templates, in their order, with their labels', () => {
    // The builder must not become a second declaration of what can be created:
    // if it ever disagrees with `getTemplates`, the panel and the canvas trail
    // start offering different things.
    const templates = ComponentTemplates.instance.getTemplates({
      forParentType: 'folder',
      forRuntimeType: 'browser'
    });
    const items = buildCreateMenuItems({ forParentType: 'folder', runtimeType: 'browser' }, NOOP);
    const enabled = rows(items).filter((i) => !i.isDisabled && i.label !== 'Create Folder');

    expect(enabled.map((i) => i.label)).toEqual(templates.map((t) => `Create ${t.label}`));
  });

  it('offers the cloud function template, enabled, at the root of the cloud sheet', () => {
    const items = buildCreateMenuItems(
      { forParentType: 'folder', runtimeType: 'cloud', sheetName: CLOUD_SHEET.displayName },
      NOOP
    );
    const item = labelled(items, `Create ${CLOUD_TEMPLATE_LABEL}`);

    expect(item).toBeDefined();
    expect(item.isDisabled).toBeFalsy();
    expect(typeof item.onClick).toBe('function');
  });

  it('puts it back as a disabled row on a browser sheet, rather than hiding it', () => {
    const items = buildCreateMenuItems({ forParentType: 'folder', runtimeType: 'browser' }, NOOP);
    const item = labelled(items, `Create ${CLOUD_TEMPLATE_LABEL}`);

    expect(item).toBeDefined();
    // `isDisabled` is the key `MenuDialog` reads. `disabled` is inert there, and
    // a row that looks disabled but fires is worse than no row at all.
    expect(item.isDisabled).toBe(true);
    expect(item.onClick).toBeUndefined();
    expect(item.tooltip).toContain(CLOUD_SHEET.displayName);
  });

  it('never offers it twice', () => {
    const cloud = buildCreateMenuItems({ forParentType: 'folder', runtimeType: 'cloud' }, NOOP);
    const matches = rows(cloud).filter((i) => i.label === `Create ${CLOUD_TEMPLATE_LABEL}`);
    expect(matches.length).toBe(1);
  });

  it('leaves the folder row off when there is nowhere to put a folder', () => {
    // The canvas trail's "+" passes no `onAddFolder`.
    const items = buildCreateMenuItems({ forParentType: 'folder', runtimeType: 'browser' }, {
      onAddComponent: () => undefined
    });
    expect(labelled(items, 'Create Folder')).toBeUndefined();
  });

  it('creates into the parent path it was given', () => {
    const created: { label: string; parentPath?: string }[] = [];
    const items = buildCreateMenuItems(
      { forParentType: 'folder', runtimeType: 'cloud', parentPath: '/Orders' },
      { onAddComponent: (template, parentPath) => created.push({ label: template.label, parentPath }) }
    );

    labelled(items, `Create ${CLOUD_TEMPLATE_LABEL}`).onClick(null as TSFixme);
    expect(created).toEqual([{ label: CLOUD_TEMPLATE_LABEL, parentPath: '/Orders' }]);
  });
});

describe('SPR-005 — the two doors onto a new cloud function agree', () => {
  it('is the same template object the workflow-step gesture uses', () => {
    // `WorkflowDocument.createFunctionFromStep` reaches for
    // `ComponentTemplates.instance.cloudFunction`. If the panel's menu ever
    // offered a different template, the two doors would produce two different
    // shapes of "new cloud function".
    const items = buildCreateMenuItems({ forParentType: 'folder', runtimeType: 'cloud' }, NOOP);
    const item = labelled(items, `Create ${CLOUD_TEMPLATE_LABEL}`);

    expect(item.label).toBe(`Create ${ComponentTemplates.instance.cloudFunction.label}`);
    expect(item.icon).toBe(ComponentTemplates.instance.cloudFunction.icon);
  });

  it('lands in the same sheet the workflow-step gesture lands in', () => {
    // The panel prefixes with the selected sheet's folder name; the gesture
    // prefixes with `CLOUD_COMPONENT_PREFIX`. Both are `/#__cloud__/`, and this
    // is the one place that equality is written down.
    expect('/' + CLOUD_SHEET.folderName + '/').toBe(CLOUD_SHEET.pathPrefix);
  });

  it('holds a typed name to the rule the gesture mints by', () => {
    // `planFunctionFromStep` will only ever mint a name matching
    // FUNCTION_NAME_RE. Before SPR-005 the panel accepted anything, so the two
    // doors could produce functions of which only one was addressable.
    const cloud = ComponentTemplates.instance.cloudFunction;

    expect(cloud.validateLocalName('chargeCard')).toBeNull();
    expect(cloud.validateLocalName('_private-fn2')).toBeNull();

    expect(cloud.validateLocalName('Charge card')).toContain('/functions/');
    expect(cloud.validateLocalName('2fa')).toBeTruthy();
    expect(cloud.validateLocalName('a,b')).toBeTruthy();
  });

  it('holds nothing else to it — a visual component may be called anything', () => {
    const visual = ComponentTemplates.instance
      .getTemplates({ forParentType: 'folder', forRuntimeType: 'browser' })
      .find((t) => t.label === 'Visual Component');

    expect(visual.validateLocalName('My Card!')).toBeNull();
  });

  it('asks for the name it actually wants', () => {
    // F26's argument one level up: "New component name / e.g. ProductCard" is
    // the wrong question to put in front of someone naming an HTTP endpoint.
    const cloud = ComponentTemplates.instance.cloudFunction;
    expect(cloud.promptLabel).toBe('New cloud function name');
    expect(cloud.promptPlaceholder).toBe('e.g. chargeCard');
  });
});
