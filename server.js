// Servidor estático simples, sem dependências.
// Uso: node server.js   (ou npm start)  →  http://localhost:5173
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let urlPath = decodeURIComponent(url.pathname);
  // igual ao GitHub Pages: /cfop → /cfop/ (pasta com index.html)
  const asDir = path.normalize(path.join(ROOT, urlPath));
  if (!urlPath.endsWith('/') && !path.extname(urlPath) && asDir.startsWith(ROOT) && fs.existsSync(path.join(asDir, 'index.html'))) {
    res.writeHead(301, { Location: urlPath + '/' + url.search });
    return res.end();
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Cubo Mágico rodando em http://localhost:${PORT}`));
