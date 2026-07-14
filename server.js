const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for the SPA — serve index.html for all non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SAT Prep app — serve sat.html with back button
app.get('/sat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sat.html'));
});

// Testing UI — College Board style test window
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Proxy: /api/questions → pinesat.duckdns.org
app.get('/api/questions', (req, res) => {
  const params = new URLSearchParams();
  if (req.query.section) params.set('section', req.query.section);
  if (req.query.limit) params.set('limit', req.query.limit);
  if (req.query.domain) params.set('domain', req.query.domain);
  if (req.query.difficulty) params.set('difficulty', req.query.difficulty);

  const path = `/api/questions?${params.toString()}`;

  const proxyReq = https.get({
    hostname: 'pinesat.duckdns.org',
    path: path,
    headers: { 'Accept': 'application/json' },
    timeout: 15000,
  }, (proxyRes) => {
    let body = '';
    proxyRes.on('data', chunk => body += chunk);
    proxyRes.on('end', () => {
      if (proxyRes.statusCode !== 200) {
        console.error('API error:', proxyRes.statusCode, body.slice(0,200));
        return res.status(proxyRes.statusCode).json({ error: `API responded with ${proxyRes.statusCode}` });
      }
      try {
        const data = JSON.parse(body);
        res.json(data);
      } catch (e) {
        res.status(502).json({ error: 'Invalid JSON from question bank' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from question bank', detail: err.message });
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.status(504).json({ error: 'Question bank timed out' });
  });
});

app.listen(PORT, () => {
  console.log(`LockedIn running at http://localhost:${PORT}`);
});
