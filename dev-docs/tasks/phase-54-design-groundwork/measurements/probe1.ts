import { checkParameterValues } from '../../../../packages/noodl-editor/src/editor/src/validation/parameterValues';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';

const catalog = loadDefaultCatalog();
const nodes = [
  { id: 'img1', type: 'Image', parameters: { src: 'x.png', width: { value: 100, unit: '%' }, height: { value: 240, unit: 'px' }, objectFit: 'cover' } },
  { id: 'img2', type: 'Image', parameters: { src: 'x.png', sizeMode: 'explicit', width: { value: 100, unit: '%' }, height: { value: 240, unit: 'px' }, objectFit: 'cover' } },
  { id: 'img3', type: 'Image', parameters: { src: 'x.png' } },
  { id: 'txt1', type: 'Text', parameters: { text: 'hi', width: { value: 50, unit: '%' }, height: { value: 20, unit: 'px' } } },
  { id: 'btn1', type: 'net.noodl.controls.button', parameters: { label: 'Go', width: { value: 200, unit: 'px' } } }
];
for (const d of checkParameterValues(nodes as never, catalog, { component: '/Test' })) {
  console.log(d.severity, '|', d.code, '|', d.location.nodeId, d.location.port, '::', d.message);
}
