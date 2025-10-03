import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const PORT = 3000;

// Create HTTP server (needed for WebSocket)
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('Overlay connected');
    
    // Send a test message to the overlay
    ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to backend'
    }));
    
    // Listen for messages from overlay (if needed)
    ws.on('message', (data) => {
        console.log('Received from overlay:', data.toString());
    });
    
    // Handle disconnect
    ws.on('close', () => {
        console.log('Overlay disconnected');
    });
});

// Express routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});