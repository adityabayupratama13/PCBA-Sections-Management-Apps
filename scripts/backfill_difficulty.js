/**
 * Migration: Backfill 'difficulty' column based on 'priority'
 * Only updates where difficulty is currently 0 (not set).
 * Run: node scripts/backfill_difficulty.js
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

  console.log('🚀 Starting backfill process...\n');

  for (const [section, db] of Object.entries(SECTION_DB_MAP)) {
    try {
      // Update tasks table
      const [taskRes] = await pool.query(`
        UPDATE \`${db}\`.tasks 
        SET difficulty = CASE 
          WHEN priority = 'Critical' THEN 5 
          WHEN priority = 'High' THEN 4 
          WHEN priority = 'Medium' THEN 3 
          WHEN priority = 'Low' THEN 2 
          ELSE 1 
        END 
        WHERE difficulty = 0;
      `);
      
      // Update tickets table
      const [tktRes] = await pool.query(`
        UPDATE \`${db}\`.tickets 
        SET difficulty = CASE 
          WHEN priority = 'Critical' THEN 5 
          WHEN priority = 'High' THEN 4 
          WHEN priority = 'Medium' THEN 3 
          WHEN priority = 'Low' THEN 2 
          ELSE 1 
        END 
        WHERE difficulty = 0;
      `);

      process.stdout.write(`✅ [${section}] Updated ${taskRes.affectedRows} tasks and ${tktRes.affectedRows} tickets.\n`);
    } catch (e) {
      console.error(`❌ [${section}] Error:`, e.message);
    }
  }

  console.log('\n🏁 Backfill complete for all sections.');
  pool.end();
}

run();
