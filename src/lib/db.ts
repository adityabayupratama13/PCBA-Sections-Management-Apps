import mysql from 'mysql2/promise';

// Use globalThis to survive Next.js HMR reloads
const g = globalThis as unknown as { __mysqlPool?: mysql.Pool };

export function getDb(): mysql.Pool {
  if (!g.__mysqlPool) {
    g.__mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'giken-mysql',
      port: 3306,
      user: 'root',
      password: 'root',
      database: 'giken_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return g.__mysqlPool;
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
