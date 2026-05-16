import { BaseEventType } from './BaseEventType.js';

export class BitsEventType extends BaseEventType {

    get type() { return 'bits'; }

    match(rawEvent, config) {
        return rawEvent.subscriptionType === 'channel.cheer'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.is_anonymous ? 'Anonymous' : event.user_name,
            display_name: event.is_anonymous ? 'Anonymous' : event.user_name,
            user_id: event.user_id ?? '',
            count: String(event.bits)
        };
    }
}
