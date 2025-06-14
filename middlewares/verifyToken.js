const jwt = require('jsonwebtoken');

const verifyToken = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token mancante' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(payload.ruolo)
      ) {
        return res.status(403).json({ error: 'Accesso non autorizzato' });
      }

      req.user = payload;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token non valido' });
    }
  };
};

module.exports = verifyToken;

