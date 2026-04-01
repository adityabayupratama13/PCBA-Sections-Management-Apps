const mysql = require('mysql2/promise');

const SECTIONS_TO_TRUNCATE = {
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
  'NPI': 'pcba_npi_db',
  'QA': 'pcba_qa_db'
};

const TABLES_TO_TRUNCATE = [
  'tasks', 'tickets', 'daily_logs', 'audit_logs', 'rules', 
  'attendance_logs', 'leave_balances', 'leave_requests', 'overtime_requests',
  'projects', 'schedules'
];

async function run() {
  const conn = await mysql.createConnection({host: 'localhost', user: 'root', password: 'root'});
  
  console.log('--- RESETTING SECTION DATA ---');
  for (const [division, dbName] of Object.entries(SECTIONS_TO_TRUNCATE)) {
    console.log(`Truncating operational data for: ${dbName}...`);
    for (const table of TABLES_TO_TRUNCATE) {
      try {
        await conn.query(`TRUNCATE TABLE \`${dbName}\`.\`${table}\``);
      } catch (e) {
        // Table doesn't exist in schema, that's fine
      }
    }
  }

  console.log('\n--- CREATING ADMIN ACCOUNTS (Password: 123) ---');
  // Engineering and NPI already exist with their own password
  // IT is excluded from this list entirely
  const SECTIONS_FOR_ADMIN = [
    'Technician SMT', 'Production SMT-A', 'Production SMT-B', 'Production SMT-C', 
    'PMC', 'Finish Goods', 'MI Second Floor', 'MI Grooming Garment', 'MI Denso Ryoyo', 
    'Dipping Technician', 'PGA-HRE', 'MI Wiseally', 'MI Bluetti', 'QA'
  ];

  for (const division of SECTIONS_FOR_ADMIN) {
    const badge = `ADMIN-${division.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`.substring(0, 20);
    const role = `${division} Admin`;
    
    // Clean up if it already exists
    await conn.query(`DELETE FROM pcba_central_db.members WHERE badge = ?`, [badge]);
    await conn.query(`DELETE FROM pcba_central_db.members WHERE division = ? AND badge LIKE 'ADMIN-%'`, [division]);
    
    await conn.query(
      `INSERT INTO pcba_central_db.members (name, badge, password, role, division, member_type, status, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`Admin ${division}`, badge, '123', role, division, 'Admin', 'Active', 'L4']
    );
    console.log(` -> Created admin ID for ${division}: Badge = ${badge}`);
  }

  console.log('\n✅ Data Reset and Admin Creation Complete!');
  await conn.end();
}

run();
