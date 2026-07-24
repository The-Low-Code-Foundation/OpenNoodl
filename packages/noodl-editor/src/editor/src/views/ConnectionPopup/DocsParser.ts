import { Remarkable } from 'remarkable';

import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';

// Fetch and parse out documentation for inputs and outputs
const _pages = {};

/** GET a document as text. Resolves to `{ status }` only on a non-2xx or network error. */
async function fetchText(url: string): Promise<{ text?: string; status?: number }> {
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!response.ok) return { status: response.status };
    return { text: await response.text() };
  } catch (error) {
    console.warn(error);
    return {};
  }
}

class DocsParser {
  baseUrl: URL;
  md: Remarkable;

  constructor() {
    this.md = new Remarkable({
      html: true,
      breaks: true
    });
  }

  getDocsForType(type, cb) {
    let docsUrl = type.docs.replace('#/', ''); // + '-short.md';

    if (!docsUrl.endsWith('.md')) docsUrl = docsUrl += '.md';

    // Update no version tag with version tag (and potentially switch to local docs)
    docsUrl = docsUrl.replace('https://docs.noodl.net', getDocsEndpoint());

    if (docsUrl.includes('localhost:3000') === false) {
      // See if the page is in the cache
      if (_pages[docsUrl] !== undefined) return cb(_pages[docsUrl]);
    }

    this.fetchPage(docsUrl, (md) => {
      if (!md) return;

      const page = {
        inputs: {},
        outputs: {}
      };

      // Find all input and output references
      const inputMatches = md.matchAll(/{\*\/##input:([A-Za-z0-9\s\.\*\-]+)##\*\\}(.*?){\*\/##input##\*\\}/g);
      for (const _s of inputMatches) {
        const inputName = _s[1];
        if (inputName === undefined) continue;

        const docs = _s[2];
        page.inputs[inputName] = this.md.render(docs);
      }

      const outputMatches = md.matchAll(/{\*\/##output:([A-Za-z0-9\s\.\*\-]+)##\*\\}(.*?){\*\/##output##\*\\}/g);
      for (const _s of outputMatches) {
        const outputName = _s[1];
        if (outputName === undefined) continue;

        const docs = _s[2];
        page.outputs[outputName] = this.md.render(docs);
      }

      _pages[docsUrl] = page;
      cb(page);
    });
  }

  async fetchPage(url: string, callback) {
    this.baseUrl = new URL(url);

    const page = await fetchText(url);
    let md = page.text;
    if (md === undefined) {
      // Access denied stays silent and never calls back, as the jQuery version did
      if (page.status !== 401) callback();
      return;
    }

    // Find all filename references
    const refs = [];
    for (const m of md.matchAll(/\[filename\]\((.*?)':include'\)/g)) {
      const ref = m[1];
      if (ref !== undefined) {
        refs.push({ anchor: m[0], url: new URL(ref.trim(), url).href });
      }
    }

    const included = await Promise.all(refs.map((ref) => fetchText(ref.url)));
    refs.forEach((ref, index) => {
      // Ignore the ones that failed, as the callback version did
      if (included[index].text !== undefined) {
        md = md.replace(ref.anchor, included[index].text);
      }
    });

    callback(md);
  }
}

const docsParser = new DocsParser();
export { docsParser };
