import mysql from 'mysql2/promise';
import { headers } from 'next/headers';

export const SECTION_DB_MAP: Record<string, string> = {
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

export const CENTRAL_DB = 'pcba_central_db';

// Use globalThis to survive Next.js HMR reloads
const g = globalThis as unknown as { __mysqlPools?: Map<string, mysql.Pool> };

export function getDb(sectionOverride?: string | null): mysql.Pool {
  if (!g.__mysqlPools) {
    g.__mysqlPools = new Map<string, mysql.Pool>();
  }

  let dbName = CENTRAL_DB;
  
  if (sectionOverride === 'CENTRAL') {
    dbName = CENTRAL_DB;
  } else {
    let section = sectionOverride;
    if (!section) {
      try {
        const h = headers();
        section = h.get('x-section');
      } catch {
        // Not inside a request context (e.g. cron job)
      }
    }
    dbName = section ? (SECTION_DB_MAP[section] || CENTRAL_DB) : CENTRAL_DB;
  }

  if (!g.__mysqlPools.has(dbName)) {
    g.__mysqlPools.set(dbName, mysql.createPool({
      host: process.env.MYSQL_HOST || 'giken-mysql',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    }));
  }
  return g.__mysqlPools.get(dbName)!;
}

/** Convert a JS Date or ISO string to MySQL DATETIME format: YYYY-MM-DD HH:MM:SS */
export function toMysqlDatetime(d?: Date | string | null): string {
  if (!d) return new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

/** Today's date as YYYY-MM-DD */
export function toMysqlDate(d?: Date | string | null): string {
  const dt = toMysqlDatetime(d);
  return dt ? dt.split(' ')[0] : '';
}
