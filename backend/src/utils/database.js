// Database Module - SQLite Operations
// Points system has been removed. This module will be used for the events log feature.

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path (go up 3 levels: utils -> src -> backend -> root, then into backend/data)
const DB_PATH = join(__dirname, '..', '..', 'data', 'twitch.db');

/**
 * @type {Database.Database}
 */
let db = null;

// Initialize database connection and create tables
export async function initDatabase() {
    try {
        // Create data directory if it doesn't exist
        const fs = await import('fs');
        const dataDir = join(__dirname, '..', '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // Open database connection
        db = new Database(DB_PATH);

        // Enable foreign keys
        db.pragma('foreign_keys = ON');

        Logger.info('Database initialized successfully:', DB_PATH);
        return true;

    } catch (error) {
        Logger.error('Failed to initialize database:', error);
        throw error;
    }
}

// Close database connection
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        Logger.info('Database connection closed');
    }
}

// Export database instance for advanced operations (if needed)
export function getDatabase() {
    return db;
}

// Initialize database on module load
await initDatabase();
