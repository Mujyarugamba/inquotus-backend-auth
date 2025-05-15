const nodemailer = require('nodemailer');
const db = require('../config/db');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const inviaNotificaSblocco = async ({ id_richiesta, id_esecutore }) => {
  try {
    const richiestaQuery = await db.query(
      `SELECT r.titolo, r.localita, u.email AS email_committente
       FROM richieste_lavoro r
       JOIN utenti u ON u.email = r.id_committente
       WHERE r.id = $1`,
      [id_richiesta]
    );

    if (richiestaQuery.rows.length === 0) return;

    const { titolo, localita, email_committente } = richiestaQuery.rows[0];

    await transporter.sendMail({
      from: `"Inquotus" <${process.env.SMTP_USER}>`,
      to: email_committente,
      subject: `📬 La tua richiesta è stata sbloccata`,
      text: `La tua richiesta "${titolo}" a ${localita} è stata appena sbloccata da un'impresa o professionista.\n\nAccedi a Inquotus per i dettagli e per gestire i contatti.`
    });
  } catch (err) {
    console.error("Errore durante l'invio della notifica di sblocco:", err);
  }
};

module.exports = {
  inviaNotificaSblocco
};

