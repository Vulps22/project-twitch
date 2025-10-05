import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3001;

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

// Serve static files
app.use('/overlay', express.static(join(__dirname, '../../overlay')));
app.use('/assets', express.static(join(__dirname, '../../assets')));

// Express routes
app.get('/', (req, res) => {
    res.redirect('/overlay');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Points system API endpoints
app.get('/api/points/stats', async (req, res) => {
    try {
        const { pointsManagerService } = await import('../index.js');
        if (pointsManagerService) {
            const stats = pointsManagerService.getStats();
            res.json(stats);
        } else {
            res.status(503).json({ error: 'Points system not initialized' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Points system not available' });
    }
});

app.get('/api/points/viewers', async (req, res) => {
    try {
        const { pointsManagerService, twitchClient } = await import('../index.js');
        if (pointsManagerService && twitchClient) {
            const twitchViewers = await twitchClient.getUserList();
            const viewers = pointsManagerService.getActiveViewers();
            res.json({ activeViewers: viewers, twitchViewers: twitchViewers });
        } else {
            res.status(503).json({ error: 'Points system not initialized' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Points system not available' });
    }
});

app.get('/api/database/stats', async (req, res) => {
    try {
        const { getDatabaseStats } = await import('../utils/database.js');
        const stats = getDatabaseStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Database not available' });
    }
});

// Start server
server.listen(PORT, () => {
    Logger.info(`Server running on http://localhost:${PORT}`);
    Logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

// Export WebSocket server for other modules to use
export { wss, app, server };