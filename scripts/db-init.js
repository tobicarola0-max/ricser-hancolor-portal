/* Creates the tables. Needs DATABASE_URL in the environment. Safe to run more than once. */
const { neon } = require('@neondatabase/serverless');
const esquema = require('../api/_lib/esquema.js');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
  const sql = neon(process.env.DATABASE_URL);
  for (const stmt of esquema) await sql.query(stmt);
  const t = await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1");
  console.log('Tablas:', t.map(r => r.table_name).join(', '));
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
