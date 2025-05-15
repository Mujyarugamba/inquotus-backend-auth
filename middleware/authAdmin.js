const jwt = require('jsonwebtoken');
const pool = require('../db'); // adatta il path se serve

const authAdmin = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token mancante' });

  try {
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query('SELECT ruolo FROM utenti WHERE id = $1', [decoded.id]);
    const utente = result.rows[0];

    if (!utente || utente.ruolo !== 'admin') {
      return res.status(403).json({ error: 'Accesso negato: solo per admin' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token non valido o scaduto' });
  }
};

module.exports = authAdmin;
