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
- Start on http://localhost:3000
- Connect to Twitch EventSub WebSocket if credentials are provided
- Listen for chat messages and follow events
- Provide WebSocket endpoint for overlays at ws://localhost:3000

## Usage

### Basic Usage
The TwitchClient is automatically instantiated in `backend/index.js` if credentials are available.

### Custom Event Handling
See `backend/src/twitch-usage-example.js` for examples of how to:
- Access the Twitch client from other modules
- Add custom event handlers
- Integrate with your overlay system

### Available Endpoints
- `GET /health` - Health check endpoint

### WebSocket Events
The server broadcasts Twitch events to connected WebSocket clients (overlays):
- Chat messages
- Follow events
- Connection status

## File Structure
```
backend/
├── index.js                    # Main entry point
├── .env.example               # Environment variables template
├── src/
│   ├── server.js              # Express + WebSocket server
│   ├── twitch-eventsub.js     # Twitch EventSub client
│   └── twitch-usage-example.js # Usage examples
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