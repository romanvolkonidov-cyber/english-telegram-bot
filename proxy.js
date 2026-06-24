import http from 'node:http';
import https from 'node:https';
import process from 'node:process';

process.env.ANTHROPIC_API_KEY = "sk-ant-dummy-key-to-bypass-login";
process.env.ANTHROPIC_BASE_URL = "http://localhost:8080";

const TARGET_HOST = "aws-external-anthropic.us-east-1.api.aws";
const API_KEY = process.env.ANTHROPIC_AWS_API_KEY;
const WORKSPACE_ID = process.env.ANTHROPIC_AWS_WORKSPACE_ID;

if (!API_KEY) {
  console.error("❌ ERROR: ANTHROPIC_AWS_API_KEY is blank.");
  console.error("👉 Please run using: node --env-file=.env proxy.js\n");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // Catch simple root or metadata requests that throw 405 errors on the AWS Gateway
  if (req.method === 'GET' || req.url === '/' || req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: "active",
      message: "AWS Proxy Mock Layer Active",
      models: [{ id: "claude-3-5-sonnet-latest" }]
    }));
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    
    if (body && req.method !== 'GET') {
      try {
        const parsed = JSON.parse(body);
        delete parsed.context_management;
        body = JSON.stringify(parsed);
      } catch (e) {
        // Fallback
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'X-API-Key': API_KEY,
      'anthropic-version': '2023-06-01',
    };

    if (WORKSPACE_ID) {
      headers['anthropic-workspace-id'] = WORKSPACE_ID;
    }

    if (body && req.method !== 'GET') {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const options = {
      hostname: TARGET_HOST,
      path: req.url,
      method: req.method,
      headers: headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (proxyRes.statusCode >= 400) {
        let errorData = '';
        proxyRes.on('data', chunk => { errorData += chunk; });
        proxyRes.on('end', () => {
          console.log(`\n❌ [AWS Gateway Reject - Status ${proxyRes.statusCode}]`);
          console.log(`Response Payload: ${errorData}`);
          console.log(`--------------------------------------------------`);
        });
      }

      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error("Proxy Connection Error:", e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });

    if (body && req.method !== 'GET') {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

server.listen(8080, () => {
  console.log('⚡ Proxy Bridge Active!');
  console.log('🔗 Target Host: ' + TARGET_HOST);
  console.log('🤖 CLI Client Redirect: ' + process.env.ANTHROPIC_BASE_URL);
  console.log('--------------------------------------------------');
});