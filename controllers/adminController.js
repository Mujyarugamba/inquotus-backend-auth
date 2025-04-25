const db = require('../db'); // o il tuo sistema per accedere al DB

exports.getRichiesteSegnalate = async (req, res) => {
  try {
    const segnalate = await db.query(`
      SELECT r.*, s.motivo
      FROM segnalazioni s
      JOIN richieste r ON s.richiesta_id = r.id
      WHERE r.archiviata IS DISTINCT FROM true
    `);
    res.json(segnalate.rows);
  } catch (err) {
    res.status(500).json({ error: 'Errore nel recupero delle richieste segnalate' });
  }
};

exports.archiviaRichiesta = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`UPDATE richieste SET archiviata = true WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Richiesta archiviata con successo' });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante l\'archiviazione della richiesta' });
  }
};

exports.rimuoviRichiesta = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM richieste WHERE id = $1`, [id]);
    await db.query(`DELETE FROM segnalazioni WHERE richiesta_id = $1`, [id]);
    res.json({ success: true, message: 'Richiesta rimossa con successo' });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante la rimozione della richiesta' });
  }
};
