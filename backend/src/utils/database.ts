import Database from 'better-sqlite3';
import { join } from 'path';
import * as fs from 'fs';
import Logger from './Logger.js';

const DB_PATH = join(process.cwd(), 'backend', 'data', 'twitch.db');
const DATA_DIR = join(process.cwd(), 'backend', 'data');

let db: Database.Database | null = null;

export async function initDatabase(): Promise<boolean> {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        db = new Database(DB_PATH);
        db.pragma('foreign_keys = ON');

        Logger.info('Database initialized successfully:', DB_PATH);
        return true;

    } catch (error) {
        Logger.error('Failed to initialize database:', error);
        throw error;
    }
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        Logger.info('Database connection closed');
    }
}

export function getDatabase(): Database.Database | null {
    return db;
}

await initDatabase();
