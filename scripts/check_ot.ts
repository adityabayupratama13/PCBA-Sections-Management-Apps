import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'it-management.db');
const db = new Database(dbPath);

console.log("All attendance logs with overtime_hours > 0:");
const logs = db.prepare('SELECT * FROM attendance_logs WHERE overtime_hours > 0 ORDER BY id DESC LIMIT 10').all();
console.table(logs);
