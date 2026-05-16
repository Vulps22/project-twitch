import WebSocket from 'ws';
import fetch from 'node-fetch';
import Logger from './utils/Logger.js';
import type { TwitchRawEvent, IEventRouter, IOverlayBroadcaster } from './types.js';

// Local interfaces for Twitch API responses — typed to what we actually use
interface TwitchUserData {
    id: string
    display_name: string
}

interface TwitchUsersResponse {
    data: TwitchUserData[]
}

interface TwitchTokenValidation {
    scopes: string[]
}

interface TwitchSubscribeError {
    message?: string
    error?: string
}

interface EventSubMessage {
    metadata: {
        message_type: string
    }
    payload: {
        session?: { id: string }
        subscription?: { type: string }
        event?: Record<string, unknown>
    }
}

export interface TwitchClientOptions {
    accessToken?: string
    broadcasterToken?: string
    clientId?: string
    channelName?: string
    overlayBroadcasterService?: IOverlayBroadcaster
    eventRouter?: IEventRouter
}

export class TwitchClient {
    private websocket: WebSocket | null;
    private sessionId: string | null;
    private accessToken: string;
    private broadcasterToken: string;
    private clientId: string;
    private userId: string | null;
    private username: string | null;
    private channelId: string | null;
    private channelName: string | null;
    private overlayBroadcasterService: IOverlayBroadcaster | null;
    private eventRouter: IEventRouter | null;

    constructor(options: TwitchClientOptions = {}) {
        this.websocket = null;
        this.sessionId = null;

        const accessToken = options.accessToken ?? process.env.TWITCH_ACCESS_TOKEN;
        const clientId = options.clientId ?? process.env.TWITCH_CLIENT_ID;

        if (!accessToken || !clientId) {
            throw new Error('Access token and client ID are required.');
        }

        this.accessToken = accessToken;
        this.broadcasterToken = options.broadcasterToken ?? process.env.TWITCH_BROADCASTER_TOKEN ?? accessToken;
        this.clientId = clientId;
        this.userId = null;
        this.username = null;
        this.channelId = null;
        this.channelName = options.channelName ?? process.env.TWITCH_CHANNEL_NAME ?? null;
        this.overlayBroadcasterService = options.overlayBroadcasterService ?? null;
        this.eventRouter = options.eventRouter ?? null;

        this.init();
    }

    async init(): Promise<void> {
        await this.getUserId();

        if (this.channelName) {
            await this.getChannelId();
        } else {
            this.channelId = this.userId;
        }

        await this.checkTokenScopes();
        this.connectEventSub();
    }

    setEventRouter(eventRouter: IEventRouter): void {
        this.eventRouter = eventRouter;
    }

    private async getUserId(): Promise<void> {
        try {
            const response = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId
                }
            });

            if (response.ok) {
                const data = await response.json() as TwitchUsersResponse;
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

    private async getChannelId(): Promise<void> {
        try {
            const response = await fetch(`https://api.twitch.tv/helix/users?login=${this.channelName}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Client-Id': this.clientId
                }
            });

            if (response.ok) {
                const data = await response.json() as TwitchUsersResponse;
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

    private async checkTokenScopes(): Promise<void> {
        await this.validateScopes(this.accessToken, 'bot', [
            'user:read:chat',
            'user:write:chat',
            'moderator:read:followers',
            'moderator:read:chatters',
        ]);

        if (this.broadcasterToken !== this.accessToken) {
            await this.validateScopes(this.broadcasterToken, 'broadcaster', [
                'channel:read:subscriptions',
                'channel:read:redemptions',
                'bits:read',
            ]);
        } else {
            await this.validateScopes(this.accessToken, 'single-account', [
                'user:read:chat',
                'user:write:chat',
                'moderator:read:followers',
                'channel:read:subscriptions',
                'channel:read:redemptions',
                'bits:read',
            ]);
        }
    }

    private async validateScopes(token: string, label: string, required: string[]): Promise<void> {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json() as TwitchTokenValidation;
                const missing = required.filter(s => !data.scopes.includes(s));
                if (missing.length > 0) {
                    Logger.warn(`TwitchClient: ${label} token missing scopes:`, missing);
                } else {
                    Logger.info(`TwitchClient: ${label} token scopes OK`);
                }
            }
        } catch (error) {
            Logger.error(`TwitchClient: Error validating ${label} token:`, error);
        }
    }

    private connectEventSub(): void {
        this.websocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

        this.websocket.onopen = () => Logger.info('TwitchClient: EventSub connected');

        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data as string) as EventSubMessage;
            if (message.metadata.message_type === 'session_keepalive') return;
            this.handleEventSubMessage(message);
        };

        this.websocket.onclose = (event) => {
            Logger.warn('TwitchClient: EventSub closed:', event.code, event.reason);
            setTimeout(() => this.connectEventSub(), 5000);
        };

        this.websocket.onerror = (error) => Logger.error('TwitchClient: WebSocket error:', error);
    }

    private async handleEventSubMessage(message: EventSubMessage): Promise<void> {
        switch (message.metadata.message_type) {
            case 'session_welcome':
                this.sessionId = message.payload.session?.id ?? null;
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

    private async subscribeToAll(): Promise<void> {
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
        }, this.broadcasterToken);
        await this.subscribe('channel.raid', '1', {
            to_broadcaster_user_id: this.channelId
        });
        await this.subscribe('channel.cheer', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken);
        await this.subscribe('channel.channel_points_custom_reward_redemption.add', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken);
    }

    private async subscribe(
        type: string,
        version: string,
        condition: Record<string, string | null>,
        token: string = this.accessToken
    ): Promise<void> {
        try {
            const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
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
                const error = await response.json() as TwitchSubscribeError;
                Logger.error(`TwitchClient: Failed to subscribe to ${type}:`, error);
            }
        } catch (error) {
            Logger.error(`TwitchClient: Error subscribing to ${type}:`, error);
        }
    }

    handleNotification(message: EventSubMessage): void {
        if (!this.eventRouter) return;

        const subType = message.payload.subscription?.type;
        const event = message.payload.event;

        Logger.info('TwitchClient: Notification received:', { subscriptionType: subType, event });

        // Skip own bot messages
        if (
            subType === 'channel.chat.message'
            && event?.['chatter_user_id'] === this.userId
        ) {
            Logger.info('TwitchClient: Skipping own bot message');
            return;
        }

        const rawEvent: TwitchRawEvent = {
            subscriptionType: subType ?? '',
            event: event ?? {}
        };

        Logger.info('TwitchClient: Routing to EventRouter');
        this.eventRouter.route(rawEvent);
    }

    async sendChatMessage(message: string): Promise<boolean> {
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
                const error = await response.json() as TwitchSubscribeError;
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
