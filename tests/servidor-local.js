/* Serves the site and the /api functions the way Vercel does, for the real-data test. It reads everything from the
   environment: DATABASE_URL, SESSION_SECRET and the ACCESO_* passwords. Usage: node tests/servidor-local.js [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const RUTAS = { '/api/acceso': require('../api/acceso.js'), '/api/solicitudes': require('../api/solicitudes.js') };

function crear() {
  return http.createServer((req, res) => {
    const ruta = new URL(req.url, 'http://x').pathname;
    const fn = RUTAS[ruta];
    if (fn) {
      let raw = '';
      req.on('data', c => { raw += c; });
      req.on('end', () => {
        req.body = raw;
        res.status = c => { res.statusCode = c; return res; };
        res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
        fn(req, res);
      });
      return;
    }
    const archivo = path.join(ROOT, ruta === '/' ? 'index.html' : ruta);
    if (!archivo.startsWith(ROOT) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', TIPOS[path.extname(archivo)] || 'application/octet-stream');
    fs.createReadStream(archivo).pipe(res);
  });
}

if (require.main === module) crear().listen(Number(process.argv[2]) || 4174, () => console.log('Sirviendo'));
module.exports = { crear };
