import { BaseEventType } from './BaseEventType.js';

export class SubscriptionEventType extends BaseEventType {

    get type() { return 'subscription'; }

    match(rawEvent, config) {
        return rawEvent.subscriptionType === 'channel.subscribe'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.user_name,
            display_name: event.user_name,
            user_id: event.user_id,
            tier: event.tier
        };
    }
}
