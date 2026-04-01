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

const CENTRAL_DB = 'pcba_central_db';
const SOURCE_DB = 'giken_db';

const CENTRAL_TABLES = ['members', 'positions']; // These go to central DB

async function cloneDatabase() {
  console.log('Connecting to MySQL...');
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root'
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    // 1. Get CREATE TABLE scripts from SOURCE_DB
    const schemas = {};
    const [tables] = await conn.query(`SHOW TABLES FROM ${SOURCE_DB}`);
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [createRes] = await conn.query(`SHOW CREATE TABLE ${SOURCE_DB}.${tableName}`);
      schemas[tableName] = createRes[0]['Create Table'];
    }
    console.log('Extracted schemas for:', Object.keys(schemas).join(', '));

    // 2. Create Central DB
    console.log(`\nCreating Central DB: ${CENTRAL_DB}`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${CENTRAL_DB}`);
    for (const table of CENTRAL_TABLES) {
      if (schemas[table]) {
        await conn.query(`CREATE TABLE IF NOT EXISTS ${CENTRAL_DB}.${table} ` + schemas[table].substring(schemas[table].indexOf('(')));
        try {
            await conn.query(`INSERT IGNORE INTO ${CENTRAL_DB}.${table} SELECT * FROM ${SOURCE_DB}.${table}`);
            console.log(` - Migrated data for ${table} to central DB`);
        } catch(e) {
            console.log(` - Data migration skipped/failed for ${table}:`, e.message);
        }
      }
    }

    // 3. Create Section DBs dynamically using all remaining tables
    const sectionTables = Object.keys(schemas).filter(t => !CENTRAL_TABLES.includes(t));
    const sectionDbs = Object.values(SECTION_DB_MAP);
    for (const dbName of sectionDbs) {
      if (dbName === SOURCE_DB) continue; 
      console.log(`\nCreating Section DB: ${dbName}`);
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
      
      for (const table of sectionTables) {
        if (schemas[table]) {
          await conn.query(`CREATE TABLE IF NOT EXISTS ${dbName}.${table} ` + schemas[table].substring(schemas[table].indexOf('(')));
        }
      }
    }

    console.log('\n✅ Database replication and setup completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await conn.end();
  }
}

cloneDatabase();
