/**
 * CN-015 (s28) — the capture preamble RUN, not string-matched.
 *
 * 🔴 **Why a second file rather than more assertions in `inject.test.js`.** Every
 * existing capture test asserts the emitted *text*, and that block's own comment
 * concedes the limit: *"a string assertion cannot show that an event fires"*. It
 * was left to a Chromium drive, which means the guard has no gate — and CN-015's
 * trap list says in as many words that a guard nobody has seen fail is a guard
 * nobody has seen.
 *
 * The preamble only ever touches `window`, so it does not need a DOM: executing
 * it with a fake `window` as a parameter is the real code path, not a
 * re-implementation of it. What it cannot show is that a *browser* dispatches
 * these events with these shapes — that stays measured in Chromium, and the
 * event objects below are the shapes s23 recorded there.
 *
 * What s27 measured and this pins: a kit with a syntax error printed
 * `SyntaxError: Unexpected identifier 'Noodl'` and named **neither the kit nor
 * the file**, so with four kits installed the author could not tell which to
 * open.
 */
const { buildInjectionTags } = require('../src/index.js');

/** The preamble's own source, taken from the tags rather than re-declared. */
function preambleSource() {
  const { modulesMain } = buildInjectionTags(
    [{ dependencies: [], runtimes: ['browser'], name: 'Rename Kit', index: 'noodl_modules/rename-kit/index.js' }],
    '/'
  );
  const open = modulesMain.indexOf('<script type="text/javascript">(function(){');
  const close = modulesMain.indexOf('</script>', open);
  expect(open).toBeGreaterThanOrEqual(0);
  return modulesMain.slice(open + '<script type="text/javascript">'.length, close);
}

/** A `window` with just the surface the preamble uses. */
function fakeWindow(moduleName) {
  const errors = [];
  const win = {
    __noodl_module_name: moduleName,
    console: { error: (line) => errors.push(line) },
    listeners: [],
    errors,
    addEventListener(type, handler, capture) {
      this.listeners.push({ type, handler, capture });
    },
    dispatch(event) {
      for (const l of this.listeners) if (l.type === 'error') l.handler(event);
    }
  };
  // eslint-disable-next-line no-new-func
  new Function('window', preambleSource())(win);
  return win;
}

describe('the capture preamble, executed (CN-015)', () => {
  it('names the kit and the file in the console when a kit throws', () => {
    const win = fakeWindow('Rename Kit');

    // The shape Chromium dispatches for a parse error in a classic script.
    win.dispatch({
      target: win,
      message: "Unexpected identifier 'Noodl'",
      filename: 'http://localhost:8574/noodl_modules/rename-kit/index.js'
    });

    expect(win.errors).toHaveLength(1);
    // 🔴 The whole point: both facts s27 found missing, in one line.
    expect(win.errors[0]).toContain('Rename Kit');
    expect(win.errors[0]).toContain('noodl_modules/rename-kit/index.js');
    expect(win.errors[0]).toContain("Unexpected identifier 'Noodl'");
  });

  it('carries the file into the captured record, not only the console', () => {
    // The record is what reaches Settings → Kits, so the file has to be in both
    // or the panel goes on naming a kit without saying which file to open.
    const win = fakeWindow('Rename Kit');
    win.dispatch({ target: win, message: 'boom', filename: '/noodl_modules/rename-kit/index.js' });

    expect(win.__noodl_module_failures).toHaveLength(1);
    expect(win.__noodl_module_failures[0].module).toBe('Rename Kit');
    expect(win.__noodl_module_failures[0].reason).toBe('threw');
    expect(win.__noodl_module_failures[0].message).toContain('/noodl_modules/rename-kit/index.js');
  });

  it('names the kit and the script for a 404, from the element', () => {
    // ⚠️ A resource error puts the URL on the ELEMENT and has no `filename`.
    // Reading `e.filename` alone would leave this case unnamed.
    const win = fakeWindow('Grow Kit');
    win.dispatch({ target: { tagName: 'SCRIPT', src: 'http://localhost:8574/noodl_modules/grow-kit/index.js' } });

    expect(win.__noodl_module_failures[0].reason).toBe('script-not-loaded');
    expect(win.errors[0]).toContain('Grow Kit');
    expect(win.errors[0]).toContain('noodl_modules/grow-kit/index.js');
  });

  it('degrades to naming the kit when the browser gives no filename', () => {
    const win = fakeWindow('Cashflow Kit');
    win.dispatch({ target: win, message: 'boom' });

    expect(win.errors[0]).toContain('Cashflow Kit');
    expect(win.errors[0]).toContain('boom');
    // No invented file, and no dangling "(in )".
    expect(win.errors[0]).not.toContain('(in ');
  });

  it('says nothing once the kits have finished loading', () => {
    // 🔴 The control, and the one that would fire on good input if it were
    // wrong: without the bound, the LAST kit is blamed for every runtime error
    // the app throws afterwards — a check that accuses a healthy kit is worse
    // than no check at all (CN-015 AC5).
    const win = fakeWindow('Rename Kit');
    win.__noodl_module_loading = false;

    win.dispatch({ target: win, message: 'an ordinary app error, long after load' });

    expect(win.errors).toHaveLength(0);
    expect(win.__noodl_module_failures).toHaveLength(0);
  });

  it('says nothing for an error with no kit in scope', () => {
    const win = fakeWindow(undefined);
    win.dispatch({ target: win, message: 'boom' });

    expect(win.errors).toHaveLength(0);
    expect(win.__noodl_module_failures).toHaveLength(0);
  });
});
