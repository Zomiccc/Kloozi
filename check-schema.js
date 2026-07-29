const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'crm_final' });

async function main() {
  const res = await pool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='meta_capi_config' ORDER BY ordinal_position"
  );
  console.log('meta_capi_config columns:');
  res.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));
  
  const res2 = await pool.query('SELECT COUNT(*) FROM meta_capi_config');
  console.log('\nRows:', res2.rows[0].count);
  
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });