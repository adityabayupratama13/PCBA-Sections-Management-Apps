/**
 * Backfill: Set actual_completion_date for existing Done tasks
 * Uses updated_at as the best approximation of when the task was completed.
 * Only fills tasks where actual_completion_date is still NULL.
 * 
 * Run: node scripts/backfill_actual_completion.js
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

  let totalUpdated = 0;

  for (const [section, db] of Object.entries(SECTION_DB_MAP)) {
    try {
      // Backfill: use updated_at date for Done tasks that have no actual_completion_date
      const [result] = await pool.query(
        `UPDATE \`${db}\`.tasks 
         SET actual_completion_date = DATE(COALESCE(updated_at, NOW())) 
         WHERE status = 'Done' AND actual_completion_date IS NULL`
      );
      const affected = result.affectedRows || 0;
      totalUpdated += affected;
      console.log(`✅ [${section}] Backfilled ${affected} Done tasks in ${db}`);
    } catch (e) {
      console.error(`❌ [${section}] Error on ${db}:`, e.message);
    }
  }

  console.log(`\n🏁 Backfill complete. Total tasks updated: ${totalUpdated}`);
  pool.end();
}

run();
