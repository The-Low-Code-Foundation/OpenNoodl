import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { isComponentModel_BrowserRuntime } from '@noodl-utils/NodeGraph';

import { resolveFirstOpenComponent } from './template/firstOpenComponent';

export function getDefaultComponent(instance = ProjectModel.instance): ComponentModel {
  // SBR-002: a template may name the component a new project should land on
  // (`ProjectTemplate.initialOpenComponent`, written into project metadata at
  // install). It is read HERE — inside the decider `useSwitchToDefaultComponent`
  // calls unconditionally — because anything layered before that switch loses
  // to it (launcherHandoff.ts records the deleted attempt). A returning user's
  // persisted `selectedComponentName` is applied after this and still wins.
  const hinted = resolveFirstOpenComponent(instance);
  if (hinted) return hinted;

  let component =
    instance.getComponentWithName('/Main') ||
    instance.getComponentWithName('/Start') ||
    instance.getComponentWithName('/Lesson');

  if (!component) {
    component = instance.getRootComponent();
  }

  if (!component) {
    component = instance.getComponents().find(isComponentModel_BrowserRuntime);
  }

  return component;
}
