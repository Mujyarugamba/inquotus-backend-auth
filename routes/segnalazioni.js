const express = require('express');
const router = express.Router();
const { creaSegnalazione } = require('../controllers/segnalazioniController');
const verificaToken = require('../middleware/verificaToken');

// POST /api/segnalazioni
router.post('/', verificaToken, creaSegnalazione);

module.exports = router;
