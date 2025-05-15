const { Pool } = require("pg");

// Copia da Supabase: Settings → Database → Connection string (pooling)
const pool = new Pool({
  connectionString: "postgresql://postgres:[YOUR-PASSWORD]@db.praxwadsvulwckvejxap.supabase.co:5432/postgres",
  ssl: {
    rejectUnauthorized: false, // necessario per Supabase
  },
});

module.exports = pool;

