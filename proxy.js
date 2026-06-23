// proxy.js
import http from 'node:http';
import https from 'node:https';

const TARGET_HOST = "aws-external-anthropic.us-east-1.api.aws";
const API_KEY = process.env.ANTHROPIC_AWS_API_KEY;
const WORKSPACE_ID = process.env.ANTHROPIC_AWS_WORKSPACE_ID;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    // Strip unsupported fields from the request body
    if (body && req.method !== 'GET') {
      try {
        const parsed = JSON.parse(body);
        delete parsed.context_management;
        body = JSON.stringify(parsed);
      } catch (e) {
        // not JSON, send as-is
      }
    }

    const options = {
      hostname: TARGET_HOST,
      path: req.url,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-workspace-id': WORKSPACE_ID,
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(8080, () => {
  console.log('Proxy running on http://localhost:8080');
});