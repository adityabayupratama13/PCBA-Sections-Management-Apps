/**
 * Migration: Add is_half_day & half_day_session columns to leave_requests table
 * Run: node scripts/add_half_day_leave.js
 */
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

  for (const [section, db] of Object.entries(SECTION_DB_MAP)) {
    try {
      await pool.query(`ALTER TABLE \`${db}\`.leave_requests ADD COLUMN is_half_day TINYINT(1) NOT NULL DEFAULT 0 AFTER days_count;`);
      console.log(`✅ [${section}] Added is_half_day to ${db}.leave_requests`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(`⏭️  [${section}] is_half_day already exists`);
      else console.error(`❌ [${section}] Error:`, e.message);
    }
    try {
      await pool.query(`ALTER TABLE \`${db}\`.leave_requests ADD COLUMN half_day_session VARCHAR(20) DEFAULT NULL AFTER is_half_day;`);
      console.log(`✅ [${section}] Added half_day_session to ${db}.leave_requests`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log(`⏭️  [${section}] half_day_session already exists`);
      else console.error(`❌ [${section}] Error:`, e.message);
    }
  }

  console.log('\n🏁 Migration complete.');
  pool.end();
}

run();
