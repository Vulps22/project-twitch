import { BaseEventType } from './BaseEventType.js';

export class RaidEventType extends BaseEventType {

    get type() { return 'raid'; }

    match(rawEvent, config) {
        return rawEvent.subscriptionType === 'channel.raid'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.from_broadcaster_user_name,
            display_name: event.from_broadcaster_user_name,
            user_id: event.from_broadcaster_user_id,
            count: String(event.viewers)
        };
    }
}
