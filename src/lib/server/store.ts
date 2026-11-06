import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppData } from '../types';
import { partyName } from '../parties';

export interface Snapshot { data: AppData; revision: number }
let database: DatabaseSync | undefined;

function initialData(): AppData {
  const now = new Date().toISOString();
  return {
    members: [], queues: [], runs: [],
    rounds: [{ id: randomUUID(), number: 1, label: 'รอบแรก', status: 'open', createdAt: now }],
    parties: [
      { id: 'party-a', name: partyName('party-a'), leader: 'หัวหน้า', color: '#a78bfa' },
      { id: 'party-b', name: partyName('party-b'), leader: 'หัวหน้า', color: '#22d3ee' },
      { id: 'party-c', name: partyName('party-c'), leader: 'หัวหน้า', color: '#f59e0b' },
    ],
    capacities: { 1: 2, 2: 2, 3: 2, 4: 1, 5: 1 },
    activity: [{ id: randomUUID(), timestamp: now, detail: 'เปิดรับคิวรอบที่ 1' }],
  };
}

function db() {
  if (database) return database;
  const path = resolve(process.env.DATABASE_PATH || './data/guild-queue.sqlite');
  mkdirSync(dirname(path), { recursive: true });
  database = new DatabaseSync(path);
  database.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL CHECK (json_valid(data))
    );
  `);
  database.prepare('INSERT OR IGNORE INTO app_state (id, data) VALUES (1, ?)').run(JSON.stringify(initialData()));
  return database;
}

export function readSnapshot(): Snapshot {
  const row = db().prepare('SELECT data, revision FROM app_state WHERE id = 1').get() as { data: string; revision: number };
  return { data: JSON.parse(row.data) as AppData, revision: row.revision };
}

// Every command reads and validates the latest state while holding the write lock.
// Clients never submit replacement snapshots, so simultaneous tabs cannot lose updates.
export function transact(change: (data: AppData) => void): Snapshot {
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try {
    const snapshot = readSnapshot();
    change(snapshot.data);
    snapshot.revision += 1;
    connection.prepare('UPDATE app_state SET data = ?, revision = ? WHERE id = 1')
      .run(JSON.stringify(snapshot.data), snapshot.revision);
    connection.exec('COMMIT');
    return snapshot;
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}
