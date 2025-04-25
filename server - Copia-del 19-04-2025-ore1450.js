const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const SECRET = process.env.JWT_SECRET || 'supersegreto';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Forzato disattivato per connessione locale
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

function autenticaToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mancante' });

  jwt.verify(token, SECRET, (err, utente) => {
    if (err) return res.status(403).json({ error: 'Token non valido' });
    req.utente = utente;
    next();
  });
}

function soloAdmin(req, res, next) {
  if (req.utente?.ruolo !== 'admin') return res.status(403).json({ error: "Accesso riservato all'admin" });
  next();
}

// ✅ LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`🔐 Tentativo login per: ${email}`);
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE email = $1', [email]);
    const utente = result.rows[0];
    if (!utente) {
      console.log('❌ Utente non trovato');
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    const match = await bcrypt.compare(password, utente.password);
    if (!match) {
      console.log('❌ Password errata');
      return res.status(401).json({ error: 'Password errata' });
    }

    const token = jwt.sign(
      { id: utente.id, email: utente.email, ruolo: utente.ruolo },
      SECRET,
      { expiresIn: '7d' }
    );
    console.log('✅ Login riuscito per:', email);
    res.json({ token, ruolo: utente.ruolo });
  } catch (err) {
    console.error('🔥 Errore durante il login:', err.message);
    res.status(500).json({ error: 'Errore login', dettagli: err.message });
  }
});

// ✅ REGISTER
app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  console.log(`📝 Registrazione richiesta da: ${email}`);
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO utenti (nome, email, password, ruolo, approvato)
       VALUES ($1, $2, $3, $4, $5)`,
      [nome, email, hashed, ruolo, true]
    );
    res.status(201).json({ message: 'Registrazione completata' });
  } catch (err) {
    console.error('❌ Errore durante la registrazione:', err.message);
    res.status(500).json({ error: 'Errore registrazione', dettagli: err.message });
  }
});

// ✅ INSERIMENTO RICHIESTA + invio email
app.post('/api/richiesta', autenticaToken, async (req, res) => {
  const { categoria, localita, descrizione, media_url } = req.body;
  const utente_id = req.utente.id;

  try {
    const prezzoIniziale = 20;
    await pool.query(
      `INSERT INTO richieste (categoria, localita, descrizione, media_url, utente_id, data_inserimento, visibile, prezzo)
       VALUES ($1, $2, $3, $4, $5, NOW(), TRUE, $6)`,
      [categoria, localita, descrizione, media_url, utente_id, prezzoIniziale]
    );

    const imprese = await pool.query(`SELECT email FROM utenti WHERE ruolo = 'impresa' AND approvato = true`);

    imprese.rows.forEach(({ email }) => {
      transporter.sendMail({
        from: `Inquotus <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '📢 Nuova richiesta disponibile',
        text: 'È stata pubblicata una nuova richiesta di lavoro in quota. Accedi ora per visualizzarla.',
        html: '<b>È stata pubblicata una nuova richiesta di lavoro in quota. Accedi ora per visualizzarla su Inquotus.</b>'
      }, (err, info) => {
        if (err) {
          console.error(`Errore invio a ${email}:`, err.message);
        } else {
          console.log(`📧 Email inviata a ${email}: ${info.response}`);
        }
      });
    });

    res.status(201).json({ message: 'Richiesta salvata e notifiche inviate' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore inserimento richiesta' });
  }
});

// ✅ RICHIESTE PERSONALI
app.get('/api/richieste/mie', autenticaToken, async (req, res) => {
  const utente_id = req.utente.id;

  try {
    const result = await pool.query(
      `SELECT id, categoria, localita, descrizione, data_inserimento
       FROM richieste
       WHERE utente_id = $1
       ORDER BY data_inserimento DESC`,
      [utente_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Errore nel recupero richieste personali:', err.message);
    res.status(500).json({ error: 'Errore recupero richieste' });
  }
});

// ✅ SBLOCCO
app.post('/api/sblocca/:id', autenticaToken, async (req, res) => {
  const richiestaId = req.params.id;
  const esecutoreId = req.utente.id;

  try {
    const r = await pool.query('SELECT data_inserimento, prezzo, visibile FROM richieste WHERE id = $1', [richiestaId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });

    const { data_inserimento, prezzo, visibile } = r.rows[0];

    if (!visibile) return res.status(410).json({ error: 'Richiesta non più disponibile' });

    const giorniTrascorsi = Math.floor((Date.now() - new Date(data_inserimento)) / (1000 * 60 * 60 * 24));
    if (giorniTrascorsi >= 10) {
      await pool.query('UPDATE richieste SET visibile = FALSE WHERE id = $1', [richiestaId]);
      return res.status(410).json({ error: 'Richiesta non più disponibile' });
    }

    const sconto = Math.min(0.9, giorniTrascorsi * 0.1);
    const prezzoFinale = +(prezzo * (1 - sconto)).toFixed(2);

    await pool.query(
      `INSERT INTO sbloccati (esecutore_id, richiesta_id, data_sblocco)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
      [esecutoreId, richiestaId]
    );

    await pool.query(
      `INSERT INTO transazioni (esecutore_id, richiesta_id, importo)
       VALUES ($1, $2, $3)`,
      [esecutoreId, richiestaId, prezzoFinale]
    );

    res.json({ messaggio: 'Richiesta sbloccata', prezzoPagato: prezzoFinale });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante lo sblocco richiesta' });
  }
});

// ✅ TRANSAZIONI ADMIN
app.get('/api/admin/transazioni', autenticaToken, soloAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.richiesta_id, u.email as esecutore_email, r.categoria, r.localita, t.importo, t.data
       FROM transazioni t
       JOIN utenti u ON u.id = t.esecutore_id
       JOIN richieste r ON r.id = t.richiesta_id
       ORDER BY t.data DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nel recupero transazioni' });
  }
});

// ✅ TEST API
app.get('/', (req, res) => {
  res.send('✅ API Inquotus attiva!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
