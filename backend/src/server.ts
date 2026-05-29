import express, { type Express, type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { createServer, type Server } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();
const PORT = 3001;

const server: Server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    Logger.info('Overlay connected');

    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to backend' }));

    ws.on('message', (data) => {
        Logger.debug('Received from overlay:', data.toString());
    });

    ws.on('close', () => {
        Logger.info('Overlay disconnected');
    });
});

app.use(express.json());
app.use('/overlay', express.static(join(__dirname, '../../overlay')));
app.use('/assets', express.static(join(__dirname, '../../assets')));
app.use('/dashboard', express.static(join(__dirname, '../../dist/dashboard')));

app.get('/', (_req: Request, res: Response) => {
    res.redirect('/overlay');
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

server.listen(PORT, () => {
    Logger.info(`Server running on http://localhost:${PORT}`);
    Logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

export { wss, app, server };
