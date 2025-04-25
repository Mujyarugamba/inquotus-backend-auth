const express = require("express");
const router = express.Router();
const pool = require("../db"); // importa la connessione al database

// Recupera le richieste salvate di un utente
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT r.*
      FROM richieste_salvate rs
      JOIN richieste r ON rs.richiesta_id = r.id
      WHERE rs.user_id = $1
      ORDER BY rs.created_at DESC
    `, [userId]);

    res.json(rows);
  } catch (err) {
    console.error("Errore nel recupero delle richieste salvate:", err);
    res.status(500).json({ error: "Errore nel recupero delle richieste salvate" });
  }
});

module.exports = router;

