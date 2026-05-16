import { BaseEventType } from './BaseEventType.js';
import type { EventConfig, TemplateData, TwitchRawEvent } from '../types.js';

export class FollowEventType extends BaseEventType {

    get type(): string { return 'follow'; }

    match(rawEvent: TwitchRawEvent, config: EventConfig): boolean {
        return rawEvent.subscriptionType === 'channel.follow'
            && config.event_type === this.type;
    }

    extractTemplateData(rawEvent: TwitchRawEvent): TemplateData {
        const event = rawEvent.event as {
            user_name: string;
            user_display_name: string;
            user_id: string;
            followed_at: string;
        };
        return {
            username: event.user_name,
            display_name: event.user_display_name,
            user_id: event.user_id,
            followed_at: event.followed_at
        };
    }
}
