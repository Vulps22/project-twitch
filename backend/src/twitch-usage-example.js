// Example usage of TwitchClient
// This shows how you can use the Twitch client in other parts of your application

import { twitchClient } from '../index.js';

// Example function to demonstrate usage
export function exampleTwitchUsage() {
    if (!twitchClient) {
        console.log('Twitch client not available - check your environment variables');
        return;
    }

    console.log('Twitch client is available!');
    console.log('User ID:', twitchClient.userId);
    console.log('Username:', twitchClient.username);
    console.log('Channel ID:', twitchClient.channelId);
    console.log('Channel Name:', twitchClient.channelName);
}

// You can also create custom event handlers
export function setupCustomTwitchHandlers() {
    if (!twitchClient) return;

    // Override or extend the handleNotification method
    const originalHandleNotification = twitchClient.handleNotification.bind(twitchClient);
    
    twitchClient.handleNotification = (message) => {
        // Call the original method
        originalHandleNotification(message);
        
        // Add your custom logic here
        const event = message.payload.event;
        
        if (message.payload.subscription.type === 'channel.chat.message') {
            // Custom chat message handling
            console.log('🎮 Custom handler - New chat message:', event.message.text);
            
            // Example: Send message to WebSocket clients (overlay)
            // You could broadcast this to connected overlays
        }
        
        if (message.payload.subscription.type === 'channel.follow') {
            // Custom follow event handling
            console.log('💖 Custom handler - New follower:', event.user_display_name);
            
            // Example: Trigger overlay animation
            // You could send this to your overlay system
        }
    };
}

// Call this after the client is initialized if you want custom handlers
// setupCustomTwitchHandlers();