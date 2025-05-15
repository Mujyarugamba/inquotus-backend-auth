const nodemailer = require('nodemailer');

// Configurazione SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Funzione invio email con retry
const sendEmail = async (to, subject, text, html) => {
  const mailOptions = {
    from: `"Inquotus" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email inviata a ${to}`);
      return; // esci se invio riuscito
    } catch (error) {
      console.error(`❌ Tentativo ${attempt} fallito per ${to}:`, error.message);
      if (attempt === 3) {
        throw new Error('Invio email fallito dopo 3 tentativi.');
      }
      // Attendi 2 secondi prima di ritentare
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

module.exports = sendEmail;

