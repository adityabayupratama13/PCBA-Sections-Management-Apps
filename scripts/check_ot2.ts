import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'it-management.db');
const db = new Database(dbPath);

console.log("All attendance logs for Aditya:");
const logs = db.prepare('SELECT * FROM attendance_logs WHERE member_name = ? ORDER BY id DESC LIMIT 10').all('Aditya Bayu Pratama');
console.table(logs);
