const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;
const SECRET = process.env.JWT_SECRET || 'supersegreto';

app.use(cors());
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

function autenticaToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mancante' });
  jwt.verify(token, SECRET, (err, utente) => {
    if (err) return res.status(403).json({ error: 'Token non valido' });
    req.utente = utente;
    next();
  });
}

// ✅ LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE email = $1', [email]);
    const utente = result.rows[0];
    if (!utente) return res.status(401).json({ error: 'Utente non trovato' });
    const match = await bcrypt.compare(password, utente.password);
    if (!match) return res.status(401).json({ error: 'Password errata' });
    const token = jwt.sign(
      { id: utente.id, email: utente.email, ruolo: utente.ruolo },
      SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, ruolo: utente.ruolo });
  } catch {
    res.status(500).json({ error: 'Errore login' });
  }
});

// ✅ REGISTER
app.post('/api/register', async (req, res) => {
  const { nome, email, password, ruolo } = req.body;
  try {
    const esiste = await pool.query('SELECT id FROM utenti WHERE email = $1', [email]);
    if (esiste.rows.length > 0) return res.status(409).json({ error: 'Email già registrata' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(`INSERT INTO utenti (nome, email, password, ruolo, approvato) VALUES ($1, $2, $3, $4, $5)`,
      [nome, email, hashed, ruolo, true]);
    res.status(201).json({ message: 'Registrazione completata' });
  } catch {
    res.status(500).json({ error: 'Errore registrazione' });
  }
});

// ✅ RECUPERO PASSWORD
app.post('/api/password-reset', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
    const token = crypto.randomBytes(20).toString('hex');
    const scadenza = new Date(Date.now() + 3600000);
    await pool.query(`UPDATE utenti SET reset_token = $1, reset_token_scadenza = $2 WHERE email = $3`, [token, scadenza, email]);
    const link = `http://localhost:3000/reset-password/${token}`;
    await transporter.sendMail({
      to: email,
      from: `Inquotus <${process.env.EMAIL_USER}>`,
      subject: '🔑 Reimposta la tua password',
      html: `Clicca per reimpostare la password: <a href="${link}">${link}</a>`
    });
    res.json({ message: 'Email di recupero inviata' });
  } catch {
    res.status(500).json({ error: 'Errore invio email di recupero' });
  }
});

app.post('/api/password-reset/:token', async (req, res) => {
  const { password } = req.body;
  const token = req.params.token;
  try {
    const result = await pool.query('SELECT * FROM utenti WHERE reset_token = $1 AND reset_token_scadenza > NOW()', [token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Token non valido o scaduto' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE utenti SET password = $1, reset_token = NULL, reset_token_scadenza = NULL WHERE reset_token = $2', [hashed, token]);
    res.json({ message: 'Password aggiornata correttamente' });
  } catch {
    res.status(500).json({ error: 'Errore aggiornamento password' });
  }
});

// ✅ UPLOAD FILE
app.post('/api/upload', autenticaToken, upload.single('immagine'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// ✅ RICHIESTE PUBBLICHE
app.get('/api/richieste/pubbliche', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, categoria, localita, provincia, regione, descrizione, data_inserimento FROM richieste WHERE visibile = true ORDER BY data_inserimento DESC`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Errore recupero richieste pubbliche' });
  }
});

// ✅ RICHIESTE PERSONALI
app.get('/api/richieste/mie', autenticaToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM richieste WHERE utente_id = $1 ORDER BY data_inserimento DESC`, [req.utente.id]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Errore recupero richieste personali' });
  }
});

// ✅ DETTAGLIO RICHIESTA PER MODIFICA
app.get('/api/richiesta/:id', autenticaToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM richieste WHERE id = $1 AND utente_id = $2`, [req.params.id, req.utente.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Errore caricamento richiesta' });
  }
});

// ✅ MODIFICA RICHIESTA
app.put('/api/richiesta/:id', autenticaToken, async (req, res) => {
  try {
    const { categoria, localita, provincia, regione, descrizione, contatti, urgenza } = req.body;
    await pool.query(
      `UPDATE richieste SET categoria = $1, localita = $2, provincia = $3, regione = $4, descrizione = $5, contatti = $6, urgente = $7 WHERE id = $8 AND utente_id = $9`,
      [categoria, localita, provincia, regione, descrizione, contatti, urgenza, req.params.id, req.utente.id]
    );
    res.json({ message: 'Richiesta aggiornata' });
  } catch {
    res.status(500).json({ error: 'Errore aggiornamento richiesta' });
  }
});

// ✅ DELETE RICHIESTA
app.delete('/api/richiesta/:id', autenticaToken, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM richieste WHERE id = $1 AND utente_id = $2`, [req.params.id, req.utente.id]);
    if (result.rowCount === 0) return res.status(403).json({ error: 'Richiesta non trovata o accesso negato' });
    res.json({ message: 'Richiesta eliminata' });
  } catch {
    res.status(500).json({ error: 'Errore eliminazione richiesta' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ API Inquotus attiva!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// ✅ BACKEND - Endpoint per sblocco contatti (finto pagamento)
app.post('/api/sblocca/:richiesta_id', autenticaToken, async (req, res) => {
  const utente_id = req.utente.id;
  const richiesta_id = req.params.richiesta_id;

  try {
    // Verifica se la richiesta esiste ed è visibile
    const verifica = await pool.query(
      `SELECT * FROM richieste WHERE id = $1 AND visibile = true`,
      [richiesta_id]
    );

    if (verifica.rows.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata o non disponibile' });
    }

    // Verifica se è già stata sbloccata da questo utente
    const giaSbloccata = await pool.query(
      `SELECT * FROM sblocchi_richieste WHERE richiesta_id = $1 AND utente_id = $2`,
      [richiesta_id, utente_id]
    );

    if (giaSbloccata.rows.length > 0) {
      return res.status(200).json({ message: 'Già sbloccata' });
    }

    // Simula il pagamento finto e registra lo sblocco
    await pool.query(
      `INSERT INTO sblocchi_richieste (utente_id, richiesta_id, data_sblocco)
       VALUES ($1, $2, NOW())`,
      [utente_id, richiesta_id]
    );

    res.status(201).json({ message: 'Contatto sbloccato con successo (test)' });
  } catch (err) {
    console.error('Errore sblocco:', err);
    res.status(500).json({ error: 'Errore durante lo sblocco' });
  }
});

// sblocca
app.get('/api/sblocchi-effettuati', autenticaToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.prezzo_pagato, s.data_sblocco, r.categoria, r.localita, r.regione, r.provincia
       FROM sblocchi s
       JOIN richieste r ON s.richiesta_id = r.id
       WHERE s.utente_id = $1
       ORDER BY s.data_sblocco DESC`,
      [req.utente.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Errore caricamento storico sblocchi:', err.message);
    res.status(500).json({ error: 'Errore recupero storico sblocchi' });
  }
});

// ✅ CREAZIONE SESSIONE STRIPE PER SBLOCCO CONTATTI
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/checkout/sblocca/:richiestaId', autenticaToken, async (req, res) => {
  const { richiestaId } = req.params;
  const userId = req.utente.id;

  try {
    const result = await pool.query('SELECT * FROM richieste WHERE id = $1', [richiestaId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Richiesta non trovata' });
    }

    const richiesta = result.rows[0];
    const prezzoEuro = richiesta.prezzo || 16.5;
    const prezzoCentesimi = Math.round(prezzoEuro * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Sblocco contatti richiesta #${richiestaId}`,
          },
          unit_amount: prezzoCentesimi,
        },
        quantity: 1,
      }],
      metadata: {
        richiestaId,
        userId,
      },
      success_url: `http://localhost:3000/sblocco-successo?richiesta=${richiestaId}`,
      cancel_url: `http://localhost:3000/richiesta/${richiestaId}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore creazione pagamento' });
  }
});
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Webhook per gestire il completamento del pagamento
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed.', err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gestione evento
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const richiestaId = session.metadata.richiestaId;
    const utenteId = session.metadata.utenteId;

    // 🔓 Sblocca i contatti
    pool.query(
      `INSERT INTO sblocchi (utente_id, richiesta_id, prezzo_pagato, data_sblocco)
       VALUES ($1, $2, $3, NOW())`,
      [utenteId, richiestaId, session.amount_total / 100]
    ).then(() => {
      console.log(`✅ Contatti sbloccati: richiesta ${richiestaId} da utente ${utenteId}`);
    }).catch(err => {
      console.error('Errore salvataggio sblocco:', err.message);
    });
  }

  response.status(200).send();
});

app.post('/api/sblocca/:id', autenticaToken, async (req, res) => {
  const richiestaId = req.params.id;
  const utenteId = req.utente.id;

  try {
    // Recupera i dati della richiesta
    const result = await pool.query('SELECT * FROM richieste WHERE id = $1', [richiestaId]);
    const richiesta = result.rows[0];

    if (!richiesta) return res.status(404).json({ error: 'Richiesta non trovata' });

    // Calcola il prezzo corrente (es. 16.5 € + IVA)
    let prezzoNetto = 16.5;
    const prezzoFinale = (prezzoNetto * 1.22).toFixed(2); // con IVA 22%
    const prezzoStripe = Math.round(prezzoFinale * 100); // in centesimi

    // Crea sessione Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Sblocco contatti richiesta #${richiestaId}`
          },
          unit_amount: prezzoStripe,
        },
        quantity: 1,
      }],
      metadata: {
        richiestaId,
        utenteId
      },
      success_url: `http://localhost:3000/sblocco-successo?richiestaId=${richiestaId}`,
      cancel_url: `http://localhost:3000/richiesta/${richiestaId}`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore durante la creazione del pagamento' });
  }
});


