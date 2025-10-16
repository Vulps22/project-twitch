// Twitch EventSub WebSocket Handler
// Node.js ES6 module version

import WebSocket from 'ws';
import fetch from 'node-fetch';
import Logger from './utils/Logger.js';

export class TwitchClient {
    constructor(options = {}) {
        this.websocket = null;
        this.sessionId = null;
        this.accessToken = options.accessToken || process.env.TWITCH_ACCESS_TOKEN;
        this.clientId = options.clientId || process.env.TWITCH_CLIENT_ID;
        this.userId = null;
        this.username = null;
        this.channelId = null;
        this.channelName = options.channelName || process.env.TWITCH_CHANNEL_NAME;
        this.overlayBroadcasterService = options.overlayBroadcasterService || null;
        this.pointsManagerService = options.pointsManagerService || null;
        this.commandHandler = options.commandHandler || null;
        this.eventHandler = options.eventHandler || null;
        
        if (!this.accessToken || !this.clientId) {
            throw new Error('Access token and client ID are required. Provide them via constructor options or environment variables.');
        }
        
        this.init();
    }

    async init() {
        Logger.info('EventSub: Initializing Twitch EventSub WebSocket...');
        
        // Handlers are now injected via constructor - no need to create them here
        if (this.commandHandler) {
            Logger.info('TwitchClient: Command handler injected and ready');
        }
        if (this.eventHandler) {
            Logger.info('TwitchClient: Event handler injected and ready');
        }

        // Get user ID from Twitch API (bot account)
        await this.getUserId();
        
        // Get channel ID if channel name provided
        if (this.channelName) {
            await this.getChannelId();
        } else {
            this.channelId = this.userId; // Default to bot's own channel
        }
        
        // Pass user ID and channel ID to handlers for chat posting
        if (this.userId && this.commandHandler) {
            this.commandHandler.userId = this.userId;
        }
        
        if (this.userId && this.eventHandler) {
            this.eventHandler.userId = this.userId;
        }
        
        if (this.channelId && this.commandHandler) {
            this.commandHandler.channelId = this.channelId;
        }
        
        if (this.channelId && this.eventHandler) {
            this.eventHandler.channelId = this.channelId;
        }
        
        // Check token scopes before proceeding
        await this.checkTokenScopes();
        
        // Test getUserList API endpoint
        Logger.info('Testing getUserList API endpoint...');
        const userListResult = await this.getUserList();
        if (userListResult) {
            Logger.info('getUserList test successful!');
        } else {
            Logger.warn('getUserList test failed - check logs above for details');
        }
        
        // Connect to EventSub WebSocket
        this.connectEventSub();
    }

    /**
     * Fetch the list of chatters in the channel
     * @returns {Promise<Array>} List of chatters in the channel
     */
    async getUserList()  {
        try {
            //use console.log to debug the fetch call headers
            console.log('Fetching user list...');
            console.log('Headers:', {
                'Authorization': `Bearer ${this.accessToken}`,
                'broadcaster_id': this.channelId,
                'moderator_id': this.userId
            });
            const response = await fetch(`https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${this.channelId}&moderator_id=${this.userId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId
                }
            });
            Logger.log('Fetching user list response:', response);
            if (response.ok) {
                
                const data = await response.json() || [];
                return data['data'] || [];
            } else {
                Logger.error('Failed to get user list:', response.statusText);
                return [];
            }
        } catch (error) {
            Logger.error('Error getting user list:', error);
            return [];
        }
    }

    async getUserId() {
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.userId = data.data[0].id;
                this.username = data.data[0].display_name;
                Logger.info('EventSub: Got user ID:', { user_id: this.userId });
                Logger.info('EventSub: Connected as:', this.username);
            } else {
                Logger.error('EventSub: Failed to get user ID:', response.statusText);
            }
        } catch (error) {
            Logger.error('EventSub: Error getting user ID:', error);
        }
    }

    async getChannelId() {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/users?login=${this.channelName}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.data.length > 0) {
                    this.channelId = data.data[0].id;
                    Logger.info('EventSub: Got channel ID for', this.channelName + ':', { channel_id: this.channelId });
                } else {
                    Logger.error('EventSub: Channel not found:', this.channelName);
                    this.channelId = this.userId; // Fallback to bot's channel
                }
            } else {
                console.error('EventSub: Failed to get channel ID:', response.statusText);
                this.channelId = this.userId; // Fallback to bot's channel
            }
        } catch (error) {
            console.error('EventSub: Error getting channel ID:', error);
            this.channelId = this.userId; // Fallback to bot's channel
        }
    }

    async checkTokenScopes() {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('EventSub: Current token scopes:', data.scopes);
                console.log('EventSub: Required scopes: user:read:chat, user:write:chat, channel:read:subscriptions, moderator:read:followers, moderator:read:chatters');
                
                const requiredScopes = ['user:read:chat', 'user:write:chat', 'channel:read:subscriptions', 'moderator:read:followers', 'moderator:read:chatters'];  
                const missingScopes = requiredScopes.filter(scope => !data.scopes.includes(scope));
                
                if (missingScopes.length > 0) {
                    console.error('EventSub: Token missing required scopes:', missingScopes);
                } else {
                    console.log('EventSub: All required scopes present!');
                }
            } else {
                console.error('EventSub: Failed to validate token:', response.statusText);
            }
        } catch (error) {
            console.error('EventSub: Error validating token:', error);
        }
    }

    connectEventSub() {
        this.websocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');
        
        this.websocket.onopen = () => {
            console.log('EventSub: WebSocket connected');
        };

        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if(message.metadata.message_type == 'session_keepalive') {
                return; // Ignore keepalive messages
            }
            this.handleEventSubMessage(message);
        };

        this.websocket.onclose = (event) => {
            console.log('EventSub: WebSocket closed:', event.code, event.reason);
            // Reconnect after a delay
            setTimeout(() => this.connectEventSub(), 5000);
        };

        this.websocket.onerror = (error) => {
            console.error('EventSub: WebSocket error:', error);
        };
    }

    async handleEventSubMessage(message) {
        Logger.log('EventSub: Received message:', message);

        switch (message.metadata.message_type) {
            case 'session_welcome':
                this.sessionId = message.payload.session.id;
                Logger.info('EventSub: Got session ID:', { session_id: this.sessionId });
                Logger.info(`EventSub: Connected as ${this.username}`);
                await this.subscribeToChatMessages();
                await this.subscribeToFollows();
                break;

            case 'session_keepalive':
                //console.log('EventSub: Keepalive received');
                break;

            case 'notification':
                this.handleNotification(message);
                break;

            case 'session_reconnect':
                console.log('EventSub: Reconnect requested');
                // Handle reconnection
                break;

            default:
                console.log('EventSub: Unknown message type:', message.metadata.message_type);
        }
    }

    async subscribeToChatMessages() {
        if (!this.sessionId || !this.userId) {
            console.error('EventSub: Cannot subscribe - missing session ID or user ID');
            return;
        }

        const subscriptionData = {
            type: 'channel.chat.message',
            version: '1',
            condition: {
                broadcaster_user_id: this.channelId,
                user_id: this.userId
            },
            transport: {
                method: 'websocket',
                session_id: this.sessionId
            }
        };

        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscriptionData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('EventSub: Successfully subscribed to chat messages:', result);
            } else {
                const error = await response.json();
                console.error('EventSub: Failed to subscribe to chat messages:', error);
            }
        } catch (error) {
            console.error('EventSub: Error subscribing to chat messages:', error);
        }
    }

    async subscribeToFollows() {
        if (!this.sessionId || !this.userId) {
            console.error('EventSub: Cannot subscribe to follows - missing session ID or user ID');
            return;
        }

        const subscriptionData = {
            type: 'channel.follow',
            version: '2',
            condition: {
                broadcaster_user_id: this.channelId,
                moderator_user_id: this.userId
            },
            transport: {
                method: 'websocket',
                session_id: this.sessionId
            }
        };

        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscriptionData)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('EventSub: Successfully subscribed to follow events:', result);
            } else {
                const error = await response.json();
                console.error('EventSub: Failed to subscribe to follow events:', error);
            }
        } catch (error) {
            console.error('EventSub: Error subscribing to follow events:', error);
        }
    }

    handleNotification(message) {
        const event = message.payload.event;
        
        if (message.payload.subscription.type === 'channel.chat.message') {
            console.log('=== EVENTSUB CHAT MESSAGE ===');
            console.log('User:', event.chatter_user_name);
            console.log('Display Name:', event.chatter_user_display_name);
            console.log('Message:', event.message.text);
            console.log('Channel:', event.broadcaster_user_name);
            console.log('Message ID:', event.message_id);
            console.log('Timestamp:', event.message.timestamp);
            console.log('Raw Event:', event);
            console.log('=============================');

            // Record user activity for points accrual (only if points system is enabled)
            if (this.pointsManagerService) {
                this.pointsManagerService.recordUserActivity(
                    event.chatter_user_id, 
                    event.chatter_user_display_name || event.chatter_user_name
                );
            }

            // Pass message to command handler
            if (this.commandHandler) {
                const userInfo = {
                    username: event.chatter_user_name,
                    display_name: event.chatter_user_display_name,
                    user_id: event.chatter_user_id
                };
                this.commandHandler.processChatMessage(event.message.text, userInfo);
            }
        }
        
        if (message.payload.subscription.type === 'channel.follow') {
            console.log('=== EVENTSUB FOLLOW EVENT ===');
            console.log('Follower:', event.user_name);
            console.log('Display Name:', event.user_display_name);
            console.log('User ID:', event.user_id);
            console.log('Followed At:', event.followed_at);
            console.log('Raw Event:', event);
            console.log('=============================');
            
            // Pass event to event handler
            if (this.eventHandler) {
                const eventData = {
                    username: event.user_name,
                    display_name: event.user_display_name,
                    user_id: event.user_id,
                    followed_at: event.followed_at
                };
                this.eventHandler.processEvent('follow', eventData);
            }
        }
    }

    // Send a message to Twitch chat
    async sendChatMessage(message) {
        if (!this.accessToken || !this.clientId || !this.userId || !this.channelId) {
            console.error('TwitchClient: Cannot send chat message - missing required credentials or IDs');
            return false;
        }

        try {
            const response = await fetch('https://api.twitch.tv/helix/chat/messages', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    broadcaster_id: this.channelId,
                    sender_id: this.userId,
                    message: message
                })
            });

            if (response.ok) {
                console.log('TwitchClient: Chat message sent successfully:', message);
                return true;
            } else {
                const error = await response.json();
                console.error('TwitchClient: Failed to send chat message:', error);
                return false;
            }
        } catch (error) {
            console.error('TwitchClient: Error sending chat message:', error);
            return false;
        }
    }
}

export default TwitchClient;
