import { Handler } from '../base/Handler.js';
import { EVENTS } from '../../config/events.js';
import Logger from '../utils/Logger.js';

export class TwitchEventHandler extends Handler {
    constructor(twitchClient = null, overlayBroadcasterService = null) {
        super(twitchClient, overlayBroadcasterService);
        this.events = {};
        this.init();
    }

    async init() {
        await this.loadEvents();
        Logger.info('TwitchEventHandler: Initialized and ready to process events');
    }

    loadEvents() {
        try {
            // Use the imported EVENTS from events.js
            this.events = EVENTS;
            Logger.info('TwitchEventHandler: Events loaded:', Object.keys(this.events));
        } catch (error) {
            Logger.error('TwitchEventHandler: Failed to load events:', error);
        }
    }

    // Main method to process Twitch events
    processEvent(eventType, eventData) {
        Logger.debug('TwitchEventHandler: Processing event:', eventType);
        
        if (this.events[eventType]) {
            Logger.logWithContext('EVENT', 'Event triggered:', {
                event_type: eventType,
                event_data: eventData,
                event_config: this.events[eventType]
            });
            
            this.executeEvent(eventType, eventData);
        } else {
            Logger.warn('TwitchEventHandler: No configuration found for event:', eventType);
        }
    }

    async executeEvent(eventType, eventData) {
        const eventConfig = this.events[eventType];
        
        // Prepare template data with more comprehensive mapping
        const templateData = {
            username: eventData.username || eventData.display_name || eventData.user_name || '',
            display_name: eventData.display_name || eventData.username || eventData.user_name || '',
            count: eventData.count || eventData.viewer_count || eventData.viewers || '',
            user_id: eventData.user_id || '',
            followed_at: eventData.followed_at || '',
            timestamp: eventData.timestamp || new Date().toISOString()
        };
        
        Logger.debug('TwitchEventHandler: Executing event with template data:', {
            event_type: eventType,
            template_data: templateData
        });
        
        // Use base class method
        await this.executeConfig(eventConfig, templateData);
    }
}

export default TwitchEventHandler;
