const express = require('express');
const router = express.Router();
const { db } = require('../db');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/api/richieste/:id/dettagli-sbloccati', authMiddleware, async (req, res) => {
  const richiestaId = parseInt(req.params.id, 10);
  const utenteId = req.user?.id;

  if (!richiestaId || !utenteId) {
    return res.status(400).json({ error: 'Dati non validi' });
  }

  try {
    const richiesta = await db.richieste_committenti.findUnique({
      where: { id: richiestaId },
      select: {
        id: true,
        nome_contatto: true,
        telefono: true,
        email_committente: true,
      },
    });

    if (!richiesta) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }

    const sblocco = await db.sblocchi.findFirst({
      where: {
        richiesta_id: richiestaId,
        utente_id: utenteId,
      },
    });

    if (!sblocco) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }

    return res.json({
      nomeContatto: richiesta.nome_contatto,
      email: richiesta.email_committente,
      telefono: richiesta.telefono,
    });
  } catch (err) {
    console.error('Errore recupero dettagli sbloccati:', err);
    return res.status(500).json({ error: 'Errore interno del server' });
  }
});

module.exports = router;


