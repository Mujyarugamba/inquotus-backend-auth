const express = require('express');
const router = express.Router();
const pool = require('../../db'); // Connessione PostgreSQL
const authenticateAdmin = require('../../middleware/authenticateAdmin'); // Middleware di accesso admin

// Middleware: tutte le rotte sono riservate agli admin
router.use(authenticateAdmin);

// GET - tutte le iscrizioni ai corsi
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.nome, i.email, i.telefono, i.data_iscrizione, i.corso_id, c.titolo AS nome_corso
      FROM iscrizioni_formazione i
      JOIN corsi_formazione c ON i.corso_id = c.id
      ORDER BY i.data_iscrizione DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Errore recupero iscrizioni:', error);
    res.status(500).json({ error: 'Errore nel recupero delle iscrizioni' });
  }
});

// DELETE - elimina una iscrizione
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM iscrizioni_formazione WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Iscrizione non trovata' });
    res.json({ message: 'Iscrizione eliminata' });
  } catch (error) {
    console.error('Errore eliminazione iscrizione:', error);
    res.status(500).json({ error: 'Errore durante l\'eliminazione dell\'iscrizione' });
  }
});

module.exports = router;


