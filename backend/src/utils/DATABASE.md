# Database Module

SQLite database operations for user points and transaction tracking.

## Location
`backend/src/utils/database.js`

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    twitch_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Transactions Table  
```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,  -- Positive for earning, negative for spending
    reason TEXT NOT NULL,      -- "command:lurk", "accrual", "refund", etc.
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refunded BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(twitch_id)
);
```

## Available Functions

### User Operations
- `getUser(twitchId)` - Get user by Twitch ID
- `createUser(twitchId, username)` - Create new user
- `getUserPoints(twitchId)` - Get user's current points balance

### Points Operations  
- `addPoints(twitchId, amount, reason)` - Add points to user (positive amount)
- `spendPoints(twitchId, amount, reason)` - Spend/deduct points (positive amount)

### Transaction Operations
- `logTransaction(twitchId, amount, reason)` - Log manual transaction
- `getTransactions(twitchId, limit=50)` - Get user's transaction history

### Utility Operations
- `getDatabaseStats()` - Get database statistics
- `initDatabase()` - Initialize database (called automatically)
- `closeDatabase()` - Close database connection

## Usage Example

```javascript
import { 
    getUser, 
    createUser, 
    getUserPoints, 
    addPoints, 
    spendPoints 
} from './backend/src/utils/database.js';

// Create or get user
let user = getUser('twitch_user_123');
if (!user) {
    await createUser('twitch_user_123', 'Username');
}

// Check points
const points = getUserPoints('twitch_user_123');

// Add points
await addPoints('twitch_user_123', 100, 'accrual:watching');

// Spend points
try {
    await spendPoints('twitch_user_123', 50, 'command:lurk');
    console.log('Points spent successfully');
} catch (error) {
    console.log('Insufficient points:', error.message);
}
```

## Database File
- Location: `backend/data/twitch.db`
- Created automatically on first run
- Contains user data - added to .gitignore

## Error Handling
- All functions throw errors for invalid operations
- `spendPoints()` throws "Insufficient points" if balance too low
- `createUser()` throws constraint error for duplicate users
- Database operations are wrapped in transactions for consistency