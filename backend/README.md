# Twitch Backend Setup

This backend integrates with Twitch EventSub to listen for chat messages and follow events.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Twitch Credentials

1. Copy the example environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Edit `backend/.env` with your Twitch credentials:
   ```env
   TWITCH_CLIENT_ID=your_client_id_here
   TWITCH_ACCESS_TOKEN=your_access_token_here
   TWITCH_CHANNEL_NAME=target_channel_name
   ```

### 3. Get Twitch Credentials

#### Client ID:
1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Create a new application or use an existing one
3. Copy the Client ID

#### Access Token:
You need an OAuth token with these scopes:
- `user:read:chat`
- `channel:read:subscriptions` 
- `moderator:read:followers`
- `user:write:chat`

**Option A: Using Twitch CLI (Recommended)**
```bash
# Install Twitch CLI
# Then authenticate and get token
twitch token -u -s "user:read:chat channel:read:subscriptions moderator:read:followers user:write:chat"
```

**Option B: Manual OAuth Flow**
- Use the Twitch OAuth documentation to implement the flow
- Make sure to request the required scopes

### 4. Run the Server
```bash
npm start
```

The server will:
- Start on **http://localhost:3001** (updated port)
- Connect to Twitch EventSub WebSocket if credentials are provided
- Listen for chat messages and follow events
- Provide WebSocket endpoint for overlays at **ws://localhost:3001**
- Serve overlay files at http://localhost:3001/overlay
- Serve media assets at http://localhost:3001/assets

## Usage

### Basic Usage
The TwitchClient is automatically instantiated in `backend/index.js` if credentials are available.

### Custom Event Handling
See `backend/src/twitch-usage-example.js` for examples of how to:
- Access the Twitch client from other modules
- Add custom event handlers
- Integrate with your overlay system

## API Documentation

### HTTP Endpoints

#### Static Content
- `GET /` - Redirects to `/overlay`
- `GET /overlay/*` - Serves overlay static files
- `GET /assets/*` - Serves audio/video assets

#### Health & Status
- `GET /health` - Health check endpoint
  ```json
  Response: { "status": "ok" }
  ```

#### Points System API
**Note:** Points system can be disabled in `config/points.js` by setting `enabled: false`

- `GET /api/points/stats` - Get points system statistics
  ```json
  Response (when enabled): {
    "totalUsers": 42,
    "totalPointsAwarded": 15420,
    "activeUsers": 8
  }
  Response (when disabled): { "error": "Points system is disabled" }
  ```

- `GET /api/points/viewers` - Get current viewers and their activity
  ```json
  Response (when enabled): {
    "activeViewers": [
      { "twitchId": "12345", "username": "viewer1", "lastSeen": "2025-10-16T..." }
    ],
    "twitchViewers": [
      { "user_id": "12345", "user_name": "viewer1", "user_display_name": "Viewer1" }
    ]
  }
  Response (when disabled): { "error": "Points system is disabled" }
  ```

#### Database API
- `GET /api/database/stats` - Get database statistics
  ```json
  Response: {
    "totalUsers": 42,
    "totalTransactions": 156,
    "databaseSize": "2.1 MB"
  }
  ```

### WebSocket API

**Connection:** `ws://localhost:3001`

#### Client → Server Messages
Currently, the server accepts but doesn't process client messages (reserved for future use).

#### Server → Client Messages

##### Connection Confirmation
```json
{
  "type": "connection",
  "message": "Connected to backend"
}
```

##### Command Execution Events
```json
{
  "type": "command",
  "command_name": "lurk",
  "image": "lurk.png",
  "sound": "lurk.mp3",
  "video": null,
  "volume": 5.0,
  "text": "User123 is now lurking!",
  "transition_in": "fadeIn",
  "transition_out": "fadeOut", 
  "timeout": 5000
}
```

##### Chat Events (if enabled)
```json
{
  "type": "chat_message",
  "user_id": "12345",
  "username": "viewer1",
  "display_name": "Viewer1",
  "message": "Hello world!",
  "timestamp": "2025-10-16T..."
}
```

##### Follow Events (if enabled)
```json
{
  "type": "channel.follow",
  "user_id": "12345",
  "user_name": "newfollower",
  "user_display_name": "NewFollower",
  "followed_at": "2025-10-16T..."
}
```

### Error Responses

All API endpoints may return these error responses:

- `503 Service Unavailable` - Service not initialized
  ```json
  { "error": "Points system not initialized" }
  ```

- `500 Internal Server Error` - Service unavailable
  ```json
  { "error": "Points system not available" }
  ```

## Configuration

### Points System
Configure the points system in `config/points.js`:

```javascript
export const POINTS_CONFIG = {
    enabled: true,                       // Enable/disable the entire points system
    POINTS_PER_MINUTE: 10,              // Points awarded per minute
    ACTIVITY_TIMEOUT: 5 * 60 * 1000,    // 5 minutes in milliseconds
    ACCRUAL_INTERVAL: 60 * 1000         // 1 minute in milliseconds
};
```

**Note:** Setting `enabled: false` will:
- Disable all point costs for commands
- Stop point accrual for viewers
- Return "disabled" messages from points API endpoints
- Skip all database operations related to points

### Commands
Configure chat commands in `config/commands.js`. Each command can have:
- `cost`: Point cost (ignored if points system disabled)
- `reply`: Chat response message
- `sound`: Audio file to play in overlay
- `image`: Image to display in overlay
- `video`: Video file to play in overlay
- `volume`: Audio volume (0.0 to 10.0)
- `timeout`: How long to display content (ms)

## File Structure
```
backend/
├── index.js                    # Main entry point
├── .env.example               # Environment variables template
├── config/
│   ├── commands.js            # Chat command configuration
│   ├── events.js              # Twitch event configuration
│   └── points.js              # Points system configuration
├── data/
│   └── twitch.db              # SQLite database (auto-created)
├── src/
│   ├── server.js              # Express + WebSocket server
│   ├── twitch-client.js       # Twitch EventSub client
│   ├── base/
│   │   └── Handler.js         # Base handler class
│   ├── handlers/
│   │   ├── TwitchCommandHandler.js  # Chat command processor
│   │   └── TwitchEventHandler.js    # Event processor
│   ├── services/
│   │   ├── OverlayBroadcasterService.js  # WebSocket broadcaster
│   │   └── PointsManagerService.js       # Points management
│   └── utils/
│       ├── database.js        # Database operations
│       └── Logger.js          # Safe logging utility
```

## Troubleshooting

### "Access token and client ID are required"
- Make sure your `.env` file exists in the `backend/` directory
- Check that `TWITCH_ACCESS_TOKEN` and `TWITCH_CLIENT_ID` are set

### "Failed to get user ID"
- Your access token might be expired or invalid
- Make sure the token has the required scopes

### WebSocket connection issues
- Check that port 3000 is not in use by another application
- Verify firewall settings if connecting from external clients