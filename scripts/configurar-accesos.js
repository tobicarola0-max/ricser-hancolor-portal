/* Creates the internal access passwords and saves them in Vercel. Run it yourself, from the root of the repo:
     node scripts/configurar-accesos.js
   Nothing is printed on screen. The passwords stay in entregables/claves-acceso.txt, which git ignores: hand each one
   to its person, keep them in a password manager and delete the file. Running it again replaces all of them. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const vercel = (args, input) => spawnSync('vercel', args, { input, shell: true, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const clave = () => crypto.randomBytes(15).toString('base64url');

const ACCESOS = { ACCESO_TECNICO: 'Técnico', ACCESO_ADMIN: 'Administrador', ACCESO_FABRICA: 'Fábrica HanColor' };
const valores = { SESSION_SECRET: crypto.randomBytes(48).toString('base64url') };
Object.keys(ACCESOS).forEach(k => { valores[k] = clave(); });

for (const [nombre, valor] of Object.entries(valores)) {
  const r = vercel(['env', 'add', nombre, 'production', '--force', '--sensitive'], valor);
  if (r.status !== 0) {
    console.error(`No se pudo guardar ${nombre} en Vercel.\n${(r.stderr || '').split('\n').slice(-4).join('\n')}`);
    process.exit(1);
  }
  console.log(`Guardada en Vercel: ${nombre}`);
}

const carpeta = path.join(__dirname, '..', 'entregables');
fs.mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, 'claves-acceso.txt');
fs.writeFileSync(archivo, ['Claves de "Acceso interno" del portal Ricser. Pasale a cada persona solo la suya y borrá este archivo.', '', ...Object.entries(ACCESOS).map(([k, n]) => `${n}: ${valores[k]}`), ''].join('\n'));
console.log(`\nClaves guardadas en ${archivo}`);

console.log('Publicando de nuevo para que tomen efecto...');
const d = vercel(['redeploy', 'ricser-hancolor-portal.vercel.app', '--environment', 'production']);
if (d.status !== 0) {
  console.error('Las claves ya están en Vercel, pero no se pudo publicar de nuevo. Avisale a Claude para que lo haga.');
  process.exit(1);
}
console.log('Listo.');
