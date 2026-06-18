import fetch from 'node-fetch';
import Logger from './utils/Logger.js';
import { EventSubSession } from './EventSubSession.js';
import type { EventSubNotification } from './EventSubSession.js';
import type { TwitchRawEvent, IEventRouter, IOverlayBroadcaster } from './types.js';

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

interface TwitchChattersResponse {
    data: { user_id: string; user_login: string; user_name: string }[]
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
    private accessToken: string;
    private broadcasterToken: string;
    private clientId: string;
    private userId: string | null;
    private username: string | null;
    private channelId: string | null;
    private channelName: string | null;
    private overlayBroadcasterService: IOverlayBroadcaster | null;
    private eventRouter: IEventRouter | null;
    private botSession: EventSubSession;
    private broadcasterSession: EventSubSession | null;
    private initPromise: Promise<void>;

    constructor(options: TwitchClientOptions = {}) {
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

        const notify = (n: EventSubNotification) => this.handleNotification(n);

        this.botSession = new EventSubSession(
            this.accessToken, this.clientId, 'bot',
            (sessionId) => this.subscribeBotEvents(sessionId),
            notify
        );

        this.broadcasterSession = this.broadcasterToken !== this.accessToken
            ? new EventSubSession(
                this.broadcasterToken, this.clientId, 'broadcaster',
                (sessionId) => this.subscribeBroadcasterEvents(sessionId),
                notify
            )
            : null;

        this.initPromise = this.init();
    }

    whenReady(): Promise<void> {
        return this.initPromise;
    }

    async init(): Promise<void> {
        await this.getUserId();

        if (this.channelName) {
            await this.getChannelId();
        } else {
            this.channelId = this.userId;
        }

        await this.checkTokenScopes();

        this.botSession.connect();
        this.broadcasterSession?.connect();
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
        if (this.broadcasterSession) {
            await this.validateScopes(this.accessToken, 'bot', [
                'user:read:chat',
                'user:write:chat',
                'moderator:read:followers',
                'moderator:read:chatters',
            ]);
            await this.validateScopes(this.broadcasterToken, 'broadcaster', [
                'channel:read:subscriptions',
                'channel:read:redemptions',
                'bits:read',
                'moderator:manage:banned_users',
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

    private async subscribeBotEvents(sessionId: string): Promise<void> {
        await this.subscribe('channel.chat.message', '1', {
            broadcaster_user_id: this.channelId,
            user_id: this.userId
        }, this.accessToken, sessionId);

        await this.subscribe('channel.follow', '2', {
            broadcaster_user_id: this.channelId,
            moderator_user_id: this.userId
        }, this.accessToken, sessionId);

        await this.subscribe('channel.raid', '1', {
            to_broadcaster_user_id: this.channelId
        }, this.accessToken, sessionId);

        // In single-account mode, broadcaster events also go through this session
        if (!this.broadcasterSession) {
            await this.subscribeBroadcasterEvents(sessionId);
        }
    }

    private async subscribeBroadcasterEvents(sessionId: string): Promise<void> {
        await this.subscribe('channel.subscribe', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken, sessionId);

        await this.subscribe('channel.cheer', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken, sessionId);

        await this.subscribe('channel.channel_points_custom_reward_redemption.add', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken, sessionId);

        await this.subscribe('channel.stream.online', '1', {
            broadcaster_user_id: this.channelId
        }, this.broadcasterToken, sessionId);
    }

    private async subscribe(
        type: string,
        version: string,
        condition: Record<string, string | null>,
        token: string,
        sessionId: string
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
                    transport: { method: 'websocket', session_id: sessionId }
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

    handleNotification(notification: EventSubNotification): void {
        if (!this.eventRouter) return;

        const { subscriptionType, event } = notification;

        // Skip own bot messages
        if (
            subscriptionType === 'channel.chat.message'
            && event['chatter_user_id'] === this.userId
        ) {
            Logger.info('TwitchClient: Skipping own bot message');
            return;
        }

        const rawEvent: TwitchRawEvent = { subscriptionType, event };

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
    async getStreamInfo(): Promise<{ title: string; viewerCount: number; startedAt: string } | null> {
        if (!this.channelId) return null;
        try {
            const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${this.channelId}`, {
                headers: { 'Client-Id': this.clientId, 'Authorization': `Bearer ${this.accessToken}` },
            });
            const data = await res.json() as { data: { title: string; viewer_count: number; started_at: string }[] };
            if (!data.data[0]) return null;
            const s = data.data[0];
            return { title: s.title, viewerCount: s.viewer_count, startedAt: s.started_at };
        } catch { return null; }
    }

    async getFollowerCount(): Promise<number | null> {
        if (!this.channelId) return null;
        try {
            const res = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.channelId}`, {
                headers: { 'Client-Id': this.clientId, 'Authorization': `Bearer ${this.accessToken}` },
            });
            const data = await res.json() as { total: number };
            return data.total ?? null;
        } catch { return null; }
    }

    async getSubscriberCount(): Promise<number | null> {
        if (!this.channelId || !this.broadcasterToken) return null;
        try {
            const res = await fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${this.channelId}`, {
                headers: { 'Client-Id': this.clientId, 'Authorization': `Bearer ${this.broadcasterToken}` },
            });
            const data = await res.json() as { total: number };
            return data.total ?? null;
        } catch { return null; }
    }

    async getChatters(): Promise<{ userId: string; username: string }[]> {
        if (!this.channelId || !this.userId) return [];
        try {
            const res = await fetch(
                `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${this.channelId}&moderator_id=${this.userId}`,
                { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Client-Id': this.clientId } }
            );
            if (!res.ok) {
                Logger.warn('TwitchClient: getChatters failed:', res.statusText);
                return [];
            }
            const data = await res.json() as TwitchChattersResponse;
            return data.data.map(c => ({ userId: c.user_id, username: c.user_name }));
        } catch (error) {
            Logger.error('TwitchClient: Error getting chatters:', error);
            return [];
        }
    }

    async timeout(userId: string, duration: number): Promise<void> {
        if (!this.channelId) return;
        await fetch(
            `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.channelId}&moderator_id=${this.channelId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.broadcasterToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: { user_id: userId, duration } }),
            }
        );
    }

    async ban(userId: string, reason?: string): Promise<void> {
        if (!this.channelId) return;
        const data: { user_id: string; reason?: string } = { user_id: userId };
        if (reason) data.reason = reason;
        await fetch(
            `https://api.twitch.tv/helix/moderation/bans?broadcaster_id=${this.channelId}&moderator_id=${this.channelId}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.broadcasterToken}`,
                    'Client-Id': this.clientId,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data }),
            }
        );
    }

    getStatus(): { bot: { connected: boolean }; broadcaster: { connected: boolean; configured: boolean } } {
        return {
            bot: { connected: this.botSession.isConnected() },
            broadcaster: {
                connected: this.broadcasterSession?.isConnected() ?? false,
                configured: !!this.broadcasterToken,
            },
        };
    }
}

export default TwitchClient;
