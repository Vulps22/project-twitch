import Logger from './utils/Logger.js';
import type { IDashboardBroadcaster, ViewerData } from './types.js';

interface ITwitchChattersClient {
    getChatters(): Promise<{ userId: string; username: string }[]>
}

interface ViewerRecord {
    username: string
    firstSeen: number
    messageCount: number
}

export class ViewerTracker {
    private viewers = new Map<string, ViewerRecord>();
    private twitchClient: ITwitchChattersClient | null = null;
    private dashboardBroadcaster: IDashboardBroadcaster | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;

    setTwitchClient(client: ITwitchChattersClient): void {
        this.twitchClient = client;
    }

    setDashboardBroadcaster(broadcaster: IDashboardBroadcaster): void {
        this.dashboardBroadcaster = broadcaster;
    }

    async startPolling(): Promise<void> {
        await this.syncViewers();
        this.pollInterval = setInterval(() => void this.syncViewers(), 60_000);
    }

    stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    recordEvent(subscriptionType: string, event: Record<string, unknown>): void {
        if (subscriptionType === 'channel.stream.online') {
            this.reset();
            return;
        }

        if (subscriptionType === 'channel.chat.message') {
            const userId = String(event['chatter_user_id'] ?? '');
            const username = String(event['chatter_user_name'] ?? event['chatter_user_login'] ?? '');
            if (!userId) return;

            const now = Date.now();
            const existing = this.viewers.get(userId);
            if (existing) {
                existing.messageCount++;
                existing.username = username;
            } else {
                this.viewers.set(userId, { username, firstSeen: now, messageCount: 1 });
            }

            this.dashboardBroadcaster?.broadcast({ type: 'chat', userId, username });
            Logger.debug(`ViewerTracker: chat from ${username}`);
        }
    }

    reset(): void {
        this.viewers.clear();
        Logger.info('ViewerTracker: reset for new stream');
    }

    getViewers(): ViewerData[] {
        const now = Date.now();
        return Array.from(this.viewers.entries())
            .map(([userId, record]) => ({
                userId,
                username: record.username,
                watchTime: Math.floor((now - record.firstSeen) / 1000),
                messageCount: record.messageCount,
            }))
            .sort((a, b) => b.watchTime - a.watchTime);
    }

    private async syncViewers(): Promise<void> {
        if (!this.twitchClient) return;
        const chatters = await this.twitchClient.getChatters();
        const now = Date.now();
        const activeIds = new Set(chatters.map(c => c.userId));

        for (const { userId, username } of chatters) {
            if (!this.viewers.has(userId)) {
                this.viewers.set(userId, { username, firstSeen: now, messageCount: 0 });
            }
        }

        for (const userId of this.viewers.keys()) {
            if (!activeIds.has(userId)) {
                this.viewers.delete(userId);
            }
        }

        Logger.info(`ViewerTracker: synced ${chatters.length} chatters`);
    }
}

export default new ViewerTracker();
