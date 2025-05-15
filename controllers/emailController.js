// controllers/emailController.js
const nodemailer = require('nodemailer');
const db = require('../db'); // se usi pg/pg-promise

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false, // true per 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendAdminEmail = async (req, res) => {
  const { userId } = req.params;
  const { subject, message } = req.body;

  try {
    const { rows } = await db.query('SELECT email FROM utenti WHERE id = $1', [userId]);
    const destinatario = rows[0]?.email;

    if (!destinatario) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    await transporter.sendMail({
      from: `"Inquotus" <${process.env.SMTP_USER}>`,
      to: destinatario,
      subject,
      text: message
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l’invio dell’email' });
  }
};

