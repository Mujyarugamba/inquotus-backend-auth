const express = require('express');
const router = express.Router();
const {
  getRichiesteSegnalate,
  archiviaRichiesta,
  rimuoviRichiesta
} = require('../controllers/adminController');
const verificaAdmin = require('../middleware/verificaAdmin');

// Tutte le rotte qui sono protette e accessibili solo agli admin
router.get('/richieste-segnalate', verificaAdmin, getRichiesteSegnalate);
router.post('/archivia-richiesta/:id', verificaAdmin, archiviaRichiesta);
router.delete('/rimuovi-richiesta/:id', verificaAdmin, rimuoviRichiesta);

module.exports = router;
