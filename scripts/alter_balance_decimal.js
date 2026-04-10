/**
 * Migration: Alter balance column from INT to DECIMAL(5,1)
 * This allows user_leave_balances to store fractional balances like 5.5
 * Run: node scripts/alter_balance_decimal.js
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
      await pool.query(
        `ALTER TABLE \`${db}\`.user_leave_balances MODIFY COLUMN balance DECIMAL(5,1) NOT NULL DEFAULT 0.0;`
      );
      console.log(`✅ [${section}] Altered balance to DECIMAL(5,1) in ${db}.user_leave_balances`);
    } catch (e) {
      console.error(`❌ [${section}] Error:`, e.message);
    }
  }

  console.log('\n🏁 Migration complete.');
  pool.end();
}

run();
