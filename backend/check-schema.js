const { Pool } = require('pg');
const p = new Pool({ host:'localhost',port:5432,user:'postgres',password:'postgres',database:'crm_final' });
p.query("SELECT column_name FROM information_schema.columns WHERE table_name='meta_capi_config' ORDER BY ordinal_position")
  .then(r => { console.log('Columns:', r.rows.map(c=>c.column_name).join(', ')); p.end(); })
  .catch(e => { console.error(e); p.end(); });