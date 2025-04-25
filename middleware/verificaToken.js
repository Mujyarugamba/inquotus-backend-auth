const jwt = require('jsonwebtoken');

const verificaToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: 'Token mancante' });

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.utente = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token non valido' });
  }
};

module.exports = verificaToken;
