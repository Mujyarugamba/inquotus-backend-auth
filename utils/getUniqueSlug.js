const generateSlug = require('./slugify');
const pool = require('../db');

async function getUniqueSlug(titolo) {
  let baseSlug = generateSlug(titolo);
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const { rows } = await pool.query('SELECT 1 FROM corsi_formazione WHERE slug = $1', [slug]);
    if (rows.length === 0) break;
    slug = `${baseSlug}-${count}`;
    count++;
  }

  return slug;
}

module.exports = getUniqueSlug;

