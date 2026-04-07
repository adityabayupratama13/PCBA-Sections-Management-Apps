const mysql = require('mysql2/promise');
const SECTION_DB_MAP = {
  'Engineering': 'pcba_engineering_db',
  'Technician SMT': 'pcba_technician_smt_db',
  'Production SMT-A': 'pcba_prod_smta_db',
  'Production SMT-B': 'pcba_prod_smtb_db',
  'Production SMT-C': 'pcba_prod_smtc_db',
  'PMC': 'pcba_pmc_db',
  'Finish Goods': 'pcba_finish_goods_db',
  'MI Second Floor': 'pcba_mi_second_floor_db',
  'MI Grooming Garment': 'pcba_mi_grooming_db',
  'MI Denso Ryoyo': 'pcba_mi_denso_db',
  'Dipping Technician': 'pcba_dipping_tech_db',
  'PGA-HRE': 'pcba_pga_hre_db',
  'MI Wiseally': 'pcba_mi_wiseally_db',
  'MI Bluetti': 'pcba_mi_bluetti_db',
  'IT': 'pcba_it_db',
  'NPI': 'pcba_npi_db',
  'QA': 'pcba_qa_db'
};

async function run() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '10.0.2.212',
    port: 3306,
    user: 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
  });
  
  for (const db of Object.values(SECTION_DB_MAP)) {
    try {
      await pool.query(`ALTER TABLE \`${db}\`.overtime_requests ADD COLUMN prev_start_time VARCHAR(20) DEFAULT NULL;`);
      await pool.query(`ALTER TABLE \`${db}\`.overtime_requests ADD COLUMN prev_end_time VARCHAR(20) DEFAULT NULL;`);
      await pool.query(`ALTER TABLE \`${db}\`.overtime_requests ADD COLUMN prev_hours DECIMAL(5,2) DEFAULT NULL;`);
      console.log('Altered', db);
    } catch(e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(db, 'already has columns');
      else console.error('Error on', db, e.message);
    }
  }
  pool.end();
}
run();
