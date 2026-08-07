// Design tokens — canonical source lives in noodl-core-ui (UIX-001)
import '@noodl-core-ui/styles/custom-properties/animations.css';
import '@noodl-core-ui/styles/custom-properties/fonts.css';
import '@noodl-core-ui/styles/custom-properties/colors.css';
import '@noodl-core-ui/styles/custom-properties/spacing.css';
import PopupLayer from '../../editor/src/views/popuplayer';
import Viewer from './src/views/viewer';

Viewer.instance = new Viewer();
Viewer.instance.render();
document.body.appendChild(Viewer.instance.el);

//add popup and dialog layers for the right click inspect menu to work
PopupLayer.instance = new PopupLayer();
document.body.appendChild(PopupLayer.instance.render());

const dialogLayer = document.createElement('div');
dialogLayer.classList.add('dialog-layer');
document.body.appendChild(dialogLayer);
