const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;
const THESPORTS_BASE = 'api.thesports.com';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check — HEAD (UptimeRobot keep-alive) or GET (IP lookup)
  if ((req.method === 'GET' || req.method === 'HEAD') && req.url === '/ip') {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    https.get('https://api4.ipify.org?format=json', (ipRes) => {
      let data = '';
      ipRes.on('data', chunk => { data += chunk; });
      ipRes.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      });
    }).on('error', (err) => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

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
      const options = { hostname: THESPORTS_BASE, path, method: 'GET', headers: { Accept: 'application/json' } };
      const upstream = https.request(options, (upRes) => {
        let data = '';
        upRes.on('data', chunk => { data += chunk; });
        upRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.err?.toLowerCase?.().includes('not authorized')) {
              res.writeHead(200);
              res.end(JSON.stringify({ error: 'IP_NOT_WHITELISTED', detail: parsed.err }));
              return;
            }
          } catch (_) {}
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
});

server.listen(PORT, () => console.log(`TheSports Proxy running on port ${PORT}`));
