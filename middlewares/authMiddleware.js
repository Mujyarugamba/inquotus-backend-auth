const jwt = require('jsonwebtoken');

/**
 * Middleware per autenticazione JWT
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token mancante o malformato' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // es: { id, email, ruolo, nome }
    next();
  } catch (err) {
    console.error('Errore autenticazione JWT:', err.message);
    return res.status(403).json({ error: 'Token non valido o scaduto' });
  }
}

module.exports = authMiddleware;



