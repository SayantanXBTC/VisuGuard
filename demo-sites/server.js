// Two tiny demo websites for showing VisuGuard without depending on a real site.
//   node server.js             start both sites
//   node server.js baseline    start only the baseline site
//   node server.js changed     start only the changed site
// Only Node's built-in modules are used.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const SITES = {
  baseline: { port: 4100 },
  changed: { port: 4101 },
};

const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// "/" -> index.html, "/about" or "/about/" -> about.html, "/style.css" -> style.css
// Only a plain name is accepted, so a request can never leave the site's folder.
function fileFor(folder, pathname) {
  const name = pathname.replace(/^\/|\/$/g, '') || 'index';
  if (!/^[a-z0-9-]+(\.css)?$/.test(name)) return null;
  const file = path.join(__dirname, folder, name.endsWith('.css') ? name : `${name}.html`);
  return fs.existsSync(file) ? file : null;
}

function startSite(folder, port) {
  const server = http.createServer((req, res) => {
    const file = fileFor(folder, new URL(req.url, 'http://localhost').pathname);
    if (!file) {
      res.writeHead(404, { 'Content-Type': CONTENT_TYPES['.html'] });
      return res.end('<!doctype html><title>Not found</title><h1>404 - Page not found</h1>');
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] });
    fs.createReadStream(file).pipe(res);
  });

  server.on('error', (error) => {
    console.error(`Could not start the ${folder} site on port ${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, () => console.log(`${folder} site:  http://localhost:${port}`));
}

const only = process.argv[2];
if (only && !SITES[only]) {
  console.error('Usage: node server.js [baseline|changed]');
  process.exit(1);
}

for (const [folder, { port }] of Object.entries(SITES)) {
  if (!only || only === folder) startSite(folder, port);
}
