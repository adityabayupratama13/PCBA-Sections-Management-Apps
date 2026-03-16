import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file location — use DB_PATH env or fallback to project's data/ dir
const DB_DIR = process.env.DB_PATH || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'it-management.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Use globalThis to survive Next.js HMR module reloads in dev mode
// Without this, _db resets to null on every file save → re-opens + re-seeds
const globalAny = globalThis as unknown as { __itDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalAny.__itDb) {
    globalAny.__itDb = new Database(DB_FILE);
    globalAny.__itDb.pragma('journal_mode = WAL');
    globalAny.__itDb.pragma('synchronous = NORMAL');
    globalAny.__itDb.pragma('cache_size = -64000');
    globalAny.__itDb.pragma('foreign_keys = ON');
    globalAny.__itDb.pragma('temp_store = MEMORY');
    initSchema(globalAny.__itDb);
    seedOnce(globalAny.__itDb);
  }
  return globalAny.__itDb;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      badge TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'IT Support',
      division TEXT NOT NULL DEFAULT 'IT Department',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      password TEXT NOT NULL DEFAULT 'Password123',
      status TEXT NOT NULL DEFAULT 'Active',
      grade TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      reporter TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Open',
      created_date TEXT DEFAULT (datetime('now')),
      resolution TEXT DEFAULT '',
      attachments TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Backlog',
      priority TEXT NOT NULL DEFAULT 'Medium',
      assignee TEXT NOT NULL,
      due_date TEXT DEFAULT '',
      ticket_id TEXT DEFAULT '',
      resolution TEXT DEFAULT '',
      attachments TEXT DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Meeting',
      recurrence TEXT NOT NULL DEFAULT 'weekly',
      day INTEGER DEFAULT 0,
      date TEXT DEFAULT '',
      end_date TEXT DEFAULT '',
      day_of_month INTEGER DEFAULT 0,
      month_of_year INTEGER DEFAULT 0,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      assignee TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      member TEXT NOT NULL,
      activity TEXT NOT NULL,
      hours REAL DEFAULT 0,
      location TEXT DEFAULT 'Office',
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pic TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Planning',
      linked_tasks TEXT DEFAULT '[]',
      linked_schedules TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT DEFAULT '',
      user_name TEXT DEFAULT 'System',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      division TEXT NOT NULL DEFAULT 'IT Department',
      level TEXT NOT NULL DEFAULT 'Staff',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Marker table: prevents re-seeding after user deletes data
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS attendance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      shift TEXT NOT NULL DEFAULT 'Off',
      overtime_hours REAL DEFAULT 0,
      overtime_desc TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_name TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      application_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      approved_by TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_name TEXT NOT NULL,
      year INTEGER NOT NULL,
      annual_total INTEGER DEFAULT 12,
      annual_used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_leave_balances (
      member_name TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      last_accrual_month TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_source ON daily_logs(source);
    CREATE INDEX IF NOT EXISTS idx_schedules_recurrence ON schedules(recurrence);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_members_badge ON members(badge);
    CREATE INDEX IF NOT EXISTS idx_positions_division ON positions(division);
    CREATE INDEX IF NOT EXISTS idx_positions_level ON positions(level);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance_logs(member_name);
  `);

  // Migrations — safe to run repeatedly (will silently fail if column exists)
  try { db.exec('ALTER TABLE tasks ADD COLUMN updated_at TEXT'); } catch { }
  try { db.exec('ALTER TABLE tickets ADD COLUMN updated_at TEXT'); } catch { }
  try { db.exec('ALTER TABLE schedules ADD COLUMN end_date TEXT DEFAULT ""'); } catch { /* ignore if already exists */ }
  try { db.exec('ALTER TABLE members ADD COLUMN grade TEXT DEFAULT ""'); } catch { /* column exists */ }
  try { db.exec('ALTER TABLE tasks ADD COLUMN ticket_id TEXT DEFAULT ""'); } catch { /* column exists */ }
  try { db.exec('ALTER TABLE attendance_logs ADD COLUMN ot_end_time TEXT DEFAULT ""'); } catch { /* column exists */ }
  try { db.exec('ALTER TABLE tasks ADD COLUMN resolution TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE tasks ADD COLUMN attachments TEXT DEFAULT "[]"'); } catch {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN resolution TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE tickets ADD COLUMN attachments TEXT DEFAULT "[]"'); } catch {}
  try { db.exec('ALTER TABLE members ADD COLUMN join_date TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE members ADD COLUMN finish_date TEXT DEFAULT ""'); } catch {}
  try { db.exec('ALTER TABLE members ADD COLUMN employment_status TEXT DEFAULT "Permanent"'); } catch {}
  try { db.exec('ALTER TABLE members ADD COLUMN contract_duration INTEGER DEFAULT 0'); } catch {}
}

/**
 * Seed data ONCE. Uses a _meta flag so data is only seeded for a fresh DB.
 * After first seed, even if user deletes all rows, data won't come back.
 */
function seedOnce(db: Database.Database) {
  const seeded = db.prepare("SELECT value FROM _meta WHERE key = 'seeded'").get() as { value: string } | undefined;
  if (seeded) return; // Already seeded — never re-seed

  // Mark as seeded FIRST (so if seed fails partially, it won't retry)
  db.prepare("INSERT OR REPLACE INTO _meta (key, value) VALUES ('seeded', 'true')").run();

  const tx = db.transaction(() => {
    // Seed members
    const im = db.prepare('INSERT INTO members (name, badge, role, division, password, status) VALUES (?, ?, ?, ?, ?, ?)');
    im.run('Adi Nugroho', 'IT001', 'IT Support', 'Helpdesk', 'Password123', 'Active');
    im.run('Budi Santoso', 'IT002', 'Software Engineer', 'Software Dev', 'Password123', 'Active');
    im.run('Citra Dewi', 'IT003', 'Network Admin', 'Infrastructure', 'Password123', 'Active');
    im.run('Deni Pratama', 'IT004', 'Hardware Tech', 'Infrastructure', 'Password123', 'Active');
    im.run('Eka Putri', 'IT005', 'IT Support', 'Helpdesk', 'Password123', 'Active');

    // Seed positions
    const ip = db.prepare('INSERT OR IGNORE INTO positions (name, division, level, description) VALUES (?, ?, ?, ?)');
    ip.run('IT Leader', 'Management', 'Manager', 'Lead and manage IT department operations');
    ip.run('IT Manager', 'Management', 'Supervisor', 'Coordinate day-to-day IT operations');
    ip.run('Software Engineer', 'Software Dev', 'Senior', 'Design, develop, and maintain software');
    ip.run('Network Admin', 'Infrastructure', 'Senior', 'Manage network infrastructure and security');
    ip.run('IT Support', 'Helpdesk', 'Staff', 'Provide technical support to end users');
    ip.run('Database Admin', 'Software Dev', 'Senior', 'Manage and optimize database systems');
    ip.run('System Analyst', 'Software Dev', 'Senior', 'Analyze requirements and design solutions');
    ip.run('Help Desk', 'Helpdesk', 'Staff', 'Handle first-level support tickets');
    ip.run('Hardware Tech', 'Infrastructure', 'Staff', 'Install and maintain hardware');

    // Seed tickets
    const it = db.prepare('INSERT INTO tickets (id, title, reporter, priority, status, created_date) VALUES (?, ?, ?, ?, ?, ?)');
    it.run('TKT-104', 'Network down in meeting room A', 'Sales Director', 'Critical', 'Open', '2026-03-11T14:30');
    it.run('TKT-103', 'Cannot access ERP system', 'Finance Manager', 'High', 'In Progress', '2026-03-11T10:15');
    it.run('TKT-102', 'Request new monitor setup', 'HR Team', 'Low', 'Resolved', '2026-03-10T16:45');
    it.run('TKT-101', 'Printer ink replacement', 'Admin Office', 'Medium', 'Closed', '2026-03-09T09:20');

    // Seed tasks
    const ik = db.prepare('INSERT INTO tasks (title, status, priority, assignee, initials, due_date) VALUES (?, ?, ?, ?, ?, ?)');
    ik.run('Update server infrastructure', 'Backlog', 'High', 'Citra', 'CI', '2026-03-15');
    ik.run('Fix bug in ticketing system', 'In Progress', 'High', 'Budi', 'BU', '2026-03-12');
    ik.run('Audit software licenses', 'Review', 'Low', 'Eka', 'EK', '2026-03-25');
    ik.run('Deploy internal dashboard', 'Done', 'High', 'Budi', 'BU', '2026-03-10');
    ik.run('Setup network for branch office', 'In Progress', 'High', 'Citra', 'CI', '2026-04-05');

    // Seed schedules
    const is = db.prepare('INSERT INTO schedules (title, type, recurrence, day, date, day_of_month, month_of_year, start_time, end_time, assignee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    is.run('Server Maintenance', 'Maintenance', 'weekly', 1, '', 0, 0, '22:00', '02:00', 'Citra');
    is.run('Weekly IT Sync', 'Meeting', 'weekly', 1, '', 0, 0, '10:00', '11:00', 'All Team');
    is.run('Security Review', 'Meeting', 'weekly', 3, '', 0, 0, '14:00', '15:30', 'Adi, Citra');

    // Seed daily logs
    const il = db.prepare('INSERT INTO daily_logs (date, member, activity, hours, location, source) VALUES (?, ?, ?, ?, ?, ?)');
    il.run('2026-03-11', 'Adi', 'Reviewed API documentation & team sync', 4, 'Office', 'manual');
    il.run('2026-03-11', 'Budi', 'Fixed login bug on ERP staging', 6, 'WFH', 'manual');
    il.run('2026-03-11', 'Citra', 'Reconfigured firewall rules', 5, 'Server Room', 'manual');

    // Seed projects
    const ipr = db.prepare('INSERT INTO projects (name, pic, start_date, end_date, progress, status, linked_tasks, linked_schedules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    ipr.run('ERP System Upgrade', 'Adi', '2026-02-01', '2026-05-30', 45, 'Active', '[]', '[]');
    ipr.run('Cloud Migration Phase 2', 'Budi', '2026-04-01', '2026-08-15', 0, 'Planning', '[]', '[]');

    // Audit log
    db.prepare('INSERT INTO audit_logs (action, module, details, user_name) VALUES (?, ?, ?, ?)').run('System', 'Startup', 'Database initialized with seed data', 'System');
  });
  tx();
}
