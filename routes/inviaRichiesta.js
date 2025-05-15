const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

router.post("/inviaRichiesta", async (req, res) => {
  const { nome, azienda, email, telefono, corso, modalita, note } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail", // O usa smtp del tuo provider
    auth: {
      user: process.env.EMAIL_INQUOTUS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptionsCliente = {
    from: `"Inquotus" <${process.env.EMAIL_INQUOTUS}>`,
    to: email,
    subject: "Conferma iscrizione al corso Inquotus",
    html: `
      <p>Ciao ${nome},</p>
      <p>Grazie per aver richiesto il corso <strong>${corso}</strong> (<em>${modalita}</em>) tramite Inquotus.</p>
      <p>Verrai contattato al più presto dal nostro staff.</p>
      <p>Note inviate: ${note || "Nessuna"}</p>
      <br/>
      <p>Il team di Inquotus</p>
    `,
  };

  const mailOptionsStaff = {
    from: `"Inquotus" <${process.env.EMAIL_INQUOTUS}>`,
    to: "info@inquotus.it", // Email interna per gestione richieste
    subject: `Nuova richiesta corso - ${corso}`,
    html: `
      <p><strong>Nuova richiesta corso ricevuta:</strong></p>
      <ul>
        <li><strong>Nome:</strong> ${nome}</li>
        <li><strong>Azienda:</strong> ${azienda}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Telefono:</strong> ${telefono}</li>
        <li><strong>Corso:</strong> ${corso}</li>
        <li><strong>Modalità:</strong> ${modalita}</li>
        <li><strong>Note:</strong> ${note || "Nessuna"}</li>
      </ul>
    `,
  };

  try {
    await transporter.sendMail(mailOptionsCliente);
    await transporter.sendMail(mailOptionsStaff);
    res.status(200).json({ success: true, message: "Email inviate con successo" });
  } catch (error) {
    console.error("Errore invio email:", error);
    res.status(500).json({ success: false, message: "Errore nell'invio" });
  }
});

module.exports = router;
