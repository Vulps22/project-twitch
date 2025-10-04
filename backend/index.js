#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

// Import services and components
import { TwitchClient } from './src/twitch-client.js';
import OverlayBroadcasterService from './src/services/OverlayBroadcasterService.js';
import PointsManagerService from './src/services/PointsManagerService.js';
import Logger from './src/utils/Logger.js';

// Import and start server (this also sets up WebSocket)
import { wss } from './src/server.js';

Logger.info('Starting Twitch project backend...');

// Global references (accessible throughout the app)
let twitchClient = null;
let overlayBroadcasterService = null;
let pointsManagerService = null;

// Initialize services
try {
    // Set up overlay broadcaster service with WebSocket server
    overlayBroadcasterService = new OverlayBroadcasterService(wss);
    Logger.info('Overlay broadcaster service initialized');

    // Set up points manager service
    pointsManagerService = new PointsManagerService();
    Logger.info('Points manager service initialized');

    // Initialize Twitch client if credentials are available
    if (process.env.TWITCH_ACCESS_TOKEN && process.env.TWITCH_CLIENT_ID) {
        Logger.info('Initializing Twitch EventSub client...');
        
        twitchClient = new TwitchClient({
            accessToken: process.env.TWITCH_ACCESS_TOKEN,
            clientId: process.env.TWITCH_CLIENT_ID,
            channelName: process.env.TWITCH_CHANNEL_NAME, // optional
            overlayBroadcasterService: overlayBroadcasterService,
            pointsManagerService: pointsManagerService
        });

        pointsManagerService.setTwitchClient(twitchClient);
        
        // Wire up dependencies: TwitchClient now has access to overlay broadcaster
        // The command handler will get these dependencies injected
        Logger.info('Wiring up service dependencies...');
        
        Logger.info('Twitch client initialized successfully!');
        
        // Start points accrual system
        pointsManagerService.start();
        Logger.info('Points accrual system started');
        
    } else {
        Logger.warn('Twitch credentials not found in environment variables.');
        Logger.info('To enable Twitch integration, set:');
        Logger.info('- TWITCH_ACCESS_TOKEN');
        Logger.info('- TWITCH_CLIENT_ID');
        Logger.info('- TWITCH_CHANNEL_NAME (optional)');
    }
} catch (error) {
    Logger.error('Failed to initialize services:', error.message);
    // Don't exit - let the server run without Twitch integration
}

// Export services so other modules can access them
export { twitchClient, overlayBroadcasterService, pointsManagerService };