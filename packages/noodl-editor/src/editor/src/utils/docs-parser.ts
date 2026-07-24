import highlight from 'highlight.js';
import { Remarkable } from 'remarkable';

const getDocsEndpoint = require('../utils/getDocsEndpoint').default;

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

export class DocsParser {
  baseUrl: URL;

  dispose() {}

  parsePage(content: string, _options: TSFixme) {
    const endpoint = getDocsEndpoint();

    const md = new Remarkable({
      html: true,
      breaks: true,
      highlight: function (code) {
        return highlight.highlightAuto(code, ['javascript']).value;
      }
    });

    const regexMatch = content.match(/{\/\*##head##\*\/}([\s\S]*?){\/\*##head##\*\/}/);
    if (!regexMatch) return null;

    const el = document.createElement('div');
    el.innerHTML = md.render(regexMatch[1]);

    // Iterate over all images and load the src as a dataurl
    el.querySelectorAll('img').forEach((img) => {
      const url = img.getAttribute('src');

      if (!url.startsWith('/')) {
        img.setAttribute('src', this.baseUrl.href.split('/').slice(0, -1).join('/') + '/' + url);
      } else {
        img.setAttribute('src', endpoint + url);
      }
    });

    el.querySelectorAll('a').forEach((anchor) => {
      anchor.setAttribute('target', '_blank'); // Open external

      let url = anchor.getAttribute('href');

      if (url.startsWith('https://docs.noodl.net')) {
        //add version number
        url.replace('https://docs.noodl.net', endpoint);
      } else {
        url = endpoint + url;
      }
      anchor.setAttribute('href', url);
    });

    return el;
  }

  async fetchPage(url: string, callback) {
    this.baseUrl = new URL(url);

    const page = await fetchText(url);
    let html = page.text;
    if (html === undefined) {
      // Access denied stays silent and never calls back, as the jQuery version did
      if (page.status !== 401) callback();
      return;
    }

    // Find all filename references
    const refs = [];
    for (const m of html.matchAll(/@include\s"(.*)"/g)) {
      const ref = m[1];
      if (ref !== undefined) {
        refs.push({ anchor: m[0], url: new URL(ref.trim(), url).href });
      }
    }

    const included = await Promise.all(refs.map((ref) => fetchText(ref.url)));
    refs.forEach((ref, index) => {
      // Ignore the ones that failed, as the callback version did
      if (included[index].text !== undefined) {
        html = html.replace(ref.anchor, included[index].text);
      }
    });

    callback(this.parsePage(html, {}));
  }
}
