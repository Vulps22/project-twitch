#!/usr/bin/env node

import 'dotenv/config';
import { type Request, type Response } from 'express';
import { TwitchClient } from './src/twitch-client.js';
import { EventRouter } from './src/EventRouter.js';
import OverlayBroadcasterService from './src/services/OverlayBroadcasterService.js';
import DashboardBroadcasterService from './src/services/DashboardBroadcasterService.js';
import { EVENTS } from './config/events.js';
import Logger from './src/utils/Logger.js';
import sessionStats from './src/SessionStats.js';
import eventLog from './src/EventLog.js';
import eventStorage from './src/EventStorage.js';
import viewerTracker from './src/ViewerTracker.js';
import { wss, dashboardWss, app } from './src/server.js';

Logger.info('Starting Twitch project backend...');

await eventStorage.load();

let twitchClient: TwitchClient | null = null;
let overlayBroadcasterService: OverlayBroadcasterService | null = null;
let dashboardBroadcasterService: DashboardBroadcasterService | null = null;
let eventRouter: EventRouter | null = null;

try {
    overlayBroadcasterService = new OverlayBroadcasterService(wss);
    dashboardBroadcasterService = new DashboardBroadcasterService(dashboardWss);
    viewerTracker.setDashboardBroadcaster(dashboardBroadcasterService);

    if (process.env.TWITCH_ACCESS_TOKEN && process.env.TWITCH_CLIENT_ID) {
        eventRouter = new EventRouter(null, overlayBroadcasterService);
        await eventRouter.init();
        eventRouter.setConfigs(EVENTS);

        twitchClient = new TwitchClient({
            accessToken: process.env.TWITCH_ACCESS_TOKEN,
            broadcasterToken: process.env.TWITCH_BROADCASTER_TOKEN,
            clientId: process.env.TWITCH_CLIENT_ID,
            channelName: process.env.TWITCH_CHANNEL_NAME,
            overlayBroadcasterService,
            eventRouter
        });

        await twitchClient.whenReady();
        eventRouter.setTwitchClient(twitchClient);
        viewerTracker.setTwitchClient(twitchClient);
        void viewerTracker.startPolling();

        Logger.info('All services initialised');
    } else {
        Logger.warn('Twitch credentials not found — set TWITCH_ACCESS_TOKEN, TWITCH_CLIENT_ID, TWITCH_CHANNEL_NAME');
    }
} catch (error) {
    Logger.error('Failed to initialise services:', error instanceof Error ? error.message : String(error));
}

app.get('/api/stream/stats', async (_req: Request, res: Response) => {
    const [stream, followers, subscribers] = twitchClient
        ? await Promise.all([
            twitchClient.getStreamInfo(),
            twitchClient.getFollowerCount(),
            twitchClient.getSubscriberCount(),
        ])
        : [null, null, null];

    res.json({ stream, followers, subscribers, session: sessionStats.snapshot() });
});

app.get('/api/log', (_req: Request, res: Response) => {
    res.json(eventLog.getAll());
});

app.post('/api/log/:id/replay', async (req: Request, res: Response) => {
    const entry = eventLog.getById(String(req.params.id));
    if (!entry) {
        res.status(404).json({ error: 'Log entry not found' });
        return;
    }
    if (!eventRouter) {
        res.status(503).json({ error: 'Event router not available' });
        return;
    }
    await eventRouter.route({ subscriptionType: entry.subscriptionType, event: entry.data }, true);
    res.json({ ok: true });
});

app.post('/api/events/:name/test', async (req: Request, res: Response) => {
    const config = eventStorage.getAll().find(e => e.event_name === req.params.name);
    if (!config) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
    if (!eventRouter) {
        res.status(503).json({ error: 'Event router not available' });
        return;
    }

    const fakeTemplateData = {
        username:     'test_user',
        display_name: 'Test User',
        user_id:      '00000',
        count:        '1',
        tier:         '1000',
        followed_at:  new Date().toISOString(),
    };

    await eventRouter.executeConfig(config, fakeTemplateData);

    eventLog.append({
        eventName:        config.event_name,
        eventType:        config.event_type,
        subscriptionType: 'test',
        username:         'test_user',
        detail:           `Test of "${config.event_name}"`,
        data:             { test: true },
        test:             true,
    });

    res.json({ ok: true });
});

app.get('/api/events', (_req: Request, res: Response) => {
    res.json(eventStorage.getAll());
});

app.post('/api/events', async (req: Request, res: Response) => {
    const config = req.body;
    if (!config?.event_name || !config?.event_type) {
        res.status(400).json({ error: 'event_name and event_type are required' });
        return;
    }
    const created = await eventStorage.create(config);
    if (!created) {
        res.status(409).json({ error: 'Event already exists' });
        return;
    }
    res.status(201).json({ ok: true });
});

app.put('/api/events/:name', async (req: Request, res: Response) => {
    const updated = await eventStorage.update(req.params.name, req.body);
    if (!updated) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
    res.json({ ok: true });
});

app.delete('/api/events/:name', async (req: Request, res: Response) => {
    const deleted = await eventStorage.delete(req.params.name);
    if (!deleted) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
    res.json({ ok: true });
});

app.get('/api/viewers', (_req: Request, res: Response) => {
    res.json(viewerTracker.getViewers());
});

app.post('/api/mod/timeout/:userId', async (req: Request, res: Response) => {
    if (!twitchClient) { res.status(503).json({ error: 'Twitch client not connected' }); return; }
    const { duration } = req.body as { duration: number };
    if (typeof duration !== 'number' || duration <= 0) {
        res.status(400).json({ error: 'duration must be a positive number' });
        return;
    }
    await twitchClient.timeout(req.params.userId, duration);
    res.json({ ok: true });
});

app.post('/api/mod/ban/:userId', async (req: Request, res: Response) => {
    if (!twitchClient) { res.status(503).json({ error: 'Twitch client not connected' }); return; }
    const { reason } = req.body as { reason?: string };
    await twitchClient.ban(req.params.userId, reason);
    res.json({ ok: true });
});

app.get('/api/status', (_req: Request, res: Response) => {
    const twitchStatus = twitchClient?.getStatus() ?? {
        bot: { connected: false },
        broadcaster: { connected: false, configured: !!process.env.TWITCH_BROADCASTER_TOKEN },
    };
    res.json({
        overlay: { connected: wss.clients.size > 0, clientCount: wss.clients.size },
        ...twitchStatus,
    });
});

export { twitchClient, overlayBroadcasterService, dashboardBroadcasterService, eventRouter };
