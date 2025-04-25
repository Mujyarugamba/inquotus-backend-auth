require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'supersecret';

// Connessione a PostgreSQL su Render (con SSL attivo)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configurazione CORS per supportare richieste da produzione e sviluppo
const allowedOrigins = [
  'https://www.inquotus.it',  // Dominio di produzione
  'http://localhost:3000',     // Dominio di sviluppo
];

app.use(cors({
  origin: (origin, callback) => {
    // Permetti tutte le richieste provenienti dai domini che sono nella lista
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Accesso negato: origine non autorizzata'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// API di test
app.get('/', (req, res) => {
  res.send('API Inquotus Auth attiva!');
});

// Registrazione utente
app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Verifica se l'email è già registrata
    const result = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'Email già registrata' });
    }

    // Inserimento nuovo utente
    await pool.query(
      'INSERT INTO utenti (nome, email, password, ruolo) VALUES ($1, $2, $3, $4)',
      [nome, email, hashedPassword, ruolo]
    );
    res.status(201).json({ message: 'Registrazione completata!' });
  } catch (err) {
    console.error('Errore registrazione:', err);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// Login utente
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE email = $1', [email]);
    const utente = result.rows[0];
    if (!utente) return res.status(404).json({ error: 'Utente non trovato' });

    const isValid = await bcrypt.compare(password, utente.password);
    if (!isValid) return res.status(401).json({ error: 'Credenziali errate' });

    const token = jwt.sign({ id: utente.id, ruolo: utente.ruolo }, SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// ✅ Recupero dati utente dopo login
app.get('/api/user/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT nome, email, ruolo FROM utenti WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Utente non trovato' });
    res.json(user);
  } catch (err) {
    console.error('Errore recupero utente:', err);
    res.status(500).json({ error: 'Errore nel recupero utente' });
  }
});

// ✅ Recupero dati utente con token
app.get('/api/utente', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token mancante' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);

    const result = await pool.query(
      'SELECT id, nome, email, ruolo FROM utenti WHERE id = $1',
      [decoded.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Errore token:', err);
    res.status(403).json({ error: 'Token non valido' });
  }
});

// Avvio del server
app.listen(PORT, () => {
  console.log(`✅ Server avviato sulla porta ${PORT}`);
});
