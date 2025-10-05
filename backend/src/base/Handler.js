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
        Logger.debug('Handler: Executing config:', config);
        Logger.debug('Handler: Template data:', templateData);
        
        // Handle reply messages - delegate to TwitchClient
        if (config.reply && this.twitchClient) {
            const message = this.processTemplate(config.reply, templateData);
            Logger.info('Sending chat reply:', message);
            await this.twitchClient.sendChatMessage(message);
        } else if (config.reply) {
            Logger.warn('Would send chat reply (no TwitchClient):', this.processTemplate(config.reply, templateData));
        }
        
        // Handle overlay events - delegate to overlay broadcaster service
        if (config.image || config.sound || config.text || config.video) {
            const overlayEvent = {
                type: 'command',
                command_name: config.command_name,
                image: config.image,
                sound: config.sound,
                video: config.video,
                text: this.processTemplate(config.text || '', templateData),
                transition_in: config.transition_in,
                transition_out: config.transition_out,
                timeout: config.timeout
            };
            
            Logger.info('Sending overlay event:', overlayEvent);
            if (this.overlayBroadcasterService) {
                await this.overlayBroadcasterService.broadcast(overlayEvent);
            } else {
                Logger.warn('Would send overlay event (no broadcaster service):', overlayEvent);
            }
        }
    }

    // Template processing method to replace placeholders like {{username}}
    processTemplate(template, data) {
        if (!template) return '';
        
        let result = template;
        
        // Replace {{username}} with actual username
        if (data.username) {
            result = result.replace(/\{\{username\}\}/g, data.username);
        }
        
        // Add more template variables as needed
        // result = result.replace(/\{\{other_var\}\}/g, data.other_var);
        
        return result;
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