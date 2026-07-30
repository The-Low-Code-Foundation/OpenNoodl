import React from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { iconValueForGlyph } from '../../../../../shared/utils/iconsets';
import Tooltip from '../../../reactcomponents/tooltip';
import { IconGlyphPreview, ensureFontStylesheets, ensureSpriteSheet } from './components/IconGlyphPreview';

// Styles
require('../../../styles/propertyeditor/iconpicker.css');

class IconPicker extends React.Component {
  constructor(props) {
    super(props);

    this.value = props.value || props.default;
    this.default = props.default;

    this.state = {
      iconSets: []
    };
  }

  componentDidMount() {
    // Look for icon modules
    IconPicker.LoadIconSets((iconSets) => {
      this.setState({
        iconSets: iconSets
      });
    });
  }

  componentWillUnmount() {}

  onIconClicked(iconSet, icon) {
    // NDA-007 §2/§3: the value is whatever kind the set is, built in one place. The font branch is
    // byte-identical to what this used to construct inline.
    this.props.onIconSelected && this.props.onIconSelected(iconValueForGlyph(iconSet, icon));
  }

  renderIconSet(set) {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'hidden',
          paddingLeft: '12px',
          paddingTop: '12px',
          paddingBottom: '12px'
        }}
      >
        {set.icons
          .filter((icon) => this.state.filter === undefined || icon.indexOf(this.state.filter) !== -1)
          .map((icon) => (
            <span className="iconpicker-icon" key={set.moduleName + '/' + icon} onClick={() => this.onIconClicked(set, icon)}>
              <Tooltip text={icon}>
                <IconGlyphPreview value={iconValueForGlyph(set, icon)} size={20} />
              </Tooltip>
            </span>
          ))}
        {/* Add some space at the bottom to allow the Tooltip to expand */}
        <div style={{ width: '100%', height: '32px' }}></div>
      </div>
    );
  }

  renderIconSets() {
    return (
      <div style={{ overflowY: 'overlay' }}>
        {this.state.iconSets.map((set) => (
          <div
            key={set.moduleName}
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}
          >
            <div className="iconpicker-iconset-header" style={{ marginTop: '2px', marginBottom: '2px' }}>
              <span className="iconpicker-label">{set.name} </span>
            </div>
            <div>{this.renderIconSet(set)}</div>
          </div>
        ))}
      </div>
    );
  }

  onSearchChanged(ev) {
    this.setState({
      filter: ev.target.value.toLowerCase()
    });
  }

  render() {
    return (
      <div
        className="iconpicker-bg"
        style={{
          width: '470px',
          height: '370px',
          margin: '0px',
          padding: '0px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div className="iconpicker-header">
          <span className="iconpicker-label">Icon picker</span>
        </div>
        <div
          className="iconpicker-search-header"
          style={{ display: 'flex', paddingRight: '5px', paddingTop: '5px', paddingBottom: '3px' }}
        >
          <div style={{ flexGrow: 0, width: '35px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <i style={{ verticalAlign: 'middle', margin: '0 auto' }} className="fa fa-search search-icon" />
          </div>

          <input
            className="iconpicker-search-input"
            style={{ width: '100%', height: '26px' }}
            onChange={this.onSearchChanged.bind(this)}
          ></input>
        </div>

        {this.renderIconSets()}
      </div>
    );
  }
}

/**
 * Load every installed icon set and make it renderable *in the editor document*.
 *
 * Two different jobs, and they are different per kind — which is the whole point of NDA-007 §2. A
 * **font** set needs its stylesheet in this document before a glyph can be drawn, which is what
 * this function has always done. A **sprite** set needs its sheet inlined into this document
 * instead, because an external `<use href>` is a cross-origin reference from a `file://` page and
 * Chromium refuses it — the preview would be silently blank. Neither is needed by the app: a
 * sprite value is self-describing and a font set's stylesheet is injected by
 * `projectmodules.injectIntoHtml`, from the same manifest.
 *
 * Still called for its side effect by `IconType.render()` (so a thumbnail can draw before the
 * picker is ever opened), which is why the loading is here rather than in the component.
 */
IconPicker.LoadIconSets = function (cb) {
  ProjectModel.instance.listIconSets((iconSets) => {
    const projectDirectory = ProjectModel.instance._retainedProjectDirectory;

    // Awaited, not fired and forgotten. A `<use href="#id">` whose target is not in the document
    // yet renders *nothing* and does not retry when it arrives, so calling back before the sheets
    // are installed shows a grid of blank cells that only fills in on the next unrelated re-render.
    Promise.all(
      iconSets.map((set) =>
        set.kind === 'sprite' ? ensureSpriteSheet(set, projectDirectory) : ensureFontStylesheets(set, projectDirectory)
      )
    ).then(() => cb(iconSets));
  });
};

export default IconPicker;
