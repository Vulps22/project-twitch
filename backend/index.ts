#!/usr/bin/env node

import 'dotenv/config';
import { type Request, type Response } from 'express';
import { TwitchClient } from './src/twitch-client.js';
import { EventRouter } from './src/EventRouter.js';
import OverlayBroadcasterService from './src/services/OverlayBroadcasterService.js';
import { EVENTS } from './config/events.js';
import Logger from './src/utils/Logger.js';
import sessionStats from './src/SessionStats.js';
import eventLog from './src/EventLog.js';
import eventStorage from './src/EventStorage.js';
import { wss, app } from './src/server.js';

Logger.info('Starting Twitch project backend...');

await eventStorage.load();

let twitchClient: TwitchClient | null = null;
let overlayBroadcasterService: OverlayBroadcasterService | null = null;
let eventRouter: EventRouter | null = null;

try {
    overlayBroadcasterService = new OverlayBroadcasterService(wss);

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

        eventRouter.setTwitchClient(twitchClient);

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

app.get('/api/events', (_req: Request, res: Response) => {
    res.json(eventStorage.getAll());
});

app.delete('/api/events/:name', async (req: Request, res: Response) => {
    const deleted = await eventStorage.delete(req.params.name);
    if (!deleted) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
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

export { twitchClient, overlayBroadcasterService, eventRouter };
