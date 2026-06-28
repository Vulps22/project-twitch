import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer } from 'ws';
import { createServer, type Server } from 'http';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Logger from './utils/Logger.js';
import assetCacheService, { CACHE_ROOT } from './services/AssetCacheService.js';
import eventStorage from './EventStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: Express = express();
const PORT = parseInt(process.env.PORT ?? '', 10);
if (isNaN(PORT)) throw new Error('PORT must be set in environment');

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;
if (!DASHBOARD_PASSWORD) throw new Error('DASHBOARD_PASSWORD must be set in environment');

const sessions = new Set<string>();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};
    return Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [k, ...v] = c.trim().split('=');
            return [k.trim(), v.join('=').trim()];
        })
    );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session && sessions.has(cookies.session)) {
        next();
        return;
    }
    if (req.headers.accept?.includes('application/json')) {
        res.status(401).json({ error: 'Unauthorised' });
    } else {
        res.redirect('/login');
    }
}

const server: Server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
const dashboardWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const pathname = req.url?.split('?')[0];
    if (pathname === '/ws/overlay') {
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else if (pathname === '/ws/dashboard') {
        const cookies = parseCookies(req.headers.cookie);
        if (!cookies.session || !sessions.has(cookies.session)) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        dashboardWss.handleUpgrade(req, socket, head, (ws) => dashboardWss.emit('connection', ws, req));
    } else {
        socket.destroy();
    }
});

wss.on('connection', (ws) => {
    Logger.info('Overlay connected');
    assetCacheService.onConnect();
    void assetCacheService.ensureReady(eventStorage.getAll());

    ws.send(JSON.stringify({ type: 'connection', message: 'Connected to backend' }));

    ws.on('message', (data) => {
        Logger.debug('Received from overlay:', data.toString());
    });

    ws.on('close', () => {
        Logger.info('Overlay disconnected');
        assetCacheService.onDisconnect();
    });
});

dashboardWss.on('connection', (ws) => {
    Logger.info('Dashboard connected');
    assetCacheService.onConnect();
    ws.on('close', () => {
        Logger.info('Dashboard disconnected');
        assetCacheService.onDisconnect();
    });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Public routes — overlay and OBS browser source have no session
app.use('/overlay', express.static(join(__dirname, '../../overlay')));
app.use('/assets', express.static(join(__dirname, '../../assets')));
app.use('/cache', express.static(CACHE_ROOT));

function loginPage(error = false): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StreamerCommander — Login</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0e0e10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #efeff1;
    }
    .card {
      background: #18181b;
      border: 1px solid #2d2d30;
      border-radius: 8px;
      padding: 2rem;
      width: 100%;
      max-width: 360px;
    }
    h1 { font-size: 1.25rem; color: #bf94ff; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.8rem; color: #adadb8; margin-bottom: 0.4rem; }
    input[type="password"] {
      width: 100%;
      padding: 0.6rem 0.75rem;
      background: #0e0e10;
      border: 1px solid #2d2d30;
      border-radius: 4px;
      color: #efeff1;
      font-size: 1rem;
      margin-bottom: 1rem;
    }
    input[type="password"]:focus { outline: none; border-color: #bf94ff; }
    button {
      width: 100%;
      padding: 0.65rem;
      background: #bf94ff;
      color: #0e0e10;
      font-weight: 600;
      font-size: 0.95rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover { background: #a970ff; }
    .error { color: #ff6b6b; font-size: 0.85rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>StreamerCommander</h1>
    ${error ? '<p class="error">Incorrect password.</p>' : ''}
    <form method="POST" action="/auth/login">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

app.get('/login', (req: Request, res: Response) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'");
    res.send(loginPage(req.query.error === '1'));
});

// Redirect stale GET /auth/login (e.g. browser refresh after a failed POST)
app.get('/auth/login', (_req: Request, res: Response) => {
    res.redirect('/login');
});

app.post('/auth/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (password !== DASHBOARD_PASSWORD) {
        res.redirect('/login?error=1');
        return;
    }
    const sessionId = randomUUID();
    sessions.add(sessionId);
    res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/`);
    res.redirect('/dashboard');
});

app.post('/auth/logout', (req: Request, res: Response) => {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session) sessions.delete(cookies.session);
    res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
    res.redirect('/login');
});

// Protected dashboard
app.use('/dashboard', requireAuth, (_req, _res, next) => {
    void assetCacheService.ensureReady(eventStorage.getAll());
    next();
});
app.use('/dashboard', express.static(join(__dirname, '../../dashboard')));

app.get('/', (_req: Request, res: Response) => {
    res.redirect('/dashboard');
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

server.listen(PORT, () => {
    Logger.info(`Server running on http://localhost:${PORT}`);
    Logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

export { wss, dashboardWss, app, server };
