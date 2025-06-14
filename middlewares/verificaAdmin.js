module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token mancante' });

  try {
    const token = auth.split(' ')[1];
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

    if (payload.ruolo !== 'admin') {
      return res.status(403).json({ error: 'Accesso riservato agli admin' });
    }

    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token non valido' });
  }
};
