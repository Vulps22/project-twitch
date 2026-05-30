import Logger from './utils/Logger.js';
import type { IDashboardBroadcaster, ViewerData } from './types.js';

interface ITwitchChattersClient {
    getChatters(): Promise<{ userId: string; username: string }[]>
}

interface ViewerRecord {
    username: string
    firstSeen: number
    messageCount: number
    bits: number
    subs: number
    pointsRedeemed: number
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
                this.viewers.set(userId, { username, firstSeen: now, messageCount: 1, bits: 0, subs: 0, pointsRedeemed: 0 });
            }


            this.dashboardBroadcaster?.broadcast({ type: 'chat', userId, username });
            Logger.debug(`ViewerTracker: chat from ${username}`);
            return;
        }

        if (subscriptionType === 'channel.cheer') {
            if (event['is_anonymous']) return;
            const userId = String(event['user_id'] ?? '');
            const username = String(event['user_name'] ?? '');
            const bits = Number(event['bits'] ?? 0);
            if (!userId) return;
            this.ensureViewer(userId, username).bits += bits;
            return;
        }

        if (subscriptionType === 'channel.subscribe') {
            const userId = String(event['user_id'] ?? '');
            const username = String(event['user_name'] ?? '');
            if (!userId) return;
            this.ensureViewer(userId, username).subs++;
            return;
        }

        if (subscriptionType === 'channel.channel_points_custom_reward_redemption.add') {
            const userId = String(event['user_id'] ?? '');
            const username = String(event['user_name'] ?? '');
            if (!userId) return;
            this.ensureViewer(userId, username).pointsRedeemed++;
        }
    }

    private ensureViewer(userId: string, username: string): ViewerRecord {
        const existing = this.viewers.get(userId);
        if (existing) {
            existing.username = username;
            return existing;
        }
        const record: ViewerRecord = { username, firstSeen: Date.now(), messageCount: 0, bits: 0, subs: 0, pointsRedeemed: 0 };
        this.viewers.set(userId, record);
        return record;
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
                bits: record.bits,
                subs: record.subs,
                pointsRedeemed: record.pointsRedeemed,
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
                this.viewers.set(userId, { username, firstSeen: now, messageCount: 0, bits: 0, subs: 0, pointsRedeemed: 0 });
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
