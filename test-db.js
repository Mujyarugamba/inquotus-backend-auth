// test-db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'utenti';
    `);

    console.log('\n📋 Colonne nella tabella utenti:\n');
    result.rows.forEach((row) => {
      console.log(`- ${row.column_name} (nullable: ${row.is_nullable})`);
    });

    const hasNome = result.rows.some(col => col.column_name === 'nome');
    console.log(`\n✅ La colonna "nome" ${hasNome ? 'ESISTE ancora' : 'NON esiste più'} nella tabella utenti.\n`);
  } catch (err) {
    console.error('Errore nella connessione o query al database:', err);
  } finally {
    await pool.end();
  }
})();
