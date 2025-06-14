module.exports = (ruoloRichiesto) => {
  return (req, res, next) => {
    if (!req.user || req.user.ruolo !== ruoloRichiesto) {
      return res.status(403).json({ error: 'Accesso non autorizzato' });
    }
    next();
  };
};
