const https = require('https');
const http = require('http');
const PORT = process.env.PORT || 3000;
const THESPORTS_BASE = 'api.thesports.com';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check — HEAD (UptimeRobot keep-alive)
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end();
    return;
  }

  // IP check
  if (req.method === 'GET' && req.url === '/ip') {
    https.get('https://api4.ipify.org?format=json', (ipRes) => {
      let data = '';
      ipRes.on('data', chunk => { data += chunk; });
      ipRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    }).on('error', (err) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // ─── GET passthrough ───────────────────────────────────────────
  if (req.method === 'GET') {
    const urlObj = new URL(req.url, `http://localhost`);
    const path = urlObj.pathname + urlObj.search;
    console.log(`[Proxy] GET → https://${THESPORTS_BASE}${path}`);

    const options = {
      hostname: THESPORTS_BASE,
      path,
      method: 'GET',
      headers: { Accept: 'application/json' }
    };

    const upstream = https.request(options, (upRes) => {
      let data = '';
      upRes.on('data', chunk => { data += chunk; });
      upRes.on('end', () => {
        res.writeHead(upRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    });

    upstream.on('error', (err) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });

    upstream.end();
    return;
  }

  // ─── POST passthrough ──────────────────────────────────────────
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { endpoint, user, secret, queryParams } = JSON.parse(body);
        if (!endpoint || !user || !secret) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing: endpoint, user, secret' }));
          return;
        }
        const params = new URLSearchParams({ user, secret, ...(queryParams || {}) });
        const path = `/v1/football${endpoint}?${params}`;
        console.log(`[Proxy] POST → https://${THESPORTS_BASE}${path}`);

        const options = {
          hostname: THESPORTS_BASE,
          path,
          method: 'GET',
          headers: { Accept: 'application/json' }
        };

        const upstream = https.request(options, (upRes) => {
          let data = '';
          upRes.on('data', chunk => { data += chunk; });
          upRes.on('end', () => {
            res.writeHead(upRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        upstream.on('error', (err) => {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
        });

        upstream.end();
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // Método não suportado
  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

server.listen(PORT, () => console.log(`TheSports Proxy running on port ${PORT}`));
