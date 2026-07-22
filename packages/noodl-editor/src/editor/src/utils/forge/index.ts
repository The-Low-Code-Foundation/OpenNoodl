import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';

import { EmbeddedTemplateProvider } from '../../models/template/EmbeddedTemplateProvider';
import { HttpTemplateProvider } from './template/providers/http-template-provider';
import { NoodlDocsTemplateProvider } from './template/providers/noodl-docs-template-provider';
import { TemplateRegistry } from './template/template-registry';

// The order of the providers matters,
// when looking for a template it will take the first one that allows it.
// EmbeddedTemplateProvider is first as it provides built-in templates that work reliably.
const templateRegistry = new TemplateRegistry([
  new EmbeddedTemplateProvider(),
  new NoodlDocsTemplateProvider(getDocsEndpoint),
  new HttpTemplateProvider()
]);

export { templateRegistry };
