// Overlay Broadcaster Service
// Handles broadcasting events to WebSocket clients (overlays)

import Logger from '../utils/Logger.js';

export class OverlayBroadcasterService {
    constructor(wss = null) {
        this.wss = wss; // WebSocket server instance
    }

    // Set the WebSocket server instance
    setWebSocketServer(wss) {
        this.wss = wss;
    }

    // Broadcast event to all connected overlay clients
    async broadcast(event) {
        if (!this.wss) {
            Logger.warn('OverlayBroadcaster: No WebSocket server available');
            return false;
        }

        const message = JSON.stringify(event);
        let sentCount = 0;

        this.wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
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

    // Send event to specific client (if needed)
    async sendToClient(client, event) {
        if (client.readyState === 1) { // WebSocket.OPEN
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

    // Get count of connected clients
    getClientCount() {
        if (!this.wss) return 0;
        
        let count = 0;
        this.wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                count++;
            }
        });
        return count;
    }
}

export default OverlayBroadcasterService;