import { WebSocketServer, WebSocket as WsClient } from 'ws';
import Logger from '../utils/Logger.js';
import type { DashboardChatEvent, IDashboardBroadcaster } from '../types.js';

export class DashboardBroadcasterService implements IDashboardBroadcaster {
    private wss: WebSocketServer | null;

    constructor(wss: WebSocketServer | null = null) {
        this.wss = wss;
    }

    setWebSocketServer(wss: WebSocketServer): void {
        this.wss = wss;
    }

    broadcast(event: DashboardChatEvent): void {
        if (!this.wss) return;
        const message = JSON.stringify(event);
        this.wss.clients.forEach((client) => {
            if (client.readyState === WsClient.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    Logger.error('DashboardBroadcaster: Error sending to client:', error);
                }
            }
        });
    }

    getClientCount(): number {
        if (!this.wss) return 0;
        let count = 0;
        this.wss.clients.forEach((client) => {
            if (client.readyState === WsClient.OPEN) count++;
        });
        return count;
    }
}

export default DashboardBroadcasterService;
