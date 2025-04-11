
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'supersecret';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/inquotus'
});

app.use(cors());
app.use(express.json());

// Registrazione
app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO utenti (nome, email, password, ruolo) VALUES ($1, $2, $3, $4)',
      [nome, email, hashedPassword, ruolo]
    );
    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

// Login
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
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

app.get('/', (req, res) => {
  res.send('API Inquotus Auth attiva!');
});

app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
});
