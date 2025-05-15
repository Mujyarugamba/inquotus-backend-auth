require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const sendEmail = require('./utils/sendEmail');
const richiesteLavoroRoute = require("./routes/richiesteLavoro");
const adminRichiesteLavoro = require('./routes/admin/adminRichiesteLavoro');
const adminEmailRoute = require('./routes/admin/adminEmail');
const corsiRouter = require('./routes/corsi');

const pool = require('./db'); // connessione a Supabase PostgreSQL

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'supersecret';

const allowedOrigins = [
  'https://www.inquotus.it',
  'http://localhost:3000'
];

// ✅ CORS middleware completo
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS non autorizzato'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// ✅ Gestione richieste preflight OPTIONS

app.use(express.json());

// ROTTE
app.use('/api', corsiRouter);
app.use('/api', richiesteLavoroRoute);
app.use('/api/admin', adminRichiesteLavoro);
app.use('/api/admin/email', adminEmailRoute);

// ROTTA BASE
app.get('/', (req, res) => {
  res.send('API Inquotus Auth attiva!');
});

// ✅ REGISTRAZIONE UTENTE CON CONTROLLO RUOLO
app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;

  if (!['committente', 'impresa', 'professionista'].includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido o mancante' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'Email già registrata' });
    }

    await pool.query(
      'INSERT INTO utenti (nome, email, password, ruolo) VALUES ($1, $2, $3, $4)',
      [nome, email, hashedPassword, ruolo]
    );

    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// AVVIO SERVER
app.listen(PORT, () => {
  console.log(`✅ Server Inquotus avviato sulla porta ${PORT}`);
});

