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
        this.eventRouter = options.eventRouter || null;

        if (!this.accessToken || !this.clientId) {
            throw new Error('Access token and client ID are required.');
        }

        this.init();
    }

    async init() {
        await this.getUserId();

        if (this.channelName) {
            await this.getChannelId();
        } else {
            this.channelId = this.userId;
        }

        await this.checkTokenScopes();
        this.connectEventSub();
    }

    setEventRouter(eventRouter) {
        this.eventRouter = eventRouter;
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
                Logger.info('TwitchClient: Connected as', this.username);
            } else {
                Logger.error('TwitchClient: Failed to get user ID:', response.statusText);
            }
        } catch (error) {
            Logger.error('TwitchClient: Error getting user ID:', error);
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
                    Logger.info('TwitchClient: Monitoring channel:', this.channelName);
                } else {
                    Logger.error('TwitchClient: Channel not found:', this.channelName);
                    this.channelId = this.userId;
                }
            } else {
                this.channelId = this.userId;
            }
        } catch (error) {
            Logger.error('TwitchClient: Error getting channel ID:', error);
            this.channelId = this.userId;
        }
    }

    async checkTokenScopes() {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                const required = [
                    'user:read:chat',
                    'user:write:chat',
                    'channel:read:subscriptions',
                    'moderator:read:followers',
                    'moderator:read:chatters',
                    'channel:read:redemptions'
                ];
                const missing = required.filter(s => !data.scopes.includes(s));
                if (missing.length > 0) {
                    Logger.warn('TwitchClient: Missing token scopes:', missing);
                }
            }
        } catch (error) {
            Logger.error('TwitchClient: Error validating token:', error);
        }
    }

    connectEventSub() {
        this.websocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

        this.websocket.onopen = () => Logger.info('TwitchClient: EventSub connected');

        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.metadata.message_type === 'session_keepalive') return;
            this.handleEventSubMessage(message);
        };

        this.websocket.onclose = (event) => {
            Logger.warn('TwitchClient: EventSub closed:', event.code, event.reason);
            setTimeout(() => this.connectEventSub(), 5000);
        };

        this.websocket.onerror = (error) => Logger.error('TwitchClient: WebSocket error:', error);
    }

    async handleEventSubMessage(message) {
        switch (message.metadata.message_type) {
            case 'session_welcome':
                this.sessionId = message.payload.session.id;
                Logger.info('TwitchClient: Session ready');
                await this.subscribeToAll();
                break;

            case 'notification':
                this.handleNotification(message);
                break;

            case 'session_reconnect':
                Logger.info('TwitchClient: Reconnect requested');
                break;
        }
    }

    async subscribeToAll() {
        await this.subscribe('channel.chat.message', '1', {
            broadcaster_user_id: this.channelId,
            user_id: this.userId
        });
        await this.subscribe('channel.follow', '2', {
            broadcaster_user_id: this.channelId,
            moderator_user_id: this.userId
        });
        await this.subscribe('channel.subscribe', '1', {
            broadcaster_user_id: this.channelId
        });
        await this.subscribe('channel.raid', '1', {
            to_broadcaster_user_id: this.channelId
        });
        await this.subscribe('channel.cheer', '1', {
            broadcaster_user_id: this.channelId
        });
        await this.subscribe('channel.channel_points_custom_reward_redemption.add', '1', {
            broadcaster_user_id: this.channelId
        });
    }

    async subscribe(type, version, condition) {
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    version,
                    condition,
                    transport: { method: 'websocket', session_id: this.sessionId }
                })
            });

            if (response.ok) {
                Logger.info(`TwitchClient: Subscribed to ${type}`);
            } else {
                const error = await response.json();
                Logger.error(`TwitchClient: Failed to subscribe to ${type}:`, error);
            }
        } catch (error) {
            Logger.error(`TwitchClient: Error subscribing to ${type}:`, error);
        }
    }

    handleNotification(message) {
        if (!this.eventRouter) return;

        // Skip own bot messages
        if (message.payload.subscription.type === 'channel.chat.message'
            && message.payload.event.chatter_user_id === this.userId) return;

        this.eventRouter.route({
            subscriptionType: message.payload.subscription.type,
            event: message.payload.event
        });
    }

    async sendChatMessage(message) {
        if (!this.accessToken || !this.clientId || !this.userId || !this.channelId) {
            Logger.error('TwitchClient: Cannot send message — missing credentials');
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
                    message
                })
            });

            if (!response.ok) {
                const error = await response.json();
                Logger.error('TwitchClient: Failed to send message:', error);
                return false;
            }
            return true;
        } catch (error) {
            Logger.error('TwitchClient: Error sending message:', error);
            return false;
        }
    }
}

export default TwitchClient;
