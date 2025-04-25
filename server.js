require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3002;
const SECRET = process.env.JWT_SECRET || 'supersegreto';

// Configurazione CORS per accettare solo richieste dal dominio https://www.inquotus.it
app.use(cors({
  origin: 'https://www.inquotus.it', // Permetti solo il dominio desiderato
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const nomeFile = Date.now() + '-' + file.fieldname + ext;
    cb(null, nomeFile);
  }
});
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware
function autenticaToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mancante' });
  jwt.verify(token, SECRET, (err, utente) => {
    if (err) return res.status(403).json({ error: 'Token non valido' });
    req.utente = utente;
    next();
  });
}

function soloImpresaOProfessionista(req, res, next) {
  const ruolo = req.utente?.ruolo;
  if (ruolo === 'impresa' || ruolo === 'professionista') return next();
  return res.status(403).json({ error: 'Accesso riservato a imprese e professionisti' });
}

function soloCommittente(req, res, next) {
  const ruolo = req.utente?.ruolo;
  if (ruolo === 'committente') return next();
  return res.status(403).json({ error: 'Accesso riservato ai committenti' });
}

// API routes
app.get('/', (req, res) => {
  res.send('✅ API Inquotus attiva!');
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE email = $1', [email]);
    const utente = result.rows[0];
    if (!utente) return res.status(401).json({ error: 'Utente non trovato' });

    const match = await bcrypt.compare(password, utente.password);
    if (!match) return res.status(401).json({ error: 'Password errata' });

    const token = jwt.sign(
      { id: utente.id, email: utente.email, ruolo: utente.ruolo, nome: utente.nome },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, ruolo: utente.ruolo });
  } catch (err) {
    console.error('Errore login:', err.message);
    res.status(500).json({ error: 'Errore login' });
  }
});

app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  try {
    const esiste = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);
    if (esiste.rows.length > 0) return res.status(409).json({ error: 'Email già registrata' });

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO utenti (nome, email, password, ruolo, approvato)
       VALUES ($1, $2, $3, $4, $5)`,
      [nome, email, hashed, ruolo, true]
    );
    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    console.error('Errore registrazione:', err.message);
    res.status(500).json({ error: 'Errore registrazione' });
  }
});

app.get('/api/whoami', autenticaToken, (req, res) => {
  res.json({
    id: req.utente.id,
    email: req.utente.email,
    ruolo: req.utente.ruolo,
    nome: req.utente.nome || req.utente.email
  });
});

// === SERVER HTTP + WEBSOCKET ===
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('✅ Client WebSocket connesso');
  ws.send('Benvenuto su Inquotus WebSocket!');
  ws.on('message', (message) => {
    console.log('Messaggio ricevuto dal client:', message);
  });
  ws.on('close', () => {
    console.log('❌ Client disconnesso');
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server Inquotus (API + WebSocket) su http://localhost:${PORT}`);
});
