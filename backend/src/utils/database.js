// Database Module - SQLite Operations
// Handles user points and transaction tracking

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path (go up 3 levels: utils -> src -> backend -> root, then into backend/data)
const DB_PATH = join(__dirname, '..', '..', 'data', 'twitch.db');

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
        
        // Create tables
        createTables();
        
        // Create indexes
        createIndexes();
        
        Logger.info('Database initialized successfully:', DB_PATH);
        return true;
        
    } catch (error) {
        Logger.error('Failed to initialize database:', error);
        throw error;
    }
}

// Create database tables
function createTables() {
    // Users table
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            twitch_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;
    
    // Transactions table
    const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            refunded BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(twitch_id)
        )
    `;
    
    db.exec(createUsersTable);
    db.exec(createTransactionsTable);
    
    Logger.info('Database tables created successfully');
}

// Create database indexes for performance
function createIndexes() {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_user_transactions ON transactions(user_id, timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_timestamp ON transactions(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_refunded ON transactions(refunded)',
        'CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen)'
    ];
    
    indexes.forEach(indexSql => {
        try {
            db.exec(indexSql);
        } catch (error) {
            Logger.warn('Index creation warning:', error.message);
        }
    });
    
    Logger.info('Database indexes created successfully');
}

// Get user by Twitch ID
export function getUser(twitchId) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare('SELECT * FROM users WHERE twitch_id = ?');
        const user = stmt.get(twitchId);
        return user || null;
    } catch (error) {
        Logger.error('Error getting user:', error);
        throw error;
    }
}

// Create new user
export function createUser(twitchId, username) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare(`
            INSERT INTO users (twitch_id, username, points, last_seen)
            VALUES (?, ?, 0, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(twitchId, username);
        Logger.info('User created:', { twitch_id: twitchId, username });
        return result.changes > 0;
    } catch (error) {
        Logger.error('Error creating user:', error);
        throw error;
    }
}

// Get user's current points balance
export function getUserPoints(twitchId) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare('SELECT points FROM users WHERE twitch_id = ?');
        const result = stmt.get(twitchId);
        return result ? result.points : null;
    } catch (error) {
        Logger.error('Error getting user points:', error);
        throw error;
    }
}

// Add points to user (positive amount)
export function addPoints(twitchId, amount, reason) {
    if (!db) throw new Error('Database not initialized');
    if (amount <= 0) throw new Error('Amount must be positive for adding points');
    
    try {
        // Start transaction
        const transaction = db.transaction(() => {
            // Update user points
            const updateStmt = db.prepare(`
                UPDATE users 
                SET points = points + ?, last_seen = CURRENT_TIMESTAMP 
                WHERE twitch_id = ?
            `);
            const updateResult = updateStmt.run(amount, twitchId);
            
            if (updateResult.changes === 0) {
                throw new Error('User not found');
            }
            
            // Log transaction
            const logStmt = db.prepare(`
                INSERT INTO transactions (user_id, amount, reason, timestamp)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            logStmt.run(twitchId, amount, reason);
        });
        
        transaction();
        Logger.info('Points added:', { twitch_id: twitchId, amount, reason });
        return true;
        
    } catch (error) {
        Logger.error('Error adding points:', error);
        throw error;
    }
}

// Spend points (deduct from user balance)
export function spendPoints(twitchId, amount, reason) {
    if (!db) throw new Error('Database not initialized');
    if (amount <= 0) throw new Error('Amount must be positive for spending points');
    
    try {
        // Start transaction
        const transaction = db.transaction(() => {
            // Check current balance
            const balanceStmt = db.prepare('SELECT points FROM users WHERE twitch_id = ?');
            const user = balanceStmt.get(twitchId);
            
            if (!user) {
                throw new Error('User not found');
            }
            
            if (user.points < amount) {
                throw new Error('Insufficient points');
            }
            
            // Deduct points
            const updateStmt = db.prepare(`
                UPDATE users 
                SET points = points - ?, last_seen = CURRENT_TIMESTAMP 
                WHERE twitch_id = ?
            `);
            updateStmt.run(amount, twitchId);
            
            // Log transaction (negative amount for spending)
            const logStmt = db.prepare(`
                INSERT INTO transactions (user_id, amount, reason, timestamp)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `);
            logStmt.run(twitchId, -amount, reason);
        });
        
        transaction();
        Logger.info('Points spent:', { twitch_id: twitchId, amount, reason });
        return true;
        
    } catch (error) {
        Logger.error('Error spending points:', error);
        throw error;
    }
}

// Log a transaction (manual transaction logging)
export function logTransaction(twitchId, amount, reason) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare(`
            INSERT INTO transactions (user_id, amount, reason, timestamp)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(twitchId, amount, reason);
        Logger.info('Transaction logged:', { twitch_id: twitchId, amount, reason });
        return result.changes > 0;
    } catch (error) {
        Logger.error('Error logging transaction:', error);
        throw error;
    }
}

// Get user's transaction history (optional for Stage 2)
export function getTransactions(twitchId, limit = 50) {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const stmt = db.prepare(`
            SELECT * FROM transactions 
            WHERE user_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        
        const transactions = stmt.all(twitchId, limit);
        return transactions;
    } catch (error) {
        Logger.error('Error getting transactions:', error);
        throw error;
    }
}

// Get database statistics (useful for debugging)
export function getDatabaseStats() {
    if (!db) throw new Error('Database not initialized');
    
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const transactionCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
        const totalPoints = db.prepare('SELECT SUM(points) as total FROM users').get().total || 0;
        
        return {
            users: userCount,
            transactions: transactionCount,
            totalPoints: totalPoints
        };
    } catch (error) {
        Logger.error('Error getting database stats:', error);
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