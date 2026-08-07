/*
 * NDA-007 §2/§3 live-QA icon sets. Writes two `noodl_modules` icon sets into a project.
 *
 * A sprite set and a font set, so both branches of the picker and both branches of the app renderer
 * are exercised from the *same* manifest mechanism. The font set uses CSS `content` rather than a
 * real font file — the thing under test is the class emission and the stylesheet injection, and a
 * font file would only make the fixture heavier.
 *
 * Note the path conventions, which differ and are pre-existing: `sprite` is module-relative (like
 * `main` and `dependencies`), `browser.stylesheets` is project-relative.
 */
const fs = require('fs');
const path = require('path');

const projectDir = process.argv[2];
if (!projectDir) {
  console.error('usage: node make-iconsets.js "<project dir>"');
  process.exit(1);
}

const write = (relative, contents) => {
  const target = path.join(projectDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  console.log('wrote', relative);
};

write(
  'noodl_modules/qa-sprites/manifest.json',
  JSON.stringify(
    {
      name: 'QA Sprites',
      type: 'iconset',
      iconSource: 'sprite',
      sprite: 'assets/sprite.svg',
      icons: ['qa-house', 'qa-star', 'qa-bolt']
    },
    null,
    2
  )
);

write(
  'noodl_modules/qa-sprites/assets/sprite.svg',
  [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
    '  <symbol id="qa-house" viewBox="0 0 24 24"><path d="M3 12 12 3l9 9v9H3z"/></symbol>',
    '  <symbol id="qa-star" viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></symbol>',
    '  <symbol id="qa-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></symbol>',
    '</svg>',
    ''
  ].join('\n')
);

write(
  'noodl_modules/qa-fontset/manifest.json',
  JSON.stringify(
    {
      name: 'QA Fontset',
      type: 'iconset',
      iconClass: 'qafont',
      codeAsClass: true,
      icons: ['qa-a', 'qa-b'],
      browser: { stylesheets: ['noodl_modules/qa-fontset/assets/qafont.css'] }
    },
    null,
    2
  )
);

write(
  'noodl_modules/qa-fontset/assets/qafont.css',
  ['.qafont { font-family: serif; font-weight: bold; }', ".qafont.qa-a::before { content: 'A'; }", ".qafont.qa-b::before { content: 'B'; }", ''].join(
    '\n'
  )
);
