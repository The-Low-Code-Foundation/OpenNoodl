/**
 * Minimal CDP driver for a headless Chrome, independent of the editor's cdp.js
 * (which only knows the editor/viewer targets on 9222 and would collide with a
 * worker's editor session).
 *
 * usage: node browse.mjs <url> <ms-to-wait> [<expression>]
 */
const [, , URL_ARG, WAIT = '6000', EXPR] = process.argv;
const PORT = process.env.CDP_PORT || 9333;

async function json(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return r.json();
}

const targets = await json('/json/list');
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res) => (ws.onopen = res));

let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + (m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text));
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');

const requests = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Network.requestWillBeSent') requests.push({url: m.params.request.url, method: m.params.request.method, headers: m.params.request.headers});
});

await send('Page.navigate', { url: URL_ARG });
await new Promise((r) => setTimeout(r, Number(WAIT)));

const expr =
  EXPR ||
  `JSON.stringify({
     title: document.title,
     bodyText: document.body.innerText,
     divCount: document.querySelectorAll('div').length
   })`;
const out = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });

console.log('RESULT ' + JSON.stringify(out.result?.result?.value ?? out.result));
if (logs.length) console.log('CONSOLE\n' + logs.join('\n'));
console.log('REQUESTS\n' + JSON.stringify(requests.filter((r) => !r.url.startsWith('data:')), null, 1));
ws.close();
process.exit(0);
