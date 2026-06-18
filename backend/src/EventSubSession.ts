import WebSocket from 'ws';
import Logger from './utils/Logger.js';

interface EventSubMessage {
    metadata: { message_type: string }
    payload: {
        session?: { id: string }
        subscription?: { type: string }
        event?: Record<string, unknown>
    }
}

export interface EventSubNotification {
    subscriptionType: string
    event: Record<string, unknown>
}

export class EventSubSession {
    private websocket: WebSocket | null = null;
    private sessionId: string | null = null;
    private readonly token: string;
    private readonly clientId: string;
    private readonly label: string;
    private readonly onReady: (sessionId: string) => Promise<void>;
    private readonly onNotification: (notification: EventSubNotification) => void;

    constructor(
        token: string,
        clientId: string,
        label: string,
        onReady: (sessionId: string) => Promise<void>,
        onNotification: (notification: EventSubNotification) => void
    ) {
        this.token = token;
        this.clientId = clientId;
        this.label = label;
        this.onReady = onReady;
        this.onNotification = onNotification;
    }

    connect(): void {
        this.websocket = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

        this.websocket.onopen = () => Logger.info(`EventSubSession[${this.label}]: Connected`);

        this.websocket.onmessage = (event) => {
            const message = JSON.parse(event.data as string) as EventSubMessage;
            if (message.metadata.message_type === 'session_keepalive') return;
            this.handleMessage(message);
        };

        this.websocket.onclose = (event) => {
            Logger.warn(`EventSubSession[${this.label}]: Closed (${event.code}) — reconnecting in 5s`);
            setTimeout(() => this.connect(), 5000);
        };

        this.websocket.onerror = (error) => Logger.error(`EventSubSession[${this.label}]: Error:`, error);
    }

    private async handleMessage(message: EventSubMessage): Promise<void> {
        switch (message.metadata.message_type) {
            case 'session_welcome':
                this.sessionId = message.payload.session?.id ?? null;
                Logger.info(`EventSubSession[${this.label}]: Session ready`);
                if (this.sessionId) await this.onReady(this.sessionId);
                break;

            case 'notification':
                this.handleNotification(message);
                break;

            case 'session_reconnect':
                Logger.info(`EventSubSession[${this.label}]: Reconnect requested`);
                break;
        }
    }

    private handleNotification(message: EventSubMessage): void {
        const subType = message.payload.subscription?.type ?? '';
        const event = message.payload.event ?? {};
        Logger.info(`EventSubSession[${this.label}]: Notification received:`, { subscriptionType: subType, event });
        this.onNotification({ subscriptionType: subType, event });
    }

    getSessionId(): string | null {
        return this.sessionId;
    }

    isConnected(): boolean {
        return this.websocket?.readyState === WebSocket.OPEN && this.sessionId !== null;
    }

    disconnect(): void {
        this.websocket?.close();
    }
}

export default EventSubSession;
