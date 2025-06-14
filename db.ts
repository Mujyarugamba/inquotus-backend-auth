// TypeScript wrapper, importa db.js
// @ts-ignore perché db.js è CommonJS
const pool = require('./db');

export const db = {
  richieste_committenti: {
    findUnique: async ({ where }: { where: { id: number } }) => {
      const res = await pool.query(
        `SELECT id, nome_contatto, telefono, email_committente FROM richieste_committenti WHERE id = $1 LIMIT 1`,
        [where.id]
      );
      return res.rows[0] || null;
    }
  },
  sblocchi: {
    findFirst: async ({ where }: { where: { richiesta_id: number; utente_id: number } }) => {
      const res = await pool.query(
        `SELECT * FROM sblocchi WHERE richiesta_id = $1 AND utente_id = $2 LIMIT 1`,
        [where.richiesta_id, where.utente_id]
      );
      return res.rows[0] || null;
    }
  }
};


