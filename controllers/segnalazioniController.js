const supabase = require('../config/supabaseClient');

exports.creaSegnalazione = async (req, res) => {
  const { richiesta_id, motivo } = req.body;
  const email_committente = req.utente.email;

  if (!richiesta_id || !motivo) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }

  // 1. Salva segnalazione
  const { data: segnalazione, error: erroreSegnalazione } = await supabase
    .from('segnalazioni')
    .insert([{ richiesta_id, motivo, email_committente }])
    .select()
    .single();
