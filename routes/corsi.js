const express = require("express");
const router = express.Router();
const pool = require("../db");
const generateSlug = require("../utils/slugify");
const getUniqueSlug = require("../utils/getUniqueSlug");
const { body, validationResult } = require("express-validator");

// ✅ GET tutti i corsi (inclusi quelli non disponibili)
router.get("/tutti", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM corsi_formazione ORDER BY data_prossima_edizione ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Errore fetch corsi:", err);
    res.status(500).json({ message: "Errore nel recupero corsi" });
  }
});

// ✅ CREAZIONE NUOVO CORSO
router.post(
  "/crea-corso",
  [
    body("titolo").notEmpty().withMessage("Il titolo è obbligatorio"),
    body("descrizione").notEmpty().withMessage("La descrizione è obbligatoria"),
    body("durata").notEmpty().withMessage("La durata è obbligatoria"),
    body("prezzo").isNumeric().withMessage("Il prezzo deve essere un numero"),
    body("ente_erogatore").notEmpty(),
    body("certificazione").notEmpty(),
    body("data_prossima_edizione").notEmpty(),
    body("sede").notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      titolo,
      descrizione,
      durata,
      prezzo,
      ente_erogatore,
      certificazione,
      data_prossima_edizione,
      sede,
      prerequisiti,
      dotazioni
    } = req.body;

    try {
      const slug = await getUniqueSlug(titolo);

      const result = await pool.query(
        `INSERT INTO corsi_formazione (
          titolo, descrizione, durata, prezzo,
          ente_erogatore, certificazione, data_prossima_edizione,
          sede, prerequisiti, dotazioni, disponibilita, slug
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, true, $11
        ) RETURNING *`,
        [
          titolo,
          descrizione,
          durata,
          prezzo,
          ente_erogatore,
          certificazione,
          data_prossima_edizione,
          sede,
          prerequisiti,
          dotazioni,
          slug
        ]
      );

      res.status(201).json({ message: "Corso creato", corso: result.rows[0] });
    } catch (err) {
      console.error("Errore creazione corso:", err);
      res.status(500).json({ message: "Errore durante la creazione del corso" });
    }
  }
);

// ✅ MODIFICA CORSO
router.put("/modifica/:id", async (req, res) => {
  const id = req.params.id;
  const {
    titolo,
    descrizione,
    durata,
    prezzo,
    ente_erogatore,
    certificazione,
    data_prossima_edizione,
    sede,
    prerequisiti,
    dotazioni,
    disponibilita
  } = req.body;

  try {
    await pool.query(
      `UPDATE corsi_formazione
       SET titolo = $1, descrizione = $2, durata = $3, prezzo = $4,
           ente_erogatore = $5, certificazione = $6, data_prossima_edizione = $7,
           sede = $8, prerequisiti = $9, dotazioni = $10, disponibilita = $11
       WHERE id = $12`,
      [
        titolo,
        descrizione,
        durata,
        prezzo,
        ente_erogatore,
        certificazione,
        data_prossima_edizione,
        sede,
        prerequisiti,
        dotazioni,
        disponibilita,
        id
      ]
    );

    res.json({ message: "Corso aggiornato correttamente" });
  } catch (err) {
    console.error("Errore aggiornamento corso:", err);
    res.status(500).json({ message: "Errore durante l'aggiornamento" });
  }
});

// ✅ ELIMINA CORSO
router.delete("/elimina/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM corsi_formazione WHERE id = $1", [id]);
    res.json({ message: "Corso eliminato correttamente" });
  } catch (err) {
    console.error("Errore eliminazione corso:", err);
    res.status(500).json({ message: "Errore durante l'eliminazione" });
  }
});

module.exports = router;


