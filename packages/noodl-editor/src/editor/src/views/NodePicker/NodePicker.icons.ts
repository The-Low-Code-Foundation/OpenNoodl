/**
 * Glyphs for node cards (UIX-013).
 *
 * The mapping is the same hardcoded switch that has always driven the picker's
 * icons (it lived in `noodl-core-ui`'s `EditorNode`, which the references panel
 * and the property editor still use — it is left alone there). Only a handful
 * of node types have an icon, which is an iconography problem rather than a
 * picker one: filed as a follow-up, and until then a card with no icon falls
 * back to a tinted letter rather than an empty square (see `NodePickerCard`).
 */
import { IconName } from '@noodl-core-ui/components/common/Icon';

const NODE_ICONS: Record<string, IconName> = {
  Group: IconName.Group,
  Text: IconName.TextInBox,
  Image: IconName.Image,
  Video: IconName.Video,
  Circle: IconName.CircleOpen,
  'Radio Button Group': IconName.RadiobuttonGroup,
  'net.noodl.visual.icon': IconName.Icon,
  'net.noodl.visual.columns': IconName.Columns,
  'net.noodl.controls.button': IconName.Button,
  'net.noodl.controls.checkbox': IconName.CheckboxFilled,
  'net.noodl.controls.options': IconName.DropdownLines,
  'net.noodl.controls.radiobutton': IconName.Radiobutton,
  'net.noodl.controls.range': IconName.SlidersFilled,
  'net.noodl.controls.textinput': IconName.TextInput
};

export function nodeIconName(nodeName: string): IconName | null {
  return NODE_ICONS[nodeName] ?? null;
}
