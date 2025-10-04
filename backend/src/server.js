import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Logger from './utils/Logger.js';

const app = express();
const PORT = 3000;

// Create HTTP server (needed for WebSocket)
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    Logger.info('Overlay connected');
    
    // Send a test message to the overlay
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to backend'
    }));
    
    // Listen for messages from overlay (if needed)
    ws.on('message', (data) => {
        Logger.debug('Received from overlay:', data.toString());
    });
    
    // Handle disconnect
    ws.on('close', () => {
        Logger.info('Overlay disconnected');
    });
});

// Express routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
server.listen(PORT, () => {
    Logger.info(`Server running on http://localhost:${PORT}`);
    Logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

// Export WebSocket server for other modules to use
export { wss, app, server };