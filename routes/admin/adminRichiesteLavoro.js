const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authAdmin = require('../../middleware/authAdmin');

// Elenco richieste
router.get('/richieste-lavoro', authAdmin, async (req, res) => {
  try {
    const { stato, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const values = [];
    let whereClause = '';

    if (stato) {
      whereClause = 'WHERE stato = $1';
      values.push(stato);
    }

    const query = `
      SELECT * FROM richieste
      ${whereClause}
      ORDER BY data_inserimento DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    values.push(limit);
    values.push(offset);

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel caricamento delle richieste' });
  }
});

// Elimina richiesta
router.delete('/richieste-lavoro/:id', authAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM richieste WHERE id = $1', [req.params.id]);
    res.json({ message: 'Richiesta eliminata' });
  } catch (err) {
    res.status(500).json({ error: 'Errore eliminazione richiesta' });
  }
});

// Approva richiesta
router.put('/richieste-lavoro/:id/approva', authAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE richieste SET stato = $1 WHERE id = $2', ['approvata', req.params.id]);
    res.json({ message: 'Richiesta approvata' });
  } catch (err) {
    res.status(500).json({ error: 'Errore approvazione' });
  }
});

// Segnala richiesta
router.put('/richieste-lavoro/:id/segnala', authAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE richieste SET stato = $1 WHERE id = $2', ['segnalata', req.params.id]);
    res.json({ message: 'Richiesta segnalata' });
  } catch (err) {
    res.status(500).json({ error: 'Errore segnalazione' });
  }
});

// Modifica richiesta (descrizione, località, tags)
router.put('/richieste-lavoro/:id', authAdmin, async (req, res) => {
  const { id } = req.params;
  const { localita, descrizione, tags } = req.body;

  try {
    await pool.query(
      'UPDATE richieste SET localita = $1, descrizione = $2, tags = $3 WHERE id = $4',
      [localita, descrizione, tags, id]
    );
    res.json({ message: 'Richiesta aggiornata con successo' });
  } catch (err) {
    console.error('Errore aggiornamento richiesta:', err);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

module.exports = router;


