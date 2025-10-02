# Project Twitch - Development Roadmap

## Overview
A local OBS plugin providing soundboard functionality with a points-based redemption system for Twitch streamers, particularly targeting non-affiliates who lack access to Channel Points.

## Architecture

### Hybrid Approach
- **C++ OBS Plugin**: Thin wrapper (process management, UI hosting, IPC)
- **Node.js Backend**: All business logic, database, Twitch integration
- **Web UI**: Control panel for management (embedded in OBS dock)
- **Browser Overlay**: Visual feedback (existing overlay code, display-only)

### Project Structure
```
project-twitch/
├── plugin/              # C++ OBS plugin (thin wrapper)
│   ├── CMakeLists.txt
│   ├── main.cpp
│   └── ipc.cpp
├── backend/             # Node.js server
│   ├── server.js        # Main server + WebSocket
│   ├── database.js      # SQLite operations
│   ├── twitch.js        # EventSub handling
│   └── points.js        # Points accrual/spending logic
├── overlay/             # Browser source overlay (migrated from project-overlay)
│   ├── index.html
│   ├── commands.js
│   ├── events.js
│   └── assets/
└── ui/                  # Control panel web interface
    ├── index.html
    ├── transactions.html
    └── settings.html
```

## Development Stages

### Stage 1: Migrate to Local Node Backend
**Goal**: Get !commands working through Node instead of directly in browser source

**Tasks**:
1. **Create Node.js backend** (`backend/server.js`)
   - Express server with WebSocket support
   - Basic command processing endpoint
   
2. **Migrate Twitch EventSub to Node** (`backend/twitch.js`)
   - Move `twitch-eventsub.js` logic from browser to Node
   - Node handles WebSocket connection to Twitch EventSub
   - Parse chat messages and detect commands
   
3. **Update browser overlay to be display-only** (`overlay/index.html`)
   - Remove Twitch EventSub connection code
   - Add WebSocket client connecting to Node backend (localhost)
   - Listen for messages: `{type: 'command', data: {command, username, ...}}`
   - Render overlays based on received messages
   - Keep all existing rendering/animation code

**Communication Flow**:
```
Twitch Chat → Twitch EventSub → Node Backend → WebSocket → Browser Overlay
```

**Testing**: Type !lurk in Twitch chat, overlay should appear with image/sound. No points system yet.

---

### Stage 2: Points System + Command Costs
**Goal**: Implement local points tracking and command costs

**Tasks**:
1. **Database setup** (`backend/database.js`)
   - SQLite database with tables:
     - `users` (twitch_id, username, points, last_seen)
     - `transactions` (id, user_id, amount, reason, timestamp, refunded)
   - Functions:
     - `accruePoints(userId)` - award points per minute watched
     - `getUserPoints(userId)` - get current balance
     - `spendPoints(userId, amount, reason)` - deduct points
     - `logTransaction(userId, amount, reason)` - record transaction

2. **Points logic** (`backend/points.js`)
   - Track active viewers
   - Auto-accrue points every minute for viewers in chat
   - Point award rate configurable (default: 10 points/minute)

3. **Update command configuration** (`overlay/commands.js`)
   ```javascript
   var COMMANDS = {
       "lurk": {
           "command_name": "lurk",
           "cost": 0,  // Free command
           "image": "lurk.png",
           "sound": "lurk.mp3",
           // ... existing fields
       },
       "airhorn": {
           "command_name": "airhorn",
           "cost": 100,  // Costs 100 points
           "sound": "airhorn.mp3",
           // ... existing fields
       }
   }
   ```

4. **Command execution with points** (`backend/server.js`)
   - On chat command:
     1. Check if command exists
     2. Get user's point balance
     3. If cost > 0 and insufficient balance: send Twitch chat message "Not enough points"
     4. If sufficient: deduct points, execute command, log transaction
     5. Send command data to overlay via WebSocket

**Testing**: 
- Viewers automatically earn points while watching
- Commands with costs can be purchased
- Insufficient balance is handled gracefully

---

### MVP Milestone
At this point you have:
- Working soundboard via chat commands
- Local points system for non-affiliates
- Cost-based redemptions
- All functionality running through Node backend
- Browser source displaying overlays

---

### Stage 3: C++ OBS Plugin Wrapper
**Goal**: Package as native OBS plugin that auto-starts with OBS

**Tasks**:
1. **Minimal C++ plugin** (`plugin/main.cpp`)
   ```cpp
   // Responsibilities:
   - Spawn Node.js process on OBS startup
   - Create OBS dock with embedded web browser (control panel)
   - Setup IPC connection (named pipe or local TCP)
   - Kill Node process on OBS shutdown
   ```

2. **Process management**
   - Bundle Node.js runtime with plugin
   - Launch backend server as child process
   - Handle graceful shutdown

3. **IPC setup** (`plugin/ipc.cpp`)
   - Named pipe or local socket for OBS ↔ Node communication
   - Message format: JSON strings
   - Bidirectional communication channel

4. **Build system** (`plugin/CMakeLists.txt`)
   - Configure OBS SDK paths
   - Link Qt for UI components
   - Bundle Node runtime and backend files

**Testing**: Install plugin in OBS, verify backend starts automatically, control panel dock appears

---

### Stage 4: Transaction Log & Refund System
**Goal**: Management interface for viewing transactions and issuing refunds

**Tasks**:
1. **Transaction log UI** (`ui/transactions.html`)
   - Fetch transactions from Node via REST API
   - Display in sortable/filterable table
   - Search functionality (LIKE query on username/reason)
   - Multi-select with checkboxes
   - Date range filter

2. **Refund functionality** (`backend/database.js`)
   ```javascript
   refundTransaction(transactionId) {
     // Mark transaction as refunded
     // Add points back to user account
     // Log refund transaction
   }
   ```

3. **Refund UI** (`ui/transactions.html`)
   - "Refund Selected" button (top right)
   - Confirmation dialog
   - Bulk refund support
   - Update table after refund

**Testing**:
- View transaction history
- Search for specific transactions
- Select multiple transactions and refund
- Verify points restored to user accounts

---

### Stage 5: Additional Features (Post-MVP)
- **Hotkey support**: Register OBS hotkeys in C++ plugin to trigger sounds manually
- **Sound categories**: Organize sounds into folders/categories
- **Volume controls**: Per-sound volume settings
- **Cooldowns**: Per-command or global cooldowns
- **User permissions**: VIP/Mod/Subscriber multipliers or access
- **Point multipliers**: Events (raids, subs) grant bonus points
- **Export/Import**: Backup points database
- **Analytics**: Most popular sounds, point distribution graphs

---

## Division of Labor

### C++ Plugin (Minimal)
- Process lifecycle management
- Dock/panel hosting
- IPC communication
- Optional: Hotkey registration via OBS API
- Optional: Native audio source

### Node.js Backend
- All business logic
- Database operations (SQLite)
- Twitch EventSub integration
- Points accrual/spending
- Transaction logging
- REST API for UI

### Web UI (Control Panel)
- All data visualization
- User interactions
- Settings management
- Transaction log + refunds
- Sound library management

### Browser Overlay
- Display-only rendering
- Receives commands via WebSocket from Node
- CSS animations and transitions
- Image/video/sound playback

---

## Communication Patterns

```
┌─────────────┐
│ Twitch Chat │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      WebSocket      ┌──────────────────┐
│ Node.js Backend │◄────────────────────►│ Browser Overlay  │
│   (Port 3000)   │                      │  (Display Only)  │
└────────┬────────┘                      └──────────────────┘
         │
         │ IPC (Named Pipe/Local Socket)
         │
         ▼
┌─────────────────┐      Qt WebView      ┌──────────────────┐
│  C++ OBS Plugin │◄────────────────────►│  Control Panel   │
│  (Thin Wrapper) │                      │    (Web UI)      │
└─────────────────┘                      └──────────────────┘
```

---

## Technical Notes

### Database Schema (SQLite)
```sql
CREATE TABLE users (
    twitch_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,  -- Negative for spending, positive for earning
    reason TEXT NOT NULL,      -- "command:lurk", "accrual", "refund", etc.
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refunded BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(twitch_id)
);

CREATE INDEX idx_user_transactions ON transactions(user_id, timestamp);
CREATE INDEX idx_timestamp ON transactions(timestamp);
```

### Node.js Dependencies
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.13.0",
    "better-sqlite3": "^9.0.0",
    "node-fetch": "^3.3.0"
  }
}
```

### C++ Plugin Dependencies
- OBS Studio SDK
- Qt 6 (Widgets, WebEngineView)
- CMake 3.16+

---

## Development Workflow

1. **Start with pure Node.js/Express** - build and test backend independently
2. **Add browser overlay** - test with standalone browser, then OBS browser source
3. **Verify full functionality** - ensure everything works before adding C++ layer
4. **Build C++ wrapper last** - when JavaScript implementation is solid
5. **Package and distribute** - bundle Node runtime with plugin installer

---

## Why This Architecture?

- **95% JavaScript**: Work in your comfort zone (PHP developer background)
- **Rapid iteration**: Web technologies = fast development
- **Easy debugging**: Node.js has excellent debugging tools
- **Minimal C++**: ~100 lines of glue code vs thousands of lines in JS
- **Maintainable**: Business logic separated from native integration
- **Testable**: Each component can be tested independently