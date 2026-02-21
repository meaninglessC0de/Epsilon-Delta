import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'

let db: DatabaseSync

export function initDb(): void {
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'epsilon_delta.db')
  db = new DatabaseSync(dbPath)

  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name         TEXT,
      password_hash TEXT NOT NULL,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id             INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      university          TEXT,
      study_level         TEXT,
      courses             TEXT NOT NULL DEFAULT '[]',
      learning_prefs      TEXT NOT NULL DEFAULT '{}',
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      updated_at          INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS solves (
      id               TEXT PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      problem          TEXT NOT NULL,
      problem_image    TEXT,
      status           TEXT NOT NULL DEFAULT 'active',
      created_at       INTEGER NOT NULL,
      completed_at     INTEGER,
      final_working    TEXT,
      final_feedback   TEXT,
      feedback_history TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_solves_user ON solves(user_id);

    CREATE TABLE IF NOT EXISTS agent_memory (
      user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      topics_covered   TEXT NOT NULL DEFAULT '[]',
      weaknesses       TEXT NOT NULL DEFAULT '[]',
      solve_summaries  TEXT NOT NULL DEFAULT '[]',
      last_updated     INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  console.log(`Database initialised at ${dbPath}`)
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialised — call initDb() first')
  return db
}
