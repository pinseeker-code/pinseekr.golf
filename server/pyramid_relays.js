const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 8080;
const filePath = process.argv[2] || path.join(__dirname, 'pyramid-relays.json');

// Middleware to handle ETag and If-None-Match
app.use((req, res, next) => {
  const file = filePath;
  if (!fs.existsSync(file)) {
    // Fallback sample
    const sample = {
      cache_max_age: 600,
      relays: [
        { url: 'wss://relay.damus.io', readable: true, writable: true, priority: 1 },
        { url: 'wss://relay.primal.net', readable: true, writable: true, priority: 2 },
      ],
    };
    const content = JSON.stringify(sample, null, 2);
    const etag = `"${crypto.createHash('sha256').update(content).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'ETag': etag,
      'Last-Modified': new Date().toUTCString(),
    });
    return res.send(content);
  }

  const content = fs.readFileSync(file, 'utf8');
  const etag = `"${crypto.createHash('sha256').update(content).digest('hex')}"`;
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'ETag': etag,
    'Last-Modified': new Date().toUTCString(),
  });
  res.send(content);
});

// Routes for compatibility
app.get('/pyramid-relays.json', (req, res, next) => next());
app.get('/relay-info.json', (req, res, next) => next());
app.get('/.well-known/pyramid-relays', (req, res, next) => next());

app.listen(port, () => {
  console.log(`Pyramid relays server listening on port ${port}`);
  console.log(`Serving file: ${filePath}`);
});