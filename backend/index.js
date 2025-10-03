#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

// Import services and components
import { TwitchClient } from './src/twitch-client.js';
import OverlayBroadcaster from './src/services/OverlayBroadcaster.js';
import Logger from './src/utils/Logger.js';

// Import and start server (this also sets up WebSocket)
import { wss } from './src/server.js';

Logger.info('Starting Twitch project backend...');

// Global references (accessible throughout the app)
let twitchClient = null;
let overlayBroadcaster = null;

// Initialize services
try {
    // Set up overlay broadcaster with WebSocket server
    overlayBroadcaster = new OverlayBroadcaster(wss);
    Logger.info('Overlay broadcaster initialized');

    // Initialize Twitch client if credentials are available
    if (process.env.TWITCH_ACCESS_TOKEN && process.env.TWITCH_CLIENT_ID) {
        Logger.info('Initializing Twitch EventSub client...');
        
        twitchClient = new TwitchClient({
            accessToken: process.env.TWITCH_ACCESS_TOKEN,
            clientId: process.env.TWITCH_CLIENT_ID,
            channelName: process.env.TWITCH_CHANNEL_NAME, // optional
            overlayBroadcaster: overlayBroadcaster
        });
        
        // Wire up dependencies: TwitchClient now has access to overlay broadcaster
        // The command handler will get these dependencies injected
        Logger.info('Wiring up service dependencies...');
        
        Logger.info('Twitch client initialized successfully!');
        
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
export { twitchClient, overlayBroadcaster };