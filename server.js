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
const PORT = process.env.PORT || 10000;
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

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError || !loginData.user || !loginData.session) {
      const failLog = `${new Date().toISOString()} ❌ LOGIN FALLITO per ${email}\n`;
      fs.appendFile(LOG_PATH, failLog, () => {});
      await pool.query(
        'INSERT INTO log_attivita (azione, email, dettaglio) VALUES ($1, $2, $3)',
        ['login_fallito', email, loginError?.message || 'Credenziali non valide']
      );
      return res.status(401).json({ error: 'Email o password errate' });
    }

    const user = loginData.user;
    const ruolo = user.user_metadata?.ruolo;

    if (!['committente', 'impresa', 'progettista', 'admin'].includes(ruolo)) {
      return res.status(403).json({ error: 'Ruolo non valido' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, ruolo },
      SECRET,
      { expiresIn: '7d' }
    );

    const successLog = `${new Date().toISOString()} ✅ LOGIN per ${email} (${ruolo})\n`;
    fs.appendFile(LOG_PATH, successLog, () => {});

    await pool.query(
      'INSERT INTO log_attivita (azione, email, dettaglio) VALUES ($1, $2, $3)',
      ['login_successo', email, `Ruolo: ${ruolo}`]
    );

    res.status(200).json({
      message: 'Login riuscito',
      token,
      utente: { id: user.id, email: user.email, ruolo },
    });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

app.get('/api/me', verifyToken(), (req, res) => {
  res.status(200).json({
    message: 'Utente autenticato',
    utente: req.user,
  });
});

app.use('/api/richieste-sbloccate', verifyToken(['impresa', 'progettista']), async (req, res, next) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        const richiestaId = parsed?.richiestaId || 'ID sconosciuto';
        const email = req.user?.email || 'ignoto';
        const log = `${new Date().toISOString()} 🔓 SBLOCCO richiesta da utente ${email} su richiesta ${richiestaId}\n`;
        fs.appendFile(LOG_PATH, log, () => {});
        await pool.query(
          'INSERT INTO log_attivita (azione, email, dettaglio) VALUES ($1, $2, $3)',
          ['sblocco_richiesta', email, `richiestaId: ${richiestaId}`]
        );
      } catch (_) {}
      next();
    });
  } else {
    next();
  }
});

app.use('/api', verifyToken(), corsiRouter);
app.use('/api', verifyToken(), richiesteLavoroRoute);
app.use('/api', verifyToken(['impresa', 'progettista']), richiesteSbloccateRoute);
app.use('/api/admin', verifyToken(['admin']), onlyRole('admin'), adminRichiesteLavoro);
app.use('/api/admin/email', verifyToken(['admin']), onlyRole('admin'), adminEmailRoute);

app.get('/api/log-attivita', verifyToken(['admin']), onlyRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM log_attivita ORDER BY timestamp DESC LIMIT 100');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Errore recupero log_attivita:', err);
    res.status(500).json({ error: 'Errore interno nel recupero dei log' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API Inquotus attiva!');
});

app.listen(PORT, () => {
  console.log(`✅ Server Inquotus avviato sulla porta ${PORT}`);
});











