const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authenticateAdmin = require('../../middleware/authenticateAdmin');

router.use(authenticateAdmin);

// ...altre rotte già presenti

// DELETE utente
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM utenti WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
    res.json({ message: 'Utente eliminato' });
  } catch (error) {
    console.error('Errore eliminazione utente:', error);
    res.status(500).json({ error: 'Errore eliminazione utente' });
  }
});

module.exports = router;

