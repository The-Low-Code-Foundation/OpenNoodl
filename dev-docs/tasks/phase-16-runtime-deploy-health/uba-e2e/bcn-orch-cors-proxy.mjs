/**
 * A CORS-adding reverse proxy in front of the rig's Directus.
 *
 * The rig's Directus has CORS disabled, so a *browser* on a different origin cannot
 * read it — which every previous live pass in this phase missed, because they all ran
 * in Node, where the same-origin policy does not exist. Restarting the container with
 * CORS_ENABLED would break another worker's run mid-flight, so the proxy adds the
 * headers instead.
 *
 * It also serves a second purpose: it gives the deployed app a backend URL that is
 * *different* from the `cloudservices` endpoint baked into the export, so a successful
 * read can only have come from `backendServices`. Same-URL would have made the check
 * vacuous in exactly the way BCN-004 step 6's routing check was.
 */
import http from 'node:http';

const UPSTREAM = process.env.UPSTREAM || 'http://localhost:8055';
const PORT = Number(process.env.PROXY_PORT || 8578);

const server = http.createServer(async (req, res) => {
  const cors = {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,SEARCH',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || 'authorization,content-type',
    'access-control-max-age': '600'
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  try {
    const upstream = await fetch(UPSTREAM + req.url, { method: req.method, headers, body });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      ...cors,
      'content-type': upstream.headers.get('content-type') || 'application/json'
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(502, cors);
    res.end(JSON.stringify({ proxyError: String(e) }));
  }
});

server.listen(PORT, '127.0.0.1', () => console.log('cors proxy on ' + PORT + ' -> ' + UPSTREAM));
