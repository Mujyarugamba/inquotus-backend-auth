const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sendEmail = require('./utils/sendEmail');
const richiesteLavoroRoute = require('./routes/richiesteLavoro');
const adminRichiesteLavoro = require('./routes/admin/adminRichiesteLavoro');
const adminEmailRoute = require('./routes/admin/adminEmail');
const corsiRouter = require('./routes/corsi');
const richiesteSbloccateRoute = require('./routes/richiesteSbloccate');
const pool = require('./db');
const verifyToken = require('./middlewares/verifyToken');
const onlyRole = require('./middlewares/onlyRole');

const app = express();
const PORT = process.env.PORT; // Render richiede l'uso esplicito della variabile PORT
const SECRET = process.env.JWT_SECRET || 'supersecret';
const LOG_PATH = path.join(__dirname, 'logs', 'access.log');

const allowedOrigins = [
  'https://www.inquotus.it',
  'https://inquotus-backend-auth.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS non permesso'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('🌐 Origin ricevuto:', origin);
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use((req, res, next) => {
  const log = `${new Date().toISOString()} ${req.method} ${req.url} [${req.ip}]\n`;
  fs.appendFile(LOG_PATH, log, () => {});
  next();
});

app.post('/api/register', async (req, res) => {
  const { email, password, ruolo } = req.body;

  if (!['committente', 'impresa', 'progettista'].includes(ruolo)) {
    return res.status(400).json({ error: 'Ruolo non valido o mancante' });
  }

  console.log('📨 Registrazione richiesta da:', email, 'con ruolo:', ruolo);

  try {
    const result = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'Email già registrata nel sistema' });
    }

    const { data: allUsers, error: userCheckError } = await supabase.auth.admin.listUsers();

    if (userCheckError) {
      console.error('Errore controllo utenti Supabase:', userCheckError.message);
      return res.status(500).json({ error: 'Errore verifica Supabase' });
    }

    const alreadyExists = allUsers.users.some((user) => user.email === email);
    if (alreadyExists) {
      return res.status(409).json({ error: 'Email già registrata su Supabase' });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { ruolo },
      email_confirm: true,
    });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Errore registrazione Supabase' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO utenti (email, password, ruolo) VALUES ($1, $2, $3)',
      [email, hashedPassword, ruolo]
    );

    await pool.query(
      'INSERT INTO log_attivita (azione, email, dettaglio) VALUES ($1, $2, $3)',
      ['registrazione', email, `Ruolo: ${ruolo}`]
    );

    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    console.error('Errore:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});















