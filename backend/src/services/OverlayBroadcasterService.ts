import { WebSocketServer, WebSocket as WsClient } from 'ws';
import Logger from '../utils/Logger.js';
import type { IOverlayBroadcaster, OverlayEvent } from '../types.js';

export class OverlayBroadcasterService implements IOverlayBroadcaster {
    private wss: WebSocketServer | null;

    constructor(wss: WebSocketServer | null = null) {
        this.wss = wss;
    }

    setWebSocketServer(wss: WebSocketServer): void {
        this.wss = wss;
    }

    async broadcast(event: OverlayEvent): Promise<boolean> {
        if (!this.wss) {
            Logger.warn('OverlayBroadcaster: No WebSocket server available');
            return false;
        }

        const message = JSON.stringify(event);
        let sentCount = 0;

        this.wss.clients.forEach((client) => {
            if (client.readyState === WsClient.OPEN) {
                try {
                    client.send(message);
                    sentCount++;
                } catch (error) {
                    Logger.error('OverlayBroadcaster: Error sending to client:', error);
                }
            }
        });

        Logger.info(`OverlayBroadcaster: Sent event to ${sentCount} overlay clients:`, event);
        return sentCount > 0;
    }

    async sendToClient(client: WsClient, event: OverlayEvent): Promise<boolean> {
        if (client.readyState === WsClient.OPEN) {
            try {
                client.send(JSON.stringify(event));
                Logger.debug('OverlayBroadcaster: Sent event to specific client:', event);
                return true;
            } catch (error) {
                Logger.error('OverlayBroadcaster: Error sending to specific client:', error);
                return false;
            }
        }
        return false;
    }

    getClientCount(): number {
        if (!this.wss) return 0;

        let count = 0;
        this.wss.clients.forEach((client) => {
            if (client.readyState === WsClient.OPEN) {
                count++;
            }
        });
        return count;
    }
}

export default OverlayBroadcasterService;
