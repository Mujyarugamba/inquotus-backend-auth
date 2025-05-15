const express = require("express");
const router = express.Router();
const pool = require("../db");
const { body, validationResult } = require("express-validator");
const getUniqueSlug = require("../utils/getUniqueSlug");

// ✅ CREAZIONE RICHIESTA DI LAVORO IN QUOTA
router.post(
  "/richieste-lavoro-in-quota",
  [
    body("categoria").notEmpty().withMessage("La categoria è obbligatoria"),
    body("descrizione").notEmpty().withMessage("La descrizione è obbligatoria"),
    body("regione").notEmpty().withMessage("La regione è obbligatoria"),
    body("provincia").notEmpty().withMessage("La provincia è obbligatoria"),
    body("localita").notEmpty().withMessage("La località è obbligatoria"),
    body("email").isEmail().withMessage("Email non valida"),
    body("telefono").notEmpty().withMessage("Il telefono è obbligatorio")
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      categoria,
      descrizione,
      regione,
      provincia,
      localita,
      email,
      telefono
    } = req.body;

    try {
      const slug = await getUniqueSlug(`${categoria} ${localita}`);

      const result = await pool.query(
        `INSERT INTO richieste_lavoro_in_quota (
          categoria, descrizione, regione, provincia,
          localita, email, telefono, slug
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [
          categoria,
          descrizione,
          regione,
          provincia,
          localita,
          email,
          telefono,
          slug
        ]
      );

      res.status(201).json({ message: "Richiesta creata", richiesta: result.rows[0] });
    } catch (err) {
      console.error("Errore creazione richiesta:", err);
      res.status(500).json({ message: "Errore durante la creazione della richiesta" });
    }
  }
);

module.exports = router;
