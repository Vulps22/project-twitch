// Base Handler Class
// ES6 module version

import Logger from '../utils/Logger.js';

export class Handler {
    constructor(twitchClient = null, overlayBroadcasterService = null) {
        this.twitchClient = twitchClient;
        this.overlayBroadcasterService = overlayBroadcasterService;
        this.container = null; // You can set this up for dependency injection
    }

    async executeConfig(config, templateData) {
        if (config.reply && this.twitchClient) {
            await this.twitchClient.sendChatMessage(this.processTemplate(config.reply, templateData));
        }

        if (config.image || config.sound || config.text || config.video) {
            const overlayEvent = {
                type: 'event',
                event_name: config.event_name,
                image: config.image,
                sound: config.sound,
                volume: config.volume,
                video: config.video,
                text: this.processTemplate(config.text || '', templateData),
                transition_in: config.transition_in,
                transition_out: config.transition_out,
                timeout: config.timeout
            };

            if (this.overlayBroadcasterService) {
                await this.overlayBroadcasterService.broadcast(overlayEvent);
            }
        }
    }

    processTemplate(template, data) {
        if (!template) return '';
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
    }

    // Set dependencies after construction
    setTwitchClient(twitchClient) {
        this.twitchClient = twitchClient;
    }

    setOverlayBroadcasterService(overlayBroadcasterService) {
        this.overlayBroadcasterService = overlayBroadcasterService;
    }
}

export default Handler;