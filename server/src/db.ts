import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'budget.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    UNIQUE(user_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS income_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS budget_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK(category IN ('fundamentals', 'fun', 'future')),
    name TEXT NOT NULL,
    planned REAL NOT NULL DEFAULT 0,
    actual REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

// Migration: add uuid column for existing databases
const budgetCols = (db.prepare('PRAGMA table_info(budgets)').all() as { name: string }[]).map(c => c.name);
if (!budgetCols.includes('uuid')) {
  db.exec('ALTER TABLE budgets ADD COLUMN uuid TEXT');
}

// Ensure unique index exists (no-op if already present)
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_uuid ON budgets(uuid)');

// Backfill UUIDs for any existing rows
const rowsWithoutUuid = db.prepare('SELECT id FROM budgets WHERE uuid IS NULL').all() as { id: number }[];
const setUuid = db.prepare('UPDATE budgets SET uuid = ? WHERE id = ?');
for (const row of rowsWithoutUuid) {
  setUuid.run(randomUUID(), row.id);
}

export default db;
