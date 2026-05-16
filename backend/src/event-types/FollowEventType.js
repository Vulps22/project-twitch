import { BaseEventType } from './BaseEventType.js';

export class FollowEventType extends BaseEventType {

    get type() { return 'follow'; }

    match(rawEvent, config) {
        return rawEvent.subscriptionType === 'channel.follow'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent) {
        const { event } = rawEvent;
        return {
            username: event.user_name,
            display_name: event.user_display_name,
            user_id: event.user_id,
            followed_at: event.followed_at
        };
    }
}
